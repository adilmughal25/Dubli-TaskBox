"use strict";

var _ = require('lodash');
var parser = require('xml2json');
var request = require("request-promise");
var co = require('co');
var moment = require('moment');
var debug = require('debug')('linkshare:api');
var sendEvents = require('./send-events');

var merchantsRunning = false;
function* getMerchants() {
  if (merchantsRunning) { throw "already-running"; }
  merchantsRunning = true;
  debug("merchants fetch started");
  try {
    var client = yield getFreshClient();
    var url = "advertisersearch/1.0";
    debug('merchants fetch: %s', url);
    var response = yield client.get(url);
    var json = parser.toJson(response.body, {object:true});
    var merchants = json.result.midlist.merchant;
    if (merchants) {
      yield sendMerchantsToEventHub(merchants || [])
    }
  } finally {
    merchantsRunning = false;
  }
  debug("merchants fetch complete");
}

var commissionsRunning = false;
function* getCommissionDetails() {
  if (commissionsRunning) { throw "already-running"; }
  commissionsRunning = true;

  var currentPage = 1;
  var startTime = moment().subtract(1, 'days').startOf('day').toISOString().replace(/\..+$/, '-00:00');
  var endTime = moment().add(1, 'days').startOf('day').toISOString().replace(/\..+$/, '-00:00');

  var url;
  debug("commissions fetch started");
  try {
    var client = yield getFreshClient();
    while (true) {
      url = "/events/1.0/transactions?limit=1000&page="+currentPage;
      debug('commisions fetch: %s', url);
      var response = yield client.get(url);
      var commissions = response.body;
      if (!commissions) { break; }
      yield sendCommissionsToEventHub(commissions || []);
      if (commissions.length < 1000) { break; }
      currentPage += 1;
    }
  } finally {
    commissionsRunning = false;
  }
  debug("commissions fetch complete");
}

function sendMerchantsToEventHub(merchants) {
  debug("found %d merchants to process", merchants.length);
  return sendEvents.sendMerchants('linkshare', merchants);
}

function sendCommissionsToEventHub(commissions) {
  debug("found %d commisions to process", commissions.length);
  return sendEvents.sendCommissions('linkshare', commissions);
}

var currentClient;
var authed = false;
var currentlyAuthing = false;
var authQueue = [];
var bearerToken;
var refreshToken;
function getFreshClient() {
  if (!currentClient) {
    currentClient = getClient();
  }
  if (authed) {
    return Promise.resolve(currentClient);
  }
  if (currentlyAuthing) {
    debug("Auth in progress. piggybacking!");
    var promise = new Promise(function(resolve, reject) {
      var resolve2 = function(val){
        debug("Piggyback success!");
        resolve(val);
      };
      authQueue.push({resolve: resolve2, reject: reject});
    });
    return promise;
  }
  return co(function*() {
    currentlyAuthing = true;
    debug('starting client auth');
    var response = yield currentClient.post({
      uri: "token",
      headers: {
        Authorization: "Basic YkxnOXFicVRzZWdDQ0VPTE5NN2dieHV0eWFvYTpKRWZTcEVPMldyZWhnRlB0MHJCMXd2MHU1REVh"
      },
      form: {
        grant_type: 'password',
        username: 'Ominto',
        password: 'Minty678',
        scope: '3239617'
      }
    });

    bearerToken = response.body.access_token;
    refreshToken = response.body.refresh_token;
    currentClient = getClient({
      headers: { Authorization: "Bearer " + bearerToken }
    });
    debug("expire time: %d", response.body.expires_in);
    setTimeout(refreshCode, response.body.expires_in * 1000 - 60000);
    // setTimeout(refreshCode, 30 * 1000); // using this during testing the auth issues
    authed = true;
    currentlyAuthing = false;
    if (authQueue.length) {
      authQueue.forEach(q => q.resolve(currentClient));
      authQueue = [];
    }
    return currentClient;
  }).catch(function(error) {
    if (authQueue.length) {
      authQueue.forEach(q => q.reject(error));
      authQueue = [];
    }
    throw error;
  });
}

function refreshCode() {
  debug("Refreshing Auth Token");
  co(function*() {
      var response = yield currentClient.post({
      uri: "token",
      headers: {
        // will override authorization field from current thing
        Authorization: "Basic YkxnOXFicVRzZWdDQ0VPTE5NN2dieHV0eWFvYTpKRWZTcEVPMldyZWhnRlB0MHJCMXd2MHU1REVh"
      },
      form: {
        grant_type: 'password',
        username: 'Ominto',
        password: 'Minty678',
        refresh_token: refreshToken,
        scope: 'Production'
      }
    });
    bearerToken = response.body.access_token;
    refreshToken = response.body.refresh_token;
    currentClient = getClient({
      headers: { Authorization: "Bearer " + bearerToken }
    });
    debug("refreshed expire time: %d", response.body.expires_in);
    setTimeout(refreshCode, response.body.expires_in * 1000 - 60000);
    return currentClient;
  }).then(function() {
    debug("authorization code has been refreshed");
  }).catch(function(error) {
    if (error.statusCode && error.error) {
      console.error("error in linkshare api token refresh: ", error.error);
    } else {
      console.error("error in linkshare api token refresh: ", error);
    }
    authed = false;
    currentClient = null;
  });
}

function getClient(fields) {
  var dataClient = request.defaults(_.extend({
    baseUrl: "https://api.rakutenmarketing.com",
    json: true,
    simple: true,
    resolveWithFullResponse: true,
    headers: {
      accept: "application/xml"
    }
  }, fields));
  return dataClient;
}

module.exports = {
  getCommissionDetails: getCommissionDetails,
  getMerchants: getMerchants
};
