"use strict";

var request = require('request-promise');

const PHG_API_KEY  = 'p3tew145y3tag41n';
const PHG_USER_KEY = 'xElyiP16';
const PUBLISHER_ID = '1101l317';

function createClient() {
  var baseUrl = 'https://' + PHG_API_KEY + ':' +
    PHG_USER_KEY + '@api.performancehorizon.com/';

  var client = request.defaults({
    baseUrl: baseUrl,
    simple: true,
    json: true
  });

  client.publisherId = PUBLISHER_ID;

  return client;
}

module.exports = createClient;
