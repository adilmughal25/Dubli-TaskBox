"use strict";

var request = require('request-promise');
var debug = require('debug')('utils:remoteapi:commissionfactory');
var limiter = require('ominto-utils').promiseRateLimiter;


const API_URL = 'https://api.commissionfactory.com/V1/Affiliate';
const API_KEY = 'd7ca984b2190487a954b08c4db740105';

var runCounter = 0;

function createClient() {
  var client = request.defaults({
    baseUrl: API_URL,
    json: true,
    qs: {
      apiKey: API_KEY
    }
  });

  limiter.request(client, 15, 60).debug(debug);

  return client;
}

module.exports = createClient;

/*

createClient()
  .get('/Merchants?status=Joined&commissionType=Percent per Sale')
  .then( x => console.log("RESULTS", JSON.stringify(x, null, 2)) )
  .catch( e => console.error("Error", e.stack) );

*/
