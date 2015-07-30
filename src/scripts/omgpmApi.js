"use strict";

const _ = require('lodash');
const debug = require('debug')('omgpm:processor');
const sendEvents = require('./support/send-events');
const singleRun = require('./support/single-run');
const merge = require('./support/easy-merge')('PID', {
  coupons: 'ProgramId',
});

const client = require('./api-clients/omgpm-legacy')();

var getMerchants = singleRun(function* () {
  const results = yield {
    merchants: client.getMerchants(),
    coupons: client.getCoupons()
  };
  const merchants = merge(results);
  yield sendEvents.sendMerchants('omgpm', merchants);
});

module.exports = {getMerchants: getMerchants};
