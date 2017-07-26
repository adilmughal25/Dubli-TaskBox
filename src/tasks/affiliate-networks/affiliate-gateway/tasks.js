"use strict";

const _ = require('lodash');
const co = require('co');
const debug = require('debug')('affiliategateway:processor');
const utils = require('ominto-utils');
const sendEvents = require('../support/send-events');
const singleRun = require('../support/single-run');
const clientPool = require('./api');
const moment = require('moment');

const taskCache = {};

const merge = require('../support/easy-merge')('ProgramId', {
  coupons: 'ProgramId'
});

function setup(s_region) {
  let eventName = 'affiliategateway-' + s_region;
  if (taskCache[eventName]) return taskCache[eventName];

  var tasks = {};

  tasks.getMerchants = singleRun(function* () {
    const client = yield clientPool.getClient(s_region);

    var results = yield {
      merchants: client.GetProgramData({
        Criteria: {  // ApprovalStatusId, ProgramId, MerchantId, ProgramName, MerchantName
          ApprovalStatusId: 2 //2: Approved, 1: Pending, 3: Declined
        }
      }),
      coupons: client.GetAffiliateVouchers({
        //TODO add more Criteria if needed once Vouchers are available form AG.  
        //As of today, it's not available from TAG
        Criteria: { //StartDateTime, EndDateTime, Status, MerchantId, ProgramId
        }
      })
    };

    results.merchants = results.merchants.Programs.Program;
    results.coupons = results.coupons.Vouchers.length ? results.coupons.Vouchers : JSON.parse('[]');

    debug("programs count: %d", results.merchants.length);
    debug("coupons count: %d", results.coupons.length);

    var merged = merge(results);
    return sendEvents.sendMerchants(eventName, merged);
  });

  tasks.getCommissionDetails = singleRun(function* () {
    const client = yield clientPool.getClient(s_region);
    const startDate = new Date(Date.now() - (90 * 86400 * 1000));
    const endDate = new Date(Date.now());

    console.log("fetching all transactions between %s and %s", startDate, endDate);

    const results = yield client.GetSalesData({
      Criteria: {
        StartDateTime: moment(startDate).format('YYYY-MM-DD 00:00:00'),
        EndDateTime: moment(endDate).format('YYYY-MM-DD 23:59:59')
      }
    });

    let transactions = _.get(results, 'Transactions.Transaction', []);
    let errors = _.get(results, 'Errors', []);

    if (errors.Error && errors.Error.length > 0) {
      throw new Error(errors.Error[0].attributes.code + " - " + errors.Error[0].$value);
    }

    const events = transactions.map(prepareCommission.bind(null, s_region));
    return yield sendEvents.sendCommissions(eventName, events);
  });

  taskCache[eventName] = tasks;
  return tasks;
}

const STATE_MAP = {
  1: 'initiated',
  2: 'confirmed',
  3: 'cancelled',
};

const CURRENCY_MAP = {
  asia: 'usd',
  sg: 'sgd',
  uk: 'gbp',
  au: 'aud'
};

/**
 * Function to prepare a commission transaction for our data event.
 * @param {String} region
 * @param {Object} o_obj  The individual commission transaction straight from TAG
 * @returns {Object}
 */
function prepareCommission(region, o_obj) {
  var effDate = o_obj.SaleApprovalDateTime || o_obj.TransactionDateTime;

  var event = {
    affiliate_name: o_obj.ProgramName,
    transaction_id: o_obj.TransactionId,
    order_id: o_obj.TransactionId,
    outclick_id: (o_obj.AffiliateSubId || ''),  
    currency: CURRENCY_MAP[region],  //TAG (asia) is giving the transactions in USD 
    purchase_amount: Number(o_obj.OrderAmount),
    commission_amount: Number(o_obj.AffiliateCommissionAmount),
    state: STATE_MAP[o_obj.ApprovalStatusId],
    effective_date: new Date(moment(effDate, "DD/MM/YYYY 00:00:00"))
  };

  return event;
}

module.exports = setup;
