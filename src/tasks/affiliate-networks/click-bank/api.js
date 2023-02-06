"use strict";

/*
 * This api client is not currently in use -- It doesn't seem like they have
 * an API to get merchant details.
 *
 * products/commissions should work using this API when the time comes.
 *
 * API Documentation: https://support.clickbank.com/entries/22821303-ClickBank-API
 */

var _ = require('lodash');
var co = require('co');
var request = require('axios');
var debug = require('debug')('clickbank:api-client');

const API_URL       = 'https://api.clickbank.com/rest/1.3/';
const API_CLERK_KEY = 'API-1V1S8OCBG7OUO8EPJH2V3BRGOC00JAN4';
const API_DEV_KEY   = 'DEV-AEI5B8PNJJASO7B33D8OQ717MR0TMG17';

function createClient() {
  var client = request.extend({
    prefixUrl: API_URL,
    headers: {
      Authorization: [API_DEV_KEY, API_CLERK_KEY].join(':'),
      Accept: 'application/json'
    },
    resolveBodyOnly: true
  });

  return client;
}

module.exports = createClient;
