"use strict";

var _ = require('lodash');
var debug = require('debug')('webgains:api');
var utils = require('ominto-utils');
var co = require('co');
var wait = require('co-waiter');
var sendEvents = require('./support/send-events');
var singleRun = require('./support/single-run');
var merge = require('./support/easy-merge')('id', {
  links: 'programId',
  coupons: 'programId'
});

var client = utils.remoteApis.webgainsClient();

var merchantsRunning = false;
function* getMerchants() {
  if (merchantsRunning) { throw 'already-running'; }
  merchantsRunning = true;
  try {
    var results = yield {
      merchants: client.getMerchants(),
      links: client.getTextLinks(),
      coupons: client.getCoupons()
    };
    var merged = merge(results);
    yield sendEvents.sendMerchants('webgains', merged);
  } finally {
    merchantsRunning = false;
  }
}

module.exports = {
  getMerchants: getMerchants
};
