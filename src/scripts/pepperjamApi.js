"use strict";

const _ = require('lodash');
const co = require('co');
const debug = require('debug')('pepperjam:processor');
const utils = require('ominto-utils');
const moment = require('moment');
const sendEvents = require('./support/send-events');
const singleRun = require('./support/single-run');

const client = require('./api-clients/pepperjam')();

const merge = require('./support/easy-merge')('id', {
  coupons: 'program_id',
  links: 'program_id',
  generic: 'program_id'
});

var getMerchants = singleRun(function*(){
  const results = yield {
    merchants: client.getPaginated('/publisher/advertiser', {status:'joined'}),
    coupons: client.getPaginated('/publisher/creative/coupon'),
    links: client.getPaginated('/publisher/creative/text'),
    generic: client.getPaginated('/publisher/creative/generic')
  };

  const merchants = merge(results);
  yield sendEvents.sendMerchants('pepperjam', merchants);
});

const exists = x => !!x;
var getCommissionDetails = singleRun(function* () {
  const startDate = moment().subtract(3, 'days').format('YYYY-MM-DD');
  const endDate = moment().format('YYYY-MM-DD');
  const results = yield client.getPaginated('/publisher/report/transaction-details',
    {startDate:startDate, endDate:endDate});
  const events = results.map(prepareCommission).filter(exists);
  return yield sendEvents.sendCommissions('pepperjam', events);
});

const STATE_MAP = {
  paid: 'paid',
  pending: 'initiated',
  locked: 'confirmed',
  delayed: 'confirmed',
  unconfirmed: 'initiated'
};

function prepareCommission(o_obj) {
  const event = {
    transaction_id: o_obj.transaction_id,
    outclick_id: o_obj.sid,
    currency: 'usd',
    purchase_amount: o_obj.sale_amount,
    commission_amount: o_obj.commission,
    state: STATE_MAP[o_obj.status],
    effective_date: o_obj.date
  };
  return event;
}

module.exports = {
  getMerchants: getMerchants,
  getCommissionDetails: getCommissionDetails
};
