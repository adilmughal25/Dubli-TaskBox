"use strict";

/*
 * TODO:
 * - what "transtype" values are possible beside "Sale", "Lead" and "Affiliate Payment"?
 * - ledger report does not indicate a "paid" state - NOT equal *we will get paid* - still only *we MIGHT get paid*
 */

const _ = require('lodash');
const co = require('co');
const debug = require('debug')('shareasale:processor');
const sendEvents = require('../support/send-events');
const singleRun = require('../support/single-run');

const ary = x => _.isArray(x) ? x : [x];
const exists = x => !!x;
const merge = require('../support/easy-merge')(
  'merchantid',
  {
    cashback: 'merchantid',
    deals: 'merchantid',
  }
);

const AFFILIATE_CURRENCY = 'usd';

const ShareASaleGenericApi = function(s_entity) {
  if (!(this instanceof ShareASaleGenericApi)) {
    debug("instantiating ShareASaleGenericApi for: %s", s_entity);
    return new ShareASaleGenericApi(s_entity);
  }

  var that = this;

  this.entity = s_entity ? s_entity.toLowerCase() : 'ominto';
  this.client = require('./api')(this.entity);
  this.eventName = (this.entity !== 'ominto' ? this.entity + '-' : '') + 'shareasale';

  /**
   * Retrieve all merchant information from ShareASale datafeed including their cashback data and coupons/deals.
   * @returns {undefined}
   */
  this.getMerchants = singleRun(function*() {
    debug('scanning all merchants');
    const results = {
      merchants: yield that.client.getMerchants(),
      cashback: yield that.client.getMerchantStatus(),
      deals: yield that.client.getDeals(),
    };

    const merchants = merge(results);

    return yield sendEvents.sendMerchants(that.eventName, merchants);
  });

  /**
   * Retrieve all commissions details (sales) via activity details + ledger report.
   * TODO: Figure out if ledger report includes pending sales already - maybe "activity" report is obsolete.
   * Otherwise use activity report and extend data with ledger report.
   * @returns {undefined}
   */
  this.getCommissionDetails = singleRun(function*() {
    let response = {};
    let startDate = new Date(Date.now() - (90 * 86400 * 1000));
    let endDate = new Date(Date.now() - (60 * 1000));
    let params = {dateStart: startDate, dateEnd: endDate};

    // get activities first - format/transform/clean them
    response = yield that.client.getActivityDetails(params);

    let activityTransactions = ary(response).map(transformActivity).filter(exists);
    activityTransactions = _.transform(activityTransactions, function(res, item, key) {
      res[item.transaction_id] = item;
    }, {});

    // get ledger report - format/transform/clean them
    response = yield that.client.getLedgerReport();
    let ledgerTransactions = ary(response).map(transformLedger).filter(exists);
    ledgerTransactions = _.transform(ledgerTransactions, function(res, item, key) {
      res[item.transaction_id] = item;
    }, {});

    // Now merge them, so ledger overwrites possible existing acitivies
    const transactions = _.values(_.merge({}, activityTransactions, ledgerTransactions)).filter(exists);

    return yield sendEvents.sendCommissions(that.eventName, transactions);
  });
};

/**
 * Transforms the activity items into a commissions object.
 * @param {Object} o_obj  A single activity object
 * @returns {Object}
 */
function transformActivity (o_obj) {
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
}

/**
 * Transforms the ledger report items into a commissions object.
 * Skips item of type "Affiliate Payment".
 * @param {Object} o_obj  A single ledger report object
 * @returns {Object}
 */
function transformLedger (o_obj) {
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
}

module.exports = ShareASaleGenericApi;
