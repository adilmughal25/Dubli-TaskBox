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
    // const events = commissions.map(prepareCommission.bind(null, s_account));
    // yield sendEvents.sendCommissions(accountKey, events);
    throw new Error("OMG has issues regarding Currencies, Do not enable until these are fixed");
  });

  return tasks;
}

const STATUS_MAP = {
  'Pending': 'initiated',
  'Rejected': 'cancelled',
  'Validated': 'confirmed'
};

function prepareCommission(s_account, o_obj) {
  const event = {
    transaction_id: o_obj.TransactionId,
    outclick_id: o_obj.UID,
    purchase_amount: o_obj.TransactionValue,
    commission_amount: o_obj.SR,
    //@TODO: not in the transactions xml, need to email them. (JRo: DubLi - OMG reports all in INR)
    // update 9/17/2015 - according to omg:
    //   YOU WILL NEED A CURRENCY ATTRIBUTE IF YOU ARE OPERATING IN SE.ASIA. THERE IS A NEW VERSION OF
    //   THE REPORT THAT HAS BEEN DEPLAYED WHICH WILL RESOLVE THIS. WE ARE HOPING TO RELEASE IN THE
    //   NEXT COUPLE 0F DAYS
    // So, this is still on hold, but should be able to be resolved soon
    currency: "BROKEN",
    state: isNum.test(o_obj.Paid) ? 'paid' : STATUS_MAP[o_obj.Status],
    effective_date: o_obj.Status === 'Pending' ? new Date(o_obj.TransactionTime) : 'auto',
  };
  return event;
}

module.exports = setup;
