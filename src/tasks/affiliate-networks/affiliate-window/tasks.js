"use strict";

const _ = require('lodash');
const co = require('co');
const debug = require('debug')('affiliatewindow:processor');
const sendEvents = require('../support/send-events');
const singleRun = require('../support/single-run');
const moment = require('moment');

const utils = require('ominto-utils');
const configs = require('../../../../configs.json');
const utilsDataClient = utils.restClient(configs.data_api);

const AFFILIATE_NAME = 'affiliatewindow';

// helper
const ary = x => _.isArray(x) ? x : [x];
const exists = x => !!x;

const AffiliateWindowGenericApi = function(s_entity) {
  if (!(this instanceof AffiliateWindowGenericApi)) {
    debug("instantiating AffiliateWindowGenericApi for: %s", s_entity);
    return new AffiliateWindowGenericApi(s_entity);
  }

  var that = this;

  this.entity = s_entity ? s_entity.toLowerCase() : 'ominto';
  this.client = require('./api')(this.entity);
  this.eventName = (this.entity !== 'ominto' ? this.entity + '-' : '') + 'affiliatewindow';

  this.getMerchants = singleRun(function*() {
    yield that.client.setup();
    var merchants = (yield that.doApiMerchants()).map(m => ({merchant:m}));
    yield that.doApiCashback(merchants);
    merchants = yield that.doApiDeals(merchants);

     return yield sendEvents.sendMerchants(that.eventName, merchants);
  });

  this.getCommissionDetails = singleRun(function* () {
    yield that.client.setup();
    let results = [];
    let allCommissions = [];

    let taskDate = yield utilsDataClient.get('/getTaskDateByAffiliate/' + AFFILIATE_NAME, true, this);

    if (taskDate.body && taskDate.body !== "Not Found") {
      let startCount = moment().diff(moment(taskDate.body.start_date), "days")
      let endCount = moment().diff(moment(taskDate.body.end_date), "days");
      allCommissions = yield that.getCommissionsByDate(startCount, endCount);
      yield utilsDataClient.patch('/inactivateTask/' + AFFILIATE_NAME, true, this);
    }

    const endDate = new Date(Date.now() - (60 * 1000));
    const startDate = moment().subtract(90, 'days').toDate();
    const transactionRanges = getRanges(startDate, endDate);
    const validationRanges = getRanges(startDate, endDate);

    for (let i = 0; i < transactionRanges.length; i++) {
      let range = transactionRanges[i];
      results = results.concat(yield that.doApiTransactions(range.start, range.end, 'transaction'));
    }

    for (let i = 0; i < validationRanges.length; i++) {
      let range = validationRanges[i];
      results = results.concat(yield that.doApiTransactions(range.start, range.end, 'validation'));
    }

    allCommissions = allCommissions.concat(results)
    const events = _.uniq(allCommissions, false, x => x.iId).map(prepareCommission);

    return yield sendEvents.sendCommissions(that.eventName, events);
  });

  this.getCommissionsByDate = co.wrap(function* (fromCount, toCount) {
    let startDate;
    let endDate;
    let allCommissions = [];
    let results = [];
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
        startDate = moment().subtract(startCount, 'days').toDate();
        endDate = moment().subtract(endCount, 'days').toDate();
        const transactionRanges = getRanges(startDate, endDate);
        const validationRanges = getRanges(startDate, endDate);

        for (let i = 0; i < transactionRanges.length; i++) {
          let range = transactionRanges[i];
          results = results.concat(yield that.doApiTransactions(range.start, range.end, 'transaction'));
        }

        for (let i = 0; i < validationRanges.length; i++) {
          let range = validationRanges[i];
          results = results.concat(yield that.doApiTransactions(range.start, range.end, 'validation'));
        }
        allCommissions = allCommissions.concat(results);

        endCount = (startCount - endCount >= 90) ? endCount - 90 : toCount;
        startCount = startCount - 90;
      }

      debug('finish');
    } catch (e) {
      console.log(e);
    }
    return allCommissions;
  });

  this.doApiMerchants = co.wrap(function* (){
    var response = yield that.client.getMerchantList({sRelationship:'joined'});
    return ary(response.getMerchantListReturn.Merchant);
  });

  this.doApiCashback = co.wrap(function* (a_merchants) {
    for (var i = 0; i < a_merchants.length; i++) {
      var rec = a_merchants[i];
      var merchant = rec.merchant;
      var cg = yield that.client.getCommissionGroupList({iMerchantId: merchant.iId});
      cg = ary(cg.getCommissionGroupListReturn.CommissionGroup);
      merchant.commissions = cg;
    }
  });

  this.doApiDeals = co.wrap(function* (a_merchants){
    var promotions = yield that.client.getDeals();
    var results = [];
    for (var i = 0; i < a_merchants.length; i++) {
      var rec = a_merchants[i];
      var merchant = rec.merchant;
      merchant.promotions = [];
      //var cg = [];
      promotions.forEach(p => {
        if(p["Advertiser ID"] == merchant.iId) {
          merchant.promotions.push(p);
        }
      });

      results.push({ merchant: merchant });
    }

    return results;
  });

  this.doApiTransactions = co.wrap(function* (start, end, type) {
    let transactions = [];
    let perPage = 1000;
    let count = 0;

    while (true) {
      debug("Getting transactions [type:"+type+", page:"+ (1 + count) +
            "] for date range: " + start.toISOString() + "-" + end.toISOString());
      const results = yield that.client.getTransactionList({
        dStartDate: start.toISOString(),
        dEndDate: end.toISOString(),
        sDateType: type,
        iLimit: perPage,
        iOffset: perPage * count
      });

      const items = ary(results.getTransactionListReturn.Transaction || []);
      transactions = transactions.concat(items);
      if (transactions.length >= results.getTransactionListCountReturn.iRowsAvailable || items.length === 0) {
        break;
      }
      count++;
    }

    return transactions;
  });
};

