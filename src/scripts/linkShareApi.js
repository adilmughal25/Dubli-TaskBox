"use strict";

var _ = require('lodash');
var request = require("request-promise");
var co = require('co');
var moment = require('moment');
var debug = require('debug')('linkshare:api');
var sendEvents = require('./send-events');
var utils = require('ominto-utils');
var linkShare = utils.remoteApis.linkShareClient();
var _check = utils.checkApiResponse;
var jsonify = utils.jsonifyXmlBody;

var merchantsRunning = false;
function* getMerchants() {
  if (merchantsRunning) { throw "already-running"; }
  merchantsRunning = true;
  debug("merchants fetch started");
  try {
    var client = yield linkShare.getFreshClient();
    var url = "advertisersearch/1.0";
    debug('merchants fetch: %s', url);
    var json = yield client.get(url)
      .then(_check('merchant fetch error'))
      .then(jsonify);
    var merchants = json.result.midlist.merchant;
    if (merchants) {
      yield sendMerchantsToEventHub(merchants || []);
    }
  } finally {
    merchantsRunning = false;
  }
  debug("merchants fetch complete");
  linkShare.releaseClient();
}

var commissionsRunning = false;
function* getCommissionDetails() {
  if (commissionsRunning) { throw "already-running"; }
  commissionsRunning = true;

  var currentPage = 1;
  var startTime = moment().subtract(1, 'days').startOf('day').toISOString().replace(/\..+$/, '-00:00');
  var endTime = moment().add(1, 'days').startOf('day').toISOString().replace(/\..+$/, '-00:00');

  var url;
  debug("commissions fetch started");
  try {
    var client = yield linkShare.getFreshClient();
    while (true) {
      url = "/events/1.0/transactions?limit=1000&page="+currentPage;
      debug('commisions fetch: %s', url);
      var response = yield client.get(url).then(_check('commissions fetch error'));
      var commissions = response.body;
      if (!commissions) { break; }
      yield sendCommissionsToEventHub(commissions || []);
      if (commissions.length < 1000) { break; }
      currentPage += 1;
    }
  } finally {
    commissionsRunning = false;
  }
  debug("commissions fetch complete");
  linkShare.releaseClient();
}

function sendMerchantsToEventHub(merchants) {
  debug("found %d merchants to process", merchants.length);
  return sendEvents.sendMerchants('linkshare', merchants);
}

function sendCommissionsToEventHub(commissions) {
  debug("found %d commisions to process", commissions.length);
  return sendEvents.sendCommissions('linkshare', commissions);
}

module.exports = {
  getCommissionDetails: getCommissionDetails,
  getMerchants: getMerchants
};
