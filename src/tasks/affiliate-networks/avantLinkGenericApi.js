"use strict";

/*
 * http://classic.avantlink.com/api.php?help=1&module=AffiliateReport
 * Interpretion of commission details data - has to be confirmed :
 *  "Custom_Tracking_Code" => outclick_id => only alphanumeric characters, nothing else
 *  "AvantLink_Transaction_Id" => internal AvantLink id, NOT unique between same transaction status change; ie: "SALE-12331395" vs. "ADJUSTMENT-660153" of same sale
 *  "Order_Id" => transaction_id => Seems to be a unique TID between all status updated of same order?!
 *  "Transaction_Type" => status => could be used to map into a status.
 *     known types: SALE,RETURN,FRAUD,CANCELED,BONUS,ADJUSTMENT
 *  currency seems to be *always* USD, even in CA and AU programs?
 *
 * How to deal with ADJUSTMENT?
 */

const _ = require('lodash');
const co = require('co');
const debug = require('debug')('avantlink:processor');
const utils = require('ominto-utils');
const sendEvents = require('./support/send-events');
const singleRun = require('./support/single-run');
const clientPool = require('./api-clients/avantlink');

const merge = require('./support/easy-merge')('lngMerchantId', {
  promos: 'Merchant_Id' // includes all type of promotions such as text, coupons, ...
});

const taskCache = {};

function setup(s_region) {
  if (taskCache[s_region]) return taskCache[s_region];

  var tasks = {};

  // get all merchant information
  tasks.getMerchants = singleRun(function* () {
    let clientM = clientPool.getClient(s_region, 'merchants');
    let clientP = clientPool.getClient(s_region, 'promos');

    let results = yield {
      merchants: clientM.getData().then(hasPercentage),
      promos: clientP.getData().then(preparePromos)
    };
    let merchants = merge(results);

    yield sendEvents.sendMerchants('avantlink-'+s_region, merchants);
  });

  // get commission report
  tasks.getCommissionDetails = singleRun(function* () {
    let clientC = clientPool.getClient(s_region, 'commissions');
    let transactions = [];
    let events = [];
    let startDate = new Date(Date.now() - (30 * 86400 * 1000));
    let endDate = new Date(Date.now() - (60 * 1000));
    const exists = x => !!x;

    debug("fetching all transactions between %s and %s", startDate, endDate);

    transactions = yield clientC.getData({date_begin: startDate, date_end:endDate});
    events = transactions.map(prepareCommission).filter(exists);

    yield sendEvents.sendCommissions('avantlink-'+s_region, events);
  });

  taskCache[s_region] = tasks;

  return tasks;
}

/**
 * Filter out any merchant without a percentage commission structure.
 * (No fixed commissions supported yet)
 * @param {Object} o_merchants  The individual merchant object from AvantLink API response
 * @returns {Object}
 */
function hasPercentage(o_merchants) {
  return o_merchants.filter(m => m.strActionCommissionType === 'percent');
}

/**
 * Little filter for to many Promos - excludes defined promot types from api response.
 * Note: its either get all and filter here or fetch individually from api type by type and then merge.
 *
 * @param {Object} o_promo  The individual promotion/ad object from AvantLink AdSearch API response
 * @returns {Object}
 */
const promoTypesFilter = ['video', 'image', 'flash', 'html', 'dotd-html']; // type to be removed/ignored
function preparePromos(o_promo) {
  return o_promo.filter(p => _.indexOf(promoTypesFilter, p.Ad_Type)  === -1);
}

const STATE_MAP = {
  sale: 'initiated',  // i would say its "confirmed" but do not know implications on data API when transaction gets updated or other restrictions.
  return: 'cancelled',
  fraud: 'cancelled',
  canceled: 'cancelled',
  bonus: 'paid', // bonus commission to Affiliate - nothing for customers - ignore
  adjustment: 'initiated',  // i would say its "confirmed" but do not know implications on data API when transaction gets updated or other restrictions.
};

/**
 * Function to prepare a single commission transaction for our data event.
 * @param {Object} o_obj  The individual commission transaction straight from AdCell
 * @returns {Object}
 */
const amountPregPattern = /([^0-9\\.])/gi;  // to clean amounts like "($123.45)", "$432.12", ...
function prepareCommission(o_obj) {
  var event = {
    affiliate_name: o_obj.Merchant,
    transaction_id: o_obj.Order_Id,
    outclick_id: o_obj.Custom_Tracking_Code,
    currency: 'usd',
    purchase_amount: o_obj.Transaction_Amount.replace(amountPregPattern, ''),
    commission_amount: o_obj.Total_Commission.replace(amountPregPattern, ''),
    state: STATE_MAP[o_obj.Transaction_Type.toLowerCase()],
    effective_date: 'auto'
  };
  return event;
}


module.exports = setup;