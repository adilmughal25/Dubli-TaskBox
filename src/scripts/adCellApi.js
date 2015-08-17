"use strict";

var _ = require('lodash');
var co = require('co');
var debug = require('debug')('affiliatewindow:processor');
var sendEvents = require('./support/send-events');
var singleRun = require('./support/single-run');
var client = require('./api-clients/adCell')();

const getMerchants = singleRun(function* () {
  let results = yield client.getAffiliateProgram();
	yield sendEvents.sendMerchants('adcell', results);
});

module.exports = {
  getMerchants: getMerchants,
};
