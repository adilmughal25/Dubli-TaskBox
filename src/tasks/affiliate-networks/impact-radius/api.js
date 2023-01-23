"use strict";

/*
 * API Documentation: http://dev.impactradius.com/display/api/Media+Partner+Actions
 */

const _ = require('lodash');
const co = require('co');
const debug = require('debug')('impactradius:api-client');
const qs = require('querystring');
//const limiter = require('ominto-utils').promiseRateLimiter;
let request = import('got');
const requestMethods = 'get head post put patch del'.split(' ');

const API_URL = 'https://api.impactradius.com/';
const Auth = {
  impactradius: {
    ominto: {
      us: {
        sid: 'IRDHLqHpQY79155520ngJ28D9dMGTVZJA1',
        token: 'EaMm5GVgjwCaZ3J3ccCriAqRuLsNsUKo',
      }
    },
    dubli: {
      us: {
        sid: 'IRXoYdVUGCz955369Aj7JfTNbTLEbjwzq1',
        token: 'q2tok7waySeXRdLgXNYcKLH7uirc2Gcc',
      },
      ca: {
        sid: 'IRhEpUH3tfi568857oBgcvKjLDNPeXWhs4',
        token: 'HUZXSHKSXMRjibUR4ENbyqgL7EvsvcAS',
      }
    }
  },
  dgm: {
    dubli: {
      au: {
        sid: 'IRJizyQiQ6yB30160CU8NUVS7EoYZLpvx3',
        token: 'H5XGEDRmjPjj87bNxK5YoMjJBfPX7FTG',
      }
    }
  },
  apdperformance: {
    ominto: {
      us: {
        sid: 'IRChfoXzapLZ168739NHtTNQFfqkmka6d3',
        token: 'iN3wjbHzj75xe3RUqUpoe6vyqnHSog2Q'
      }
    }
  }
};

for (var whitelabel in Auth) {
  // Auth.impactradius
  for (var entity in Auth[whitelabel]) {
    // Auth.impactradius.ominto
    for (var region in Auth[whitelabel][entity]) {
      // Auth.impactradius.ominto.us
      let defs = Auth[whitelabel][entity][region];
      let basic = Buffer.from([defs.sid,defs.token].join(':')).toString('base64');
      defs.authHeader = "Basic " + basic;
      defs.urlPathPrefix = "/Mediapartners/" + defs.sid + "/";
      Object.freeze(defs);
    }
  }
}
Object.freeze(Auth);

var _clientCache = {};

function impactRadiusClient(s_whitelabel, s_entity, s_region) {
  if (!s_whitelabel)  s_whitelabel  = 'impactradius';
  if (!s_entity)      s_entity      = 'ominto';
  if (!s_region)      s_region      = 'us';
  let _tag = s_whitelabel + '-' +  s_entity + '-' +  s_region;

  if (_clientCache[_tag]) return _clientCache[_tag];
  if (!Auth[s_whitelabel]) throw new Error("Unknown ImpactRadius WhiteLabel: "+s_whitelabel);
  if (!Auth[s_whitelabel][s_entity]) throw new Error("Unknown ImpactRadius entity `"+s_entity+"` for WhiteLabel: "+s_whitelabel);
  if (!Auth[s_whitelabel][s_entity][s_region]) throw new Error("Unknown ImpactRadius region `"+s_region+"` for WhiteLabel: "+s_whitelabel+" in Entity: "+s_entity);

  const auth = Auth[s_whitelabel][s_entity][s_region];

  const client = request.catch({
    baseUrl: API_URL,
    json: true,
    simple: true,
    resolveWithFullResponse: false,
    headers: {
      Authorization: auth.authHeader,
      Accept: "application/json",
      "Content-Type": "application/json"
    }
  });

  client.auth = auth;

  //limiter.request(client, 1000, 3600).debug(debug, _tag);

  requestMethods.forEach(function(method) {
    // this reformats errors so they don't suck.
    var orig = client[method];
    //client[method] = () => orig(client, arguments).catch(fixError);
  });

  client.getPaginated = co.wrap(function* (url, key) {
    var results = [];
    while (url) {
      var body = yield client.catch(url).catch(fixError);
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

  _clientCache[_tag] = client;

  return client;
}

function fixError(error) {
  if (!error.options || !_.isObject(error.options) || !('method' in error.options)) {
    // isn't a request error!
    throw error;
  }

  var errString = error.message.replace(/^Error: /, ''); // otherwise we'll get a duplicate in the msg
  var o = error.options || {};
  var url = o.urI || o.uri;
  var base = o.baseUrl || "";
  var fullUrl = base ? [base.replace(/\/+$/, ''), url.replace(/^\/+/, '')].join('/') : url;

  errString += "(" + o.method + " " + fullUrl + ")";
  var newError = new Error(errString);
  _.extend(newError, _.pick(error, 'cause', 'options', 'error'));
  newError.stack = [newError.stack, "---", error.stack].join("\n"); // keep old stack
  throw newError;
}

module.exports = impactRadiusClient;
