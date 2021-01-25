"use strict";

/*
 * http://classic.avantlink.com/api.php?help=1&module=AffiliateReport
 *  "Transaction_Type" => status => could be used to map into a status.
 *     known types: SALE,RETURN,FRAUD,CANCELED,BONUS,ADJUSTMENT
 *
 * How to deal with ADJUSTMENT? (come in with negative amounts)
 *
 * Explanation from AvantLink:
 * SALE - Sale
 * ADJUSTMENT - A Partial or full Amount manually adjusted
 * RETURN or CANCELLED indicate the order was returned, or cancelled
 * FRAUD indicates it was cancelled on your side due to fraud
 */

const _ = require('lodash');
const co = require('co');
const debug = require('debug')('avantlink:processor');
const utils = require('ominto-utils');
const sendEvents = require('../support/send-events');
const singleRun = require('../support/single-run');
const clientPool = require('./api');

const configs = require('../../../../configs.json');
const utilsDataClient = utils.restClient(configs.data_api);
const moment = require('moment');

const AFFILIATE_NAME = 'avantlink-';

const merge = require('../support/easy-merge')('lngMerchantId', {
  promos: 'Merchant_Id' // includes all type of promotions such as text, coupons, ...
});

const taskCache = {};

function setup(s_region, s_entity) {
  let entity = s_entity ? s_entity.toLowerCase() : 'ominto';
  let eventName = (entity !== 'ominto' ? entity + '-' : '') + 'avantlink-' + s_region;

  if (taskCache[eventName]) return taskCache[eventName];

  var tasks = {};

  // get all merchant information
  tasks.getMerchants = singleRun(function* () {
    let clientM = clientPool.getClient(entity, s_region, 'merchants');
    let clientP = clientPool.getClient(entity, s_region, 'promos');

    let results = yield {
      merchants: clientM.getData().then(hasPercentage),
      promos: clientP.getData().then(preparePromos)
    };
    let merchants = merge(results);

    return yield sendEvents.sendMerchants(eventName, merchants);
  });

  // get commission report
  tasks.getCommissionDetails = singleRun(function* () {
    let clientC = clientPool.getClient(entity, s_region, 'commissions');
    let transactions = [];
    let events = [];
    let startDate = new Date(Date.now() - (90 * 86400 * 1000));
    let endDate = new Date(Date.now() - (60 * 1000));
    const exists = x => !!x;

    let allCommissions = [];

    let taskDate = yield utilsDataClient.get('/getTaskDateByAffiliate/' + AFFILIATE_NAME + s_region, true, this);

    if (taskDate.body && taskDate.body !== "Not Found") {
      let startCount = moment().diff(moment(taskDate.body.start_date), "days")
      let endCount = moment().diff(moment(taskDate.body.end_date), "days");
      allCommissions = yield tasks.getCommissionsByDate(startCount, endCount, clientC);
      yield utilsDataClient.patch('/inactivateTask/' + AFFILIATE_NAME + s_region, true, this);
    }

    debug("fetching all transactions between %s and %s", startDate, endDate);

    transactions = yield clientC.getData({date_begin: startDate, date_end:endDate});
    allCommissions = allCommissions.concat(transactions);
    events = allCommissions.map(prepareCommission.bind(null, s_region)).filter(exists);

    return yield sendEvents.sendCommissions(eventName, events);
  });

  tasks.getCommissionsByDate = co.wrap(function* (fromCount, toCount, clientC) {
    let startDate;
    let endDate;
    let allCommissions = [];
    try {

      let startCount = fromCount;
      let endCount = (fromCount - toCount > 90) ? fromCount - 90 : toCount;

      debug('start');

      while (true) {
        debug('inside while');
        if (startCount <= toCount) {
          break;
        }

        debug('start date --> ' + moment().subtract(startCount, 'days').toDate() + ' start count --> ' +startCount);
        debug('end date --> ' + moment().subtract(endCount, 'days').toDate() + ' end count --> ' +endCount);
        startDate = new Date(Date.now() - (startCount * 86400 * 1000));
        endDate = new Date(Date.now() - (endCount * 86400 * 1000));

        const commissions = yield clientC.getData({date_begin: startDate, date_end:endDate});
        allCommissions = allCommissions.concat(commissions);

        startCount = startCount - 90;
        endCount = (startCount - endCount > 90) ? fromCount - 90 : toCount;
      }

      debug('finish');
    } catch (e) {
      console.log(e);
    }
    return allCommissions;
  });

  taskCache[eventName] = tasks;

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
  sale: 'initiated',
  return: 'cancelled',
  fraud: 'cancelled',
  canceled: 'cancelled',
  bonus: 'paid', // bonus commission to Affiliate - nothing for customers - ignore
  adjustment: 'cancelled',  // i would say its "cancelled" but do not know implications on data API when transaction gets updated or other restrictions.
};

const CURRENCY_MAP = {
  us: 'usd',
  ca: 'cad',
  au: 'aud'
};

/**
 * Function to prepare a single commission transaction for our data event.
 * @param {Object} o_obj  The individual commission transaction straight from AdCell
 * @returns {Object}
 */
const amountPregPattern = /([^0-9\\.])/gi;  // to clean amounts like "($123.45)", "$432.12", ...
function prepareCommission(region, o_obj) {

  // http://classic.avantlink.com/api.php?help=1&module=AffiliateReport
  // 8 - Sales/Commissions (Detail)
  // using auto as date for a transactions added a bug. hence using "o_obj.Transaction_Date"
  // for all transactions instead. (check STATUS_MAP for statuses)

  var event = {
    affiliate_name: AFFILIATE_NAME + region,
    merchant_name: o_obj.Merchant || '',
    merchant_id: o_obj.Merchant_Id || '',
    transaction_id: o_obj.Order_Id,
    order_id: o_obj.Order_Id,
    outclick_id: o_obj.Custom_Tracking_Code,
    currency: CURRENCY_MAP[region],
    purchase_amount: o_obj.Transaction_Amount.replace(amountPregPattern, ''),
    commission_amount: o_obj.Total_Commission.replace(amountPregPattern, ''),
    state: STATE_MAP[o_obj.Transaction_Type.toLowerCase()],
    //effective_date: 'auto'
    effective_date: new Date(o_obj.Transaction_Date)
  };
  return event;
}


module.exports = setup;
