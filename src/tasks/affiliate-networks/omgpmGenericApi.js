"use strict";

const _ = require('lodash');
const debug = require('debug')('omgpm:processor');
const moment = require('moment');

const sendEvents = require('./support/send-events');
const singleRun = require('./support/single-run');
const merge = require('./support/easy-merge')('PID', {
  coupons: 'ProgramId',
});

const getClient = require('./api-clients/omgpm-legacy');

function setup(s_account) {
  const client = getClient(s_account);

  const tasks = {};
  const accountKey = 'omgpm-' + s_account;

  tasks.getMerchants = singleRun(function* () {
    const results = yield {
      merchants: client.getMerchants(),
      coupons: client.getCoupons()
    };
    const merchants = merge(results);
    yield sendEvents.sendMerchants(accountKey, merchants);
  });

  tasks.getCommissionDetails = singleRun(function* (){
    const start = moment().subtract(90, 'days');
    const end = new Date();
    const commissions = yield client.getTransactions(start, end);
    const events = commissions.map(prepareCommission);
    yield sendEvents.sendCommissions(accountKey, events);
  });

  return tasks;
}

function prepareCommission(o_obj) {
  const event = {
    transaction_id: o_obj.TransactionId,
    outclick_id: o_obj.Ex1,
    purchase_amount: o_obj.TransactionValue,
    commission_amount: o_obj.VR,
    currency: o_obj.FIX_ME, //@TODO: not in the transactions xml, need to email them
    state: o_obj.FIX_ME,
    effective_date: o_obj.FIX_ME,
  };
  return event;
}

module.exports = setup;
