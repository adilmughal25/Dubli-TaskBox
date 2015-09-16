"use strict";

const sendEvents = require('./support/send-events');
const singleRun = require('./support/single-run');

const client = require('./api-clients/lomadee')();

const merge = require('./support/easy-merge')('advertiserId', {
  coupons: 'seller.advertiserid'
});

let getMerchants = singleRun(function*() {
  const results = yield {
    merchants: client.getMerchants(),
    coupons: client.getCoupons()
  };

  const merchants = merge(results);
  yield sendEvents.sendMerchants('lomadee', merchants);
});

let getCommissionDetails = singleRun(function*() {
  yield sendEvents.sendCommissions('lomadee', []);
});

module.exports = {
  getMerchants: getMerchants,
  getCommissionDetails: getCommissionDetails
}
