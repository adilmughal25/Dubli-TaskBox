"use strict";

const _ = require('lodash');
const co = require('co');
const debug = require('debug')('pepperjam:processor');
const utils = require('ominto-utils');
const moment = require('moment');
const sendEvents = require('../support/send-events');
const singleRun = require('../support/single-run');

const AFFILIATE_NAME = 'pepperjam';

const exists = x => !!x;
const merge = require('../support/easy-merge')('id', {
  coupons: 'program_id',
  links: 'program_id',
  generic: 'program_id'
});

const STATE_MAP = {
  paid: 'paid',
  pending: 'initiated',
  locked: 'confirmed',
  delayed: 'confirmed',
  unconfirmed: 'initiated'
};

const PepperJamGenericApi = function(s_entity) {
  if (!(this instanceof PepperJamGenericApi)) {
    debug("instantiating PepperJamGenericApi for: %s", s_entity);
    return new PepperJamGenericApi(s_entity);
  }

  var that = this;

  this.entity = s_entity ? s_entity.toLowerCase() : 'ominto';
  this.client = require('./api')(this.entity);
  this.eventName = (this.entity !== 'ominto' ? this.entity + '-' : '') + 'pepperjam';

  this.getMerchants = singleRun(function*(){
    const results = yield {
      merchants: that.client.getPaginated('/publisher/advertiser', {status:'joined'}),
      coupons: that.client.getPaginated('/publisher/creative/coupon'),
      links: that.client.getPaginated('/publisher/creative/text'),
      generic: that.client.getPaginated('/publisher/creative/generic')
    };

    const merchants = merge(results);
    return yield sendEvents.sendMerchants(that.eventName, merchants);
  });

  this.getCommissionDetails = singleRun(function* () {
    const startDate = moment().subtract(90, 'days').format('YYYY-MM-DD');
    const endDate = moment().format('YYYY-MM-DD');
    const results = yield that.client.getPaginated('/publisher/report/transaction-details', {startDate:startDate, endDate:endDate});
    const events = results.map(prepareCommission).filter(exists);
    return yield sendEvents.sendCommissions(that.eventName, events);
  });
};

function prepareCommission(o_obj) {

  const event = {
    affiliate_name: AFFILIATE_NAME,
    merchant_name: o_obj.program_name || '',
    merchant_id: o_obj.program_id || '',
    transaction_id: o_obj.transaction_id,
    order_id: o_obj.order_id,
    outclick_id: o_obj.sid,
    currency: 'usd',
    purchase_amount: o_obj.sale_amount,
    commission_amount: o_obj.commission,
    state: STATE_MAP[o_obj.status],
    effective_date: o_obj.date
  };

  return event;
}

module.exports = PepperJamGenericApi;
