"use strict";

const _ = require('lodash');
const debug = require('debug')('omgpm:processor');
const sendEvents = require('./support/send-events');
const singleRun = require('./support/single-run');
const merge = require('./support/easy-merge')('PID', {
  coupons: 'ProgramId',
});

const getClient = require('./api-clients/omgpm-legacy');

function setup(s_account) {
  const client = getClient(s_account);

  const tasks = {};

  tasks.getMerchants = singleRun(function* () {
    const results = yield {
      merchants: client.getMerchants(),
      coupons: client.getCoupons()
    };
    const merchants = merge(results);
    yield sendEvents.sendMerchants('omgpm-'+s_account, merchants);
  });

  return tasks;
}

module.exports = setup;
