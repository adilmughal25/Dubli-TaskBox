"use strict";

/*
 * TODO:
 * - what "transtype" values are possible beside "Sale", "Lead" and "Affiliate Payment"?
 * - ledger report does not indivate a "paid" state - NOT equal *we will get paid* - still only *we MIGHT get paid*
 */

const AFFILIATE_CURRENCY = 'usd';

const _ = require('lodash');
const co = require('co');
const debug = require('debug')('shareasale:processor');
const sendEvents = require('./support/send-events');
const singleRun = require('./support/single-run');
const client = require('./api-clients/shareASale')();

var merge = require('./support/easy-merge')(
  'merchantid',
  {
    cashback: 'merchantid',
    deals: 'merchantid',
  }
);
const ary = x => _.isArray(x) ? x : [x];
const exists = x => !!x;

/**
 * Retrieve all merchant information from ShareASale datafeed including their cashback data and coupons/deals.
 * @returns {undefined}
 */
const getMerchants = singleRun(function*() {
  const results = {
    merchants: yield client.getMerchants(),
    cashback: yield client.getMerchantStatus(),
    deals: yield client.getDeals(),
  };

  const merchants = merge(results);

  yield sendEvents.sendMerchants('shareasale', merchants);
});

/**
 * Retrieve all commissions details (sales) via activity details + ledger report.
 * TODO: Figure out if ledger report includes pending sales already - maybe "activity" report is obsolete.
 * Otherwise use activity report and extend data with ledger report.
 * @returns {undefined}
 */
const getCommissionDetails = singleRun(function*() {
  let response = {},
      startDate = new Date(Date.now() - (30 * 86400 * 1000)),
      endDate = new Date(Date.now() - (60 * 1000)),
      params = {dateStart: startDate, dateEnd: endDate};

  // get activities first - format/transform/clean them
  response = yield client.getActivityDetails();
  let activityTransactions = ary(response).map(transformActivity).filter(exists);
  activityTransactions = _.transform(activityTransactions, function(res, item, key) {
    res[item.transaction_id] = item;
  }, {});

  // get ledger report - format/transform/clean them
  response = yield client.getLedgerReport();
  let ledgerTransactions = ary(response).map(transformLedger).filter(exists);
  ledgerTransactions = _.transform(ledgerTransactions, function(res, item, key) {
    res[item.transaction_id] = item;
  }, {});

  // Now merge them, so ledger overwrites possible existing acitivies
  const transactions = _.values(_.merge({}, activityTransactions, ledgerTransactions)).filter(exists);

  yield sendEvents.sendCommissions('shareasale', transactions);
});

/**
 * Transforms the activity items into a commissions object.
 * @param {Object} o_obj  A single activity object
 * @returns {Object}
 */
const transformActivity = function(o_obj) {
  let voided = Number(o_obj.voided) === 1;

  var event = {
    affiliate_name: o_obj.merchantorganization,
    transaction_id: o_obj.transid,
    outclick_id: _.trim(o_obj.affcomment),
    currency: AFFILIATE_CURRENCY,
    purchase_amount: Number(o_obj.transamount),
    commission_amount: Number(o_obj.commission),
    state: voided ? 'cancelled' : 'initiated',
    effective_date: 'auto'
  };

  return event;
};

/**
 * Transforms the ledger report items into a commissions object.
 * Skips item of type "Affiliate Payment".
 * @param {Object} o_obj  A single ledger report object
 * @returns {Object}
 */
const transformLedger = function(o_obj) {
  if(o_obj.transtype.toLowerCase() === 'affiliate payment') return;

  let status = 'confirmed',
      commission_amount = Number(o_obj.impact),
      purchase_amount   = Number(o_obj.orderimpact);

  if(commission_amount < 0) {
    commission_amount *= -1; // convert to positive values and status "cancelled"
    purchase_amount   *= -1;
    status            = 'cancelled';
  }

  var event = {
    affiliate_name: o_obj.merchantorganization,
    transaction_id: o_obj.transid,
    outclick_id: _.trim(o_obj.afftrack),
    currency: AFFILIATE_CURRENCY,
    purchase_amount: purchase_amount,
    commission_amount: commission_amount,
    state: status,
    effective_date: 'auto'
  };

  return event;
};

module.exports = {
  getMerchants: getMerchants,
  getCommissionDetails: getCommissionDetails
};
