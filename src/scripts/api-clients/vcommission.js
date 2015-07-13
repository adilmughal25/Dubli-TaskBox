"use strict";

var _ = require('lodash');
var request = require('request-promise');
var qs = require('querystring');
var debug = require('debug')('utils:remoteapi:vcommission');
var limiter = require('ominto-utils').promiseRateLimiter;

const API_KEY = '669ba8e6d46a319e67e21f529cd9f78bd27f99322c6c9c40e0f250588d1e2959';
const NETWORK_ID = 'vcm';
const API_URL = 'https://api.hasoffers.com/';
const BASE_QUERY = {
  api_key: API_KEY,
  NetworkId: NETWORK_ID
};

function urlMaker(s_target, s_method, params) {
  return 'Apiv3/json?' + qs.stringify( _.extend({
    Target: s_target,
    Method: s_method
  }, BASE_QUERY, params));
}

var runCounter = 0;

function createClient() {
  var baseUrl = API_URL;
  var client = request.defaults({
    baseUrl: baseUrl,
    json: true,
    qs: BASE_QUERY
  });
  client.url = urlMaker;

  var limited = limiter.request(client, 50, 20);

  return client;
}

module.exports = createClient;
