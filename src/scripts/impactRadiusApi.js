"use strict";

var parser = require('xml2json');
var request = require("request-promise");
var co = require('co');
var wait = require('co-wait');
var moment = require('moment');
var debug = require('debug')('impactradius:api');

var merchantsRunning = false;
function* getMerchants() {
  if (merchantsRunning) { throw "already-running"; }
  merchantsRunning = true;

  var perPage = 1000;
  var client = getClient();
  var url = "Mediapartners/IRDHLqHpQY79155520ngJ28D9dMGTVZJA1/Campaigns.json?PageSize="+perPage+"&Page=1";

  debug("merchants fetch started");
  try {
    while (url) {
      debug("merchants fetch: %s", url);
      var response = yield client.get(url);
      if (response.statusCode !== 200) {
        throw apiError(response);
      }
      sendMerchantsToEventHub(response.body.Campaigns || []);
      url = response.body['@nextpageuri'];
      if (url) { yield wait(moment.duration(1, 'minute')); }
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

  var perPage = 1000;
  var startTime = moment().subtract('1 day').startOf('day').toISOString().replace(/\..+$/, '-00:00');
  var endTime = moment().add('1 day').startOf('day').toISOString().replace(/\..+$/, '-00:00');

  var client = getClient();
  var url = "Mediapartners/IRDHLqHpQY79155520ngJ28D9dMGTVZJA1/Actions.json?PageSize=" +
    perPage + "&Page=1&StartDate=" + startTime + "&EndDate=" + endTime;

  debug("commissions fetch started");
  try {
    while (url) {
      debug("commissions fetch: %s", url);
      var response = yield client.get(url);
      if (response.statusCode !== 200) {
        throw apiError(response);
      }
      sendCommissionsToEventHub(response.body.Actions || []);
      url = response.body['@nextpageuri'];
      if (url) { yield wait(moment.duration(1, 'minute')); }
    }
  } finally {
    commissionsRunning = false;
  }
  debug("commissions fetch complete");
}

function getClient() {
  var dataClient = request.defaults({
    baseUrl: "https://api.impactradius.com",
    json: true,
    simple: false,
    resolveWithFullResponse: true,
    headers: {
      Authorization: "Basic SVJESExxSHBRWTc5MTU1NTIwbmdKMjhEOWRNR1RWWkpBMTpFYU1tNUdWZ2p3Q2FaM0ozY2NDcmlBcVJ1THNOc1VLbw==",
      Accept: "application/json",
      "Content-Type" : "application/json"
    }
  });
  return dataClient;
}

function apiError(response) {
  var contentType = response.headers['content-type'];
  var isJSON = /application\/json/.test(contentType);
  var err = "ImpactRadius api call failed: " + response.statusCode + " " + response.statusMessage;
  if (isJSON) {
    err += " " + ('Message' in response.body) ?
      response.body.Message : JSON.stringify(response.body);
  }
  return new Error(err);
}

function sendMerchantsToEventHub(merchants) {
  if (! merchants) { merchants = []; }
  debug("found %d merchants to process", merchants.length);
}

function sendCommissionsToEventHub(commissions) {
  if (! commissions) { commissions = []; }
  debug("found %d commisions to process", commissions.length);
}

module.exports = {
  getCommissionDetails: getCommissionDetails,
  getMerchants: getMerchants
};
