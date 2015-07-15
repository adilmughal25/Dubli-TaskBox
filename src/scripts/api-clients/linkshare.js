"use strict";

var _ = require('lodash');
var co = require('co');
var wait = require('co-waiter');
var request = require('request-promise');
var debug = require('debug')('linkshare:api-client');
var querystring = require('querystring');
var limiter = require('ominto-utils').promiseRateLimiter;

var LS_PREAUTH = {
  Authorization: "Basic YkxnOXFicVRzZWdDQ0VPTE5NN2dieHV0eWFvYTpKRWZTcEVPMldyZWhnRlB0MHJCMXd2MHU1REVh"
};
var LS_AUTH_FORM = {
  grant_type: 'password',
  username: 'Ominto',
  password: 'Minty678',
  scope: '3239617'
};

function LinkShare() {
  if (!(this instanceof LinkShare)) return new LinkShare();
  _.bindAll(this, '_authRequest', '_refreshClient');
  debug("Create new client");
  this.counter = 0;
  this.queues = {};
  this.cleanup();
}

LinkShare.prototype.getFreshClient = co.wrap(function*() {
  var _id = this.counter++;
  var self = this;
  if (this.authed) return this._client;
  if (this.authing) {
    debug("Auth already in progress, waiting for previous to finish (id: %d)", _id);
    var promise = new Promise(function(resolve,reject) {
      self.authQueue.push({resolve:resolve,reject:reject,_id:_id});
    });
    return promise;
  }
  debug("Authorizing (id: %s)", _id);
  this.authing = true;
  try {
    yield this._authRequest(LS_AUTH_FORM);
  } catch (err) {
    debug("ERROR!", err.stack);
    this.cleanup(err);
    throw err;
  } finally {
    this.authing = false;
  }
  this.authed = true;
  debug("Authorization complete (id: %s)", _id);
  return this._client;
});

LinkShare.prototype._authRequest = co.wrap(function* (form) {
  var self = this;
  var client = getLinkshareClient(); // always auth on a clean client
  var response = yield client.post({
    uri: "token",
    headers: LS_PREAUTH,
    form: form
  });
  this.bearerToken = response.body.access_token;
  this.refreshToken = response.body.refresh_token;
  var refreshTime = (response.body.expires_in - 60) * 1000;
  debug("time to refresh: %d seconds / %d min", refreshTime/1000|0, refreshTime/1000/60|0);
  this._client = getLinkshareClient({
    headers: {
      Authorization: "Bearer "+this.bearerToken
    }
  });
  this.authQueue.forEach(function(item) {
    debug("Auth completed (id: %d)", item._id);
    item.resolve(self._client);
  });
  this.authQueue = [];
  if (this.timer) clearTimeout(this.timer);
  this.timer = setTimeout(this._refreshClient, refreshTime);
});

LinkShare.prototype._refreshClient = function() {
  debug("Refreshing!");
  this._authRequest({
    grant_type: 'refresh_token',
    scope: 'Production',
    refresh_token: this.refreshToken
  }).catch(function(err) {
    console.error("auth error: "+err);
    console.error("will re-auth on next request!");
    this.cleanup(); // resets state in error
  }.bind(this));
};

LinkShare.prototype.cleanup = function(error) {
  debug("CLEANUP");
  this.releaseClient();
  this.bearerToken = null;
  this.refreshToken = null;
  this.authed = false;
  this._client = null;
  if (this.authQueue && this.authQueue.length) {
    this.authQueue.forEach(x => x.reject(error));
  }
  this.authQueue = [];
};

// do this to kill the timer
LinkShare.prototype.releaseClient = function() {
  if (this.timer) clearTimeout(this.timer);
  this.timer = null;
};

// handles making a rate-limited api call with a fresh client all in one go
var apiCt = 0;
LinkShare.prototype.apiCall = function(s_type, s_url) {
  var id = "#" + (++apiCt) + ": " + s_type + " -> " + s_url;
  debug("queueing "+id);
  if (!this.queues[s_type]) {
    this.queues[s_type] = makeQueue(s_type);
  }
  var run = this.queues[s_type];
  var self = this;

  return run(function() {
    debug("dequeueing "+id);
    return self.getFreshClient().then(function(client) {
      return client.get(s_url).then(function(response) {
        return response;
      });
    });
  });
};

function makeQueue(s_type) {
  // using 120 seconds instead of 60 seconds for these to give us some safety overlap
  // this will keep us at 0.5x utilization, but means someone can run it in dev mode
  // while the production mode is running without issue.
  // maybe sometime later we'll have different keys for dev/stage/production?
  switch (s_type) {
    case 'linklocator':
    case 'coupons':
    case 'custom-reports':
    case 'advanced-reports':
      // these are all silver level
      return limiter(5, 120);

    case 'events':
      // platinum level
      return limiter(100, 120);

    case 'product-search':
    case 'advertiser-search':
      // unlimited
      return fn => fn();

    default:
      throw new Error("Unknown API Queue Type: "+s_type);
  }
}

function getLinkshareClient(fields) {
  var dataClient = request.defaults(_.extend({
    baseUrl: "https://api.rakutenmarketing.com",
    json: true,
    simple: false,
    resolveWithFullResponse: true,
    headers: {
      accept: "application/xml"
    }
  }, fields));

  return dataClient;
}

module.exports = function() {
  return new LinkShare();
};

module.exports.LinkShare = LinkShare;
