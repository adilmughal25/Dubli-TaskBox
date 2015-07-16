"use strict";

const _ = require('lodash');
const request = require('request-promise');
const qs = require('querystring');
const limiter = require('ominto-utils').promiseRateLimiter;
const deepFreeze = require('deep-freeze');

const API_URL = 'https://api.hasoffers.com/';
const CREDENTIALS = deepFreeze({
  vcommission: {
    api_key: '669ba8e6d46a319e67e21f529cd9f78bd27f99322c6c9c40e0f250588d1e2959',
    NetworkId: 'vcm'
  },
  snapdeal: {
    api_key: 'a95b73344703625919998f1bc7c419185207e8566b682faf777e013caef1c438',
    NetworkId: 'jasper'
  }
});

function createClient(s_networkName) {
  if (!s_networkName) s_networkName = 'vcommission';
  if (!CREDENTIALS[s_networkName]) {
    throw new Error('unknown network name: ['+s_networkName+'], available: '+Object.keys(CREDENTIALS).join(', '));
  }
  var creds = CREDENTIALS[s_networkName];
  var debug = require('debug')(s_networkName + ':hasoffers:api-client');
  var client = request.defaults({
    baseUrl: API_URL,
    json: true,
    qs: creds
  });
  limiter.request(client, 50, 20).debug(debug);
  _.extend(client, creds);

  client.url = function urlMaker(s_target, s_method, params) {
    var args = _.extend({
      Target: s_target,
      Method: s_method
    }, creds, params);
    return 'Apiv3/json?' + qs.stringify(args);
  };

  return client;
}

module.exports = createClient;
