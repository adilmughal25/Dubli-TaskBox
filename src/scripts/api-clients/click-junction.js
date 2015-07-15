"use strict";

var co = require('co');
var _ = require('lodash');
var request = require('request-promise');
var debug = require('debug')('click:api-client-junction');
var limiter = require('ominto-utils').promiseRateLimiter;


var runCounter = 0;

var AUTH_HEADER = {
  usa: "009c8796168d78c027c9b4f1d8ed3902172eefa59512b9f9647482240bcd99d00a70c6358dd2b855f30afeafe055e1c8d99e632a626b1fa073a4092f4dd915e26d/36d998315cefa43e0d0377fff0d89a2fef85907b556d8fc3b0c3edc7a90b2e07fc8455369f721cc69524653234978c36fd12c67646205bf969bfa34f8242de8d",
  euro: "0095320cfab933ded5d007f9794a48a81cdd8e3c719b82dd1e1a044fa27f8e1703e125b03fab46ade6c01292f4767f96132b7559a574f6af9f4e566357af74b915/6b511e3ef71b158dccdeff973c54b9005269ee96759b133c84d0570bf71e98f46ad60c4cc0590d8453ab0d42d99398991de469e771055d5b353ca518ea169501",
};

var API_TYPES = {
  advertisers: {
    url: "https://advertiser-lookup.api.cj.com/v3",
    limit: [25, 60] // 25 requests per minute max
  },
  commissions: {
    url: "https://commission-detail.api.cj.com/v3",
    limit: null // cj doesn't say they limit this api -- bypass rate limiting
  },
  links: {
    url: "https://linksearch.api.cj.com/v2",
    limit: [25, 60]
  }
};

var activeClients = {};

function clickJunctionClient(s_type, s_regionId) {
  if (!s_regionId) s_regionId = 'usa';
  if (!API_TYPES[s_type]) throw new Error("Unknown CJ API type: "+s_type);
  if (!AUTH_HEADER[s_regionId]) throw new Error("Unknown CJ Region: "+s_regionId);
  var s_key = s_type + ':' + s_regionId;
  if (activeClients[s_key]) return activeClients[s_key];


  var c_cfg = API_TYPES[s_type];

  var client = request.defaults({
    baseUrl: c_cfg.url,
    json: true,
    simple: true,
    resolveWithFullResponse: true,
    headers: {
      authorization: AUTH_HEADER[s_regionId],
      accept: "application/xml"
    }
  });

  if (c_cfg.limit) {
    var num = c_cfg.limit[0];
    var time = c_cfg.limit[1];
    limiter.request(client, num, time).debug(debug);
  }
  activeClients[s_key] = client;

  return client;
}

module.exports = clickJunctionClient;
