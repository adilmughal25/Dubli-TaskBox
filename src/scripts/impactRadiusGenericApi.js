"use strict";

var _ = require('lodash');
var moment = require('moment');
var utils = require('ominto-utils');
var getClient = require('./api-clients/impact-radius');

var sendEvents = require('./support/send-events');
var singleRun = require('./support/single-run');
var merge = require('./support/easy-merge')('CampaignId', {
  promoAds: 'CampaignId',
  campaignAds: 'CampaignId'
});

var taskCache = {};
function setup(s_whitelabel) {
  if (taskCache[s_whitelabel]) return taskCache[s_whitelabel];

  var client = getClient(s_whitelabel);

  var tasks = {};

  var getMerchants = tasks.getMerchants = singleRun(function* () {
    var results = yield {
      merchants: client.getMerchants(),
      campaignAds: client.getCampaignAds(),
      promoAds: client.getPromoAds()
    };
    var merchants = merge(results);
    yield sendEvents.sendMerchants(s_whitelabel, merchants);
  });

  var getCommissionDetails = tasks.getCommissionDetails = singleRun(function* () {
    var startTime = moment().subtract(1, 'days').startOf('day');
    var endTime = moment().add(1, 'days').startOf('day');
    var commissions = yield client.getCommissions(startTime, endTime);
    yield sendEvents.sendCommissions(s_whitelabel, commissions);
  });

  taskCache[s_whitelabel] = tasks;

  return tasks;
}

module.exports = setup;
