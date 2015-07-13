"use strict";

var _ = require('lodash');
var debug = require('debug')('webgains:api');
var utils = require('ominto-utils');
var sendEvents = require('./support/send-events');
var singleRun = require('./support/single-run');
var merge = require('./support/easy-merge')('id', {
  links: 'programId',
  coupons: 'programId'
});

var client = require('./api-clients').webgainsClient();

var getMerchants = singleRun(function*() {
  var results = yield {
    merchants: client.getMerchants(),
    links: client.getTextLinks(),
    coupons: client.getCoupons()
  };
  var merged = merge(results);
  yield sendEvents.sendMerchants('webgains', merged);
});

module.exports = {
  getMerchants: getMerchants
};