function mergeResults(o_obj) {
  var res = {};
  var make = k => res[k] || (res[k] = { coupons: [] });
  var set = (i, k, v) => make(i)[k] = v;
  var add = (i, k, v) => make(i)[k].push(v);

  if (Array.isArray(o_obj.merchants)) {
    o_obj.merchants.forEach(m => { set(m.merchant.iId, 'merchant', m)});
  }
  else
    set(o_obj.merchants.programId, 'merchant', o_obj.merchants);

  o_obj.coupons.forEach(c => add(c['Advertiser ID'], 'coupons', c));
  //o_obj.coupons.forEach(c => c.Starts = new Date(c.Ends).toISOString());
  //o_obj.coupons.forEach(c => c.Ends = new Date(c.Ends).toISOString());
  return _.values(res).filter(x => 'merchant' in x);
}

const STATE_MAP = {
  'pending': 'initiated',
  'confirmed': 'confirmed',
  'declined': 'cancelled'
};
const DATE_MAP = {
  'pending': 'dTransactionDate',
  'confirmed': 'dValidationDate',
  'declined': 'dValidationDate'
};

function prepareCommission(o_obj) {

  const event = {
    affiliate_name: AFFILIATE_NAME,
    merchant_name: '',
    merchant_id: o_obj.iMerchantId || '',
    transaction_id: o_obj.iId,
    order_id: o_obj.iId,
    outclick_id: o_obj.sClickref,
    currency: o_obj.mCommissionAmount.sCurrency,
    purchase_amount: o_obj.mSaleAmount.dAmount,
    commission_amount: o_obj.mCommissionAmount.dAmount,
    cashback_id: o_obj.aTransactionParts.TransactionPart.sCommissionGroupName || ""
  };

  if (o_obj.bPaid === "true") {
    event.state = 'paid';
    event.effective_date = new Date(o_obj.dValidationDate);
  } else {
    let dateField = DATE_MAP[o_obj.sStatus];
    event.state = STATE_MAP[o_obj.sStatus];
    event.effective_date = new Date(o_obj[dateField]);
  }

  return event;
}

const oneDay = 86400 * 1000;
const maxRange = 28 * oneDay;
function getRanges(startDate, endDate) {
  const diff = endDate.getTime() - startDate.getTime();
  if (diff < maxRange) return [{start:startDate, end:endDate}];
  const ranges = [];
  let remaining = diff;
  let curEnd = endDate;

  while (remaining > maxRange) {
    let curStart = new Date(curEnd.getTime() - maxRange);
    ranges.push({start:curStart, end:curEnd});
    remaining = (curStart.getTime() - startDate.getTime());
    curEnd = new Date(curStart.getTime() - 1);
  }

  ranges.push({start:startDate, end:curEnd});
  return ranges;
}

module.exports = AffiliateWindowGenericApi;
