"use strict";

const sendEvents = require('../support/send-events');
const singleRun = require('../support/single-run');

const client = require('./api')();

const merge = require('../support/easy-merge')('advertiserid', {
  coupons: 'advertiserid'
});

let getMerchants = singleRun(function*() {
  const results = yield {
    merchants: client.getMerchants(),
    coupons: client.getCoupons()
  };

  const merchants = merge(results);
  return yield sendEvents.sendMerchants('lomadee', merchants);
});

let getCommissionDetails = singleRun(function*() {
  return yield sendEvents.sendCommissions('lomadee', []);
});

module.exports = {
  getMerchants: getMerchants,
  getCommissionDetails: getCommissionDetails
}
