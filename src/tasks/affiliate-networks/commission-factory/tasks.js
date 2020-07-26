"use strict";

/*
 * Note for transactions api, even the documentation suggest that attribute "ReportedCurrencyCode"
 * will keep the ISO2 currency code, so far that value is alway reported as "null".
 * Pending request to their support, so far we assume (as in dubli) a fixed currency of AUD.
 */

const _ = require('lodash');
const co = require('co');
const debug = require('debug')('commissionfactory:processor');
const moment = require('moment');
const querystring = require('querystring');
const utils = require('ominto-utils');
const sendEvents = require('../support/send-events');
const singleRun = require('../support/single-run');

const AFFILIATE_NAME = 'commissionfactory';

const merge = require('../support/easy-merge')('Id', {
  coupons: 'MerchantId',
  links: 'MerchantId'
});

const MERCHANT_URL = '/Merchants?status=Joined&commissionType=Percent per Sale';
const COUPONS_URL = '/Coupons';
const PROMOTIONS_URL = '/Promotions';

const STATUS_MAP = {
  Approved: 'confirmed',
  Pending: 'initiated',
  Void: 'cancelled'
};

const CommissionFactoryGernericApi = function(s_entity) {
  if (!(this instanceof CommissionFactoryGernericApi)) {
    debug("instantiating CommissionFactoryGernericApi for: %s", s_entity);
    return new CommissionFactoryGernericApi(s_entity);
  }

  var that = this;

  this.entity = s_entity ? s_entity.toLowerCase() : 'ominto';
  this.client = require('./api')(this.entity);
  this.eventName = (this.entity !== 'ominto' ? this.entity + '-' : '') + 'commissionfactory';

  this.getMerchants = singleRun(function*() {
    let merchantsData = yield that.client.get(MERCHANT_URL);
    let coupons = yield that.client.get(COUPONS_URL);
    let links = yield that.client.get(PROMOTIONS_URL);


    let results = {
      merchants: merchantsData,
      coupons: coupons,
      links: links
    };

    let merchants = merge(results);
    return yield sendEvents.sendMerchants(that.eventName, merchants);
  });

  this.getCommissionDetails = singleRun(function* () {
    const start = moment().subtract(90, 'days').toDate();
    const end = moment().toDate();
    const url = getTransactionsUrl(start, end);
    const events = (yield that.client.get(url)).map(prepareCommission);
    return yield sendEvents.sendCommissions(that.eventName, events);
  });
};

function getTransactionsUrl(start, end) {
  return '/Transactions?' + querystring.stringify({
    fromDate: start.toISOString(),
    toDate: end.toISOString()
  });
}

function prepareCommission(o_obj) {

  // http://dev.commissionfactory.com/V1/Affiliate/Types/Transaction/
  // using auto as date when a transactions status is "Approved" or "Void" added a bug.
  // hence using "o_obj.DateModified" for "Approved" transactions & "Void" transactions
  // instead. (check STATUS_MAP for statuses)
  // also changed the state(status) field for incoming transactions

  var _date = 'auto';
  if(o_obj.Status === 'Pending')
    _date = new Date(o_obj.DateCreated);
  else if(o_obj.Status === 'Approved' || o_obj.Status === 'Void')
    _date = new Date(o_obj.DateModified);

  const event = {
    affiliate_name: AFFILIATE_NAME,
    merchant_name: o_obj.MerchantName || '',
    merchant_id: o_obj.MerchantId || '',
    transaction_id: o_obj.Id,
    order_id: o_obj.OrderId,
    outclick_id: o_obj.UniqueId,
    purchase_amount: o_obj.SaleValue,
    commission_amount: o_obj.Commission,
    currency: (o_obj.ReportedCurrencyCode===null) ? 'aud' : o_obj.ReportedCurrencyCode, // TODO: double check with CF always aud or have them fix their api.
    //state: STATUS_MAP[o_obj.TransactionStatus],
    //date: o_obj.TransactionStatus === 'Pending' ? new Date(o_obj.DateCreated) : "auto"
    state: STATUS_MAP[o_obj.Status],
    effective_date: _date
  };
  return event;
}

module.exports = CommissionFactoryGernericApi;
