"use strict";

var _ = require('lodash');
var parser = require('xml2json');
var request = require("request-promise");
var co = require('co');
var moment = require('moment');
var debug = require('debug')('linkshare:api');

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
    if (merchants) { sendMerchantsToEventHub(merchants || []); }
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
  var startTime = moment().subtract('1 day').startOf('day').toISOString().replace(/\..+$/, '-00:00');
  var endTime = moment().add('1 day').startOf('day').toISOString().replace(/\..+$/, '-00:00');

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
      sendCommissionsToEventHub(commissions || []);
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
}

function sendCommissionsToEventHub(commissions) {
  debug("found %d commisions to process", commissions.length);
}

var currentClient;
var authed = false;
var bearerToken;
var refreshToken;
function getFreshClient() {
  if (!currentClient) {
    currentClient = getClient();
  }
  return co(function*() {
    if (authed) {
      return currentClient;
    }

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
    setTimeout(refreshCode, response.body.expires_in * 1000 - 60000);
    return currentClient;
  });
}

function refreshCode() {
  co(function*() {
      var response = yield currentClient.post({
      uri: "token",
      headers: {
        // will override authorization field from current thing
        Authorization: "Basic YkxnOXFicVRzZWdDQ0VPTE5NN2dieHV0eWFvYTpKRWZTcEVPMldyZWhnRlB0MHJCMXd2MHU1REVh"
      },
      form: {
        grant_type: 'password',
        refresh_token: refreshToken,
        scope: 'Production'
      }
    });
    bearerToken = response.body.access_token;
    refreshToken = response.body.refresh_token;
    currentClient = getClient({
      headers: { Authorization: "Bearer " + bearerToken }
    });
    setTimeout(refreshCode, response.body.expires_in * 1000 - 60000);
    return currentClient;
  }).then(function() {
    debug("authorization code has been refreshed");
  }).catch(function(error) {
    console.error("error in linkshare api token refresh: "+error);
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
