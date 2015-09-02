"use strict";

const _ = require('lodash');
const co = require('co');
const debug = require('debug')('affiliatewindow:processor');
const sendEvents = require('./support/send-events');
const singleRun = require('./support/single-run');
const moment = require('moment');
const client = require('./api-clients/affiliatewindow')();

// helper
const ary = x => _.isArray(x) ? x : [x];

var getMerchants = singleRun(function*() {
  yield client.setup();
  var merchants = (yield doApiMerchants()).map(m => ({merchant:m}));
  yield doApiCashback(merchants);
  yield sendEvents.sendMerchants('affiliatewindow', merchants);
});

var doApiMerchants = co.wrap(function* (){
  var response = yield client.getMerchantList({sRelationship:'joined'});
  return ary(response.getMerchantListReturn.Merchant);
});

var doApiCashback = co.wrap(function* (a_merchants) {
  for (var i = 0; i < a_merchants.length; i++) {
    var rec = a_merchants[i];
    var merchant = rec.merchant;
    var cg = yield client.getCommissionGroupList({iMerchantId: merchant.iId});
    cg = ary(cg.getCommissionGroupListReturn.CommissionGroup);
    merchant.commissions = cg;
  }
});

var getCommissionDetails = singleRun(function* () {
  yield client.setup();
  const endDate = new Date(Date.now() - (60 * 1000));
  const startDate = moment().subtract(75, 'days').toDate();
  const transactionRanges = getRanges(startDate, endDate);
  const validationRanges = getRanges(startDate, endDate);
  let results = [];

  for (let i = 0; i < transactionRanges.length; i++) {
    let range = transactionRanges[i];
    results = results.concat(yield doApiTransactions(range.start, range.end, 'transaction'));
  }

  for (let i = 0; i < validationRanges.length; i++) {
    let range = validationRanges[i];
    results = results.concat(yield doApiTransactions(range.start, range.end, 'validation'));
  }

  const events = _.uniq(results, false, x => x.iId).map(prepareCommission);

  yield sendEvents.sendCommissions('affiliatewindow', events);
});

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

var doApiTransactions = co.wrap(function* (start, end, type) {
  let transactions = [];
  let perPage = 1000;
  let count = 0;

  while (true) {
    debug("Getting transactions [type:"+type+", page:"+ (1 + count) +
      "] for date range: " + start.toISOString() + "-" + end.toISOString());
    const results = yield client.getTransactionList({
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

module.exports = {
  getMerchants: getMerchants,
  getCommissionDetails: getCommissionDetails
};
