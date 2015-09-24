"use strict";

const _ = require('lodash');
const co = require('co');
const debug = require('debug')('commissionfactory:processor');
const moment = require('moment');
const querystring = require('querystring');
const utils = require('ominto-utils');
const sendEvents = require('./support/send-events');
const singleRun = require('./support/single-run');

const merge = require('./support/easy-merge')('Id', {
  coupons: 'MerchantId',
  links: 'MerchantId'
});

const client = require('./api-clients/commissionfactory')();

const MERCHANT_URL = '/Merchants?status=Joined&commissionType=Percent per Sale';
const COUPONS_URL = '/Coupons';
const PROMOTIONS_URL = '/Promotions';

var getMerchants = singleRun(function*() {
  var results = yield {
    merchants: client.get(MERCHANT_URL),
    coupons: client.get(COUPONS_URL),
    links: client.get(PROMOTIONS_URL)
  };

  var merchants = merge(results);
  yield sendEvents.sendMerchants('commissionfactory', merchants);
});

function getTransactionsUrl(start, end) {
  return '/Transactions?' + querystring.stringify({
    fromDate: start.toISOString(),
    toDate: end.toISOString()
  });
}

var getCommissionDetails = singleRun(function* () {
  const start = moment().subtract(75, 'days').toDate();
  const end = moment().toDate();
  const url = getTransactionsUrl(start, end);
  const events = (yield client.get(url)).map(prepareCommission);
  yield sendEvents.sendCommissions('commissionfactory', events);
});

const STATUS_MAP = {
  Approved: 'confirmed',
  Pending: 'initiated',
  Void: 'cancelled'
};

function prepareCommission(o_obj) {
  const event = {
    transaction_id: o_obj.Id,
    outclick_id: o_obj.UniqueId,
    purchase_amount: o_obj.SaleValue,
    commission_amount: o_obj.Commission,
    currency: o_obj.ReportedCurrencyCode,
    state: STATUS_MAP[o_obj.TransactionStatus],
    date: o_obj.TransactionStatus === 'Pending' ? new Date(o_obj.DateCreated) : "auto"
  };
  return event;
}

module.exports = {
  getMerchants: getMerchants,
  getCommissionDetails: getCommissionDetails
};
