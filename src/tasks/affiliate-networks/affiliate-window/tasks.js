"use strict";

const _ = require('lodash');
const co = require('co');
const debug = require('debug')('affiliatewindow:processor');
const sendEvents = require('./support/send-events');
const singleRun = require('./support/single-run');
const moment = require('moment');

// helper
const ary = x => _.isArray(x) ? x : [x];

const AffiliateWindowGenericApi = function(s_entity) {
  if (!(this instanceof AffiliateWindowGenericApi)) {
    debug("instantiating AffiliateWindowGenericApi for: %s", s_entity);
    return new AffiliateWindowGenericApi(s_entity);
  }

  var that = this;

  this.entity = s_entity ? s_entity.toLowerCase() : 'ominto';
  this.client = require('./api-clients/affiliatewindow')(this.entity);
  this.eventName = (this.entity !== 'ominto' ? this.entity + '-' : '') + 'affiliatewindow';

  this.getMerchants = singleRun(function*() {
    yield that.client.setup();
    var merchants = (yield that.doApiMerchants()).map(m => ({merchant:m}));
    yield that.doApiCashback(merchants);
    return yield sendEvents.sendMerchants(that.eventName, merchants);
  });

  this.getCommissionDetails = singleRun(function* () {
    yield that.client.setup();
    const endDate = new Date(Date.now() - (60 * 1000));
    const startDate = moment().subtract(75, 'days').toDate();
    const transactionRanges = getRanges(startDate, endDate);
    const validationRanges = getRanges(startDate, endDate);
    let results = [];

    for (let i = 0; i < transactionRanges.length; i++) {
      let range = transactionRanges[i];
      results = results.concat(yield that.doApiTransactions(range.start, range.end, 'transaction'));
    }

    for (let i = 0; i < validationRanges.length; i++) {
      let range = validationRanges[i];
      results = results.concat(yield that.doApiTransactions(range.start, range.end, 'validation'));
    }

    const events = _.uniq(results, false, x => x.iId).map(prepareCommission);

    return yield sendEvents.sendCommissions(that.eventName, events);
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
    transaction_id: o_obj.iId,
    outclick_id: o_obj.sClickref,
    currency: o_obj.mCommissionAmount.sCurrency,
    purchase_amount: o_obj.mSaleAmount.dAmount,
    commission_amount: o_obj.mCommissionAmount.dAmount,
  };

  if (o_obj.bPaid === "true") {
    event.state = 'paid';
    event.effective_date = new Date(o_obj.dValidationDate);
    return event;
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
