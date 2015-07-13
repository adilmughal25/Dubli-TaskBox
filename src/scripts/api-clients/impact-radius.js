"use strict";

var _ = require('lodash');
var co = require('co');
var debug = require('debug')('utils:remoteapi:impactradius');
var qs = require('querystring');
var limiter = require('ominto-utils').promiseRateLimiter;
var request = require('request-promise');
var requestMethods = 'get head post put patch del'.split(' ');

var Auth = {
  impactradius: {
    sid: 'IRDHLqHpQY79155520ngJ28D9dMGTVZJA1',
    token: 'EaMm5GVgjwCaZ3J3ccCriAqRuLsNsUKo'
  },
  apdperformance: {
    sid: 'IRChfoXzapLZ168739NHtTNQFfqkmka6d3',
    token: 'iN3wjbHzj75xe3RUqUpoe6vyqnHSog2Q'
  }
};

for (var whitelabel in Auth) {
  let defs = Auth[whitelabel];
  let basic = new Buffer([defs.sid,defs.token].join(':')).toString('base64');
  defs.authHeader = "Basic " + basic;
  defs.urlPathPrefix = "/Mediapartners/"+defs.sid+"/";
  Object.freeze(defs);
}
Object.freeze(Auth);

var _clientCache = {};


function impactRadiusClient(s_whitelabel) {
  if (! s_whitelabel) s_whitelabel = 'impactradius';
  if (_clientCache[s_whitelabel]) return _clientCache[s_whitelabel];
  if (! Auth[s_whitelabel]) throw new Error("Unknown ImpactRadius WhiteLabel: "+s_whitelabel);
  var auth = Auth[s_whitelabel];

  var client = request.defaults({
    baseUrl: 'https://api.impactradius.com/',
    json: true,
    simple: true,
    resolveWithFullResponse: false,
    headers: {
      Authorization: auth.authHeader,
      Accept: "application/json",
      "Content-Type" : "application/json"
    }
  });

  client.auth = auth;

  limiter.request(client, 1000, 3600).debug(debug, s_whitelabel);

  requestMethods.forEach(function(method) {
    // this reformats errors so they don't suck.
    var orig = client[method];
    client[method] = () => orig.apply(client, arguments).catch(fixError);
  });

  client.getPaginated = co.wrap(function* (url, key) {
    var results = [];
    while (url) {
      var body = yield client.get(url).catch(fixError);
      results = results.concat(_.get(body, key, []));
      url = body['@nextpageuri'];
    }
    return results;
  });

  client.dateFormat = d => d.toISOString().replace(/\..+$/, '-00:00');
  client.url = (r,p) => auth.urlPathPrefix + r + '.json?' + qs.stringify(_.extend({PageSize:1000},p));

  var url = client.url, paged = client.getPaginated, date = client.dateFormat;

  client.getMerchants   = ()    => paged(url('Campaigns'), 'Campaigns');
  client.getCampaignAds = ()    => paged(url('Ads', {type:'TEXT_LINK,COUPON'}), 'Ads');
  client.getPromoAds    = ()    => paged(url('PromoAds'), 'PromotionalAds');
  client.getCommissions = (s,e) => paged(url('Actions',{StartDate:date(s),EndDate:date(e)}), 'Actions');

  _clientCache[s_whitelabel] = client;

  return client;
}

function fixError(error) {
  if (!error.options || !_.isObject(error.options) || !('method' in error.options)) {
    // isn't a request error!
    throw error;
  }

  var errString = error.message.replace(/^Error: /, ''); // otherwise we'll get a duplicate in the msg
  var o = error.options || {};
  var url = o.url || o.uri;
  var base = o.baseUrl || "";
  var fullUrl = base ? [base.replace(/\/+$/, ''), url.replace(/^\/+/, '')].join('/') : url;

  errString += " (" + o.method + " " + fullUrl + ")";
  var newError = new Error(errString);
  _.extend(newError, _.pick(error, 'cause', 'options', 'error'));
  newError.stack = [newError.stack, "---", error.stack].join("\n"); // keep old stack
  throw newError;
}

module.exports = impactRadiusClient;
