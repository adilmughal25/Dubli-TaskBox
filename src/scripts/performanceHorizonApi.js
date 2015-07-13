"use strict";

var _ = require('lodash');
var debug = require('debug')('performancehorizon:api');
var utils = require('ominto-utils');
var sendEvents = require('./support/send-events');
var singleRun = require('./support/single-run');

var client = require('./api-clients').performanceHorizonClient();


// doesn't seem to have coupons/deals/links in their api, this api just returns
// commission rates and advertiser info
var getMerchants = singleRun(function* (){
  var url = [
    'user', 'publisher', client.publisherId, 'campaign', 'approved.json'
  ].join('/');
  debug("fetching url %s", url);
  var data = yield client.get(url);
  var merchants = (data.campaigns || []).map(function(campaign) {
    return {merchant:campaign.campaign};
  });

  yield sendEvents.sendMerchants('performancehorizon', merchants);
});

module.exports = {
  getMerchants: getMerchants
};
