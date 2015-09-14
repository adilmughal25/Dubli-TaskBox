"use strict";

const sendEvents = require('./support/send-events');
const singleRun = require('./support/single-run');

const client = require('./api-clients/lomadee')();

const merge = require('./support/easy-merge')('id', {
  coupons: 'program_id',
  links: 'program_id',
  generic: 'program_id'
});

var getMerchants = singleRun(function() {
  const results = yield  {
    merchants: client.getMerchants()
  };

  const merchants = merge(results);
  yield sendEvents.sendMerchants('lomadee', merchants);
});

var getCommissionDetails = singleRun(function() {
  yield sendEvents.sendCommissions('lomadee', []);
});

module.exports = {
  getMerchants: getMerchants,
  getCommissionDetails: getCommissionDetails
}
