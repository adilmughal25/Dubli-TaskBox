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

const isNum = /^\d+$/;

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
    // const start = moment().subtract(90, 'days');
    // const end = new Date();
    // const commissions = yield client.getTransactions(start, end);
    // const events = commissions.map(prepareCommission);
    // yield sendEvents.sendCommissions(accountKey, events);
    throw new Error("OMG has issues regarding SubIDs and Currencies, Do not enable until these are fixed");
  });

  return tasks;
}

const STATUS_MAP = {
  'Pending': 'initiated',
  'Rejected': 'cancelled',
  'Validated': 'confirmed'
};

function prepareCommission(o_obj) {
  const event = {
    transaction_id: o_obj.TransactionId,
    outclick_id: "BROKEN", //@TODO not in the transactions XML that I can see. (JRo: should be "UID")
    purchase_amount: o_obj.TransactionValue,
    commission_amount: o_obj.VR,  // (JRo: should be "SR" and not "VR")
    currency: "BROKEN", //@TODO: not in the transactions xml, need to email them. (JRo: DubLi - OMG reports all in INR)
    state: isNum.test(o_obj.Paid) ? 'paid' : STATUS_MAP[o_obj.Status],
    effective_date: o_obj.Status === 'Pending' ? new Date(o_obj.TransactionTime) : 'auto',
  };
  return event;
}

module.exports = setup;
