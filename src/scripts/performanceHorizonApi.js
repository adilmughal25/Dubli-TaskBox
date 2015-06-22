"use strict";

var _ = require('lodash');
var debug = require('debug')('performancehorizon:api');
var utils = require('ominto-utils');
var sendEvents = require('./send-events');

var client = utils.remoteApis.performanceHorizonClient();


// doesn't seem to have coupons/deals/links in their api, this api just returns
// commission rates and advertiser info
var merchantsRunning = false;
function* getMerchants() {
  if (merchantsRunning) { throw 'already-running'; }
  merchantsRunning = true;

  var url = [
    'user', 'publisher', client.publisherId, 'campaign', 'approved.json'
  ].join('/');
  debug("fetching url %s", url);
  var data = yield client.get(url);
  var merchants = (data.campaigns || []).map(function(campaign) {
    return {merchant:campaign.campaign};
  });

  yield sendMerchantsToEventHub(merchants);

  merchantsRunning = false;
}

function sendMerchantsToEventHub(merchants) {
  if (! merchants) { merchants = []; }
  debug("found %d merchants to process", merchants.length);
  return sendEvents.sendMerchants('performancehorizon', merchants);
}

module.exports = {
  getMerchants: getMerchants
};
