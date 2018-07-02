"use strict";

const _ = require('lodash');
const moment = require('moment');
const sendEvents = require('../support/send-events');
const singleRun = require('../support/single-run');
const client = require('./api');
const co = require('co');


const AFFILIATE_NAME = 'direct-partner';
const MERCHANT_NAME = 'ali-express';
const taskCache = {};

const STATUS_MAP = {
  //'pending': 'initiated',
  'Refund Orders': 'cancelled',
  'Completed Payments': 'confirmed',
  'Completed Orders': 'confirmed',
};

const AliexpressGenericApi = function(s_entity) {
  if (!(this instanceof AliexpressGenericApi)) return new AliexpressGenericApi(s_entity);

  var that = this;

  this.entity = s_entity ? s_entity.toLowerCase() : 'ominto';
  this.eventName = (this.entity !== 'ominto' ? this.entity + '-' : '') + 'ali-express';

  const debug = require('debug')(this.eventName + ':processor');

  this.getCommissionDetails = co.wrap(function* () {
    const clientC = client(that.entity, that.region, 'commissions');
    //const currency = CURRENCY_MAP[that.region];
    const periods = commissionPeriods(31, 3); // three 31-day periods
    let all = [];

    for (let i = 0; i < periods.length; i++) {
      const p = periods[i];
      let results = yield clientC.getCommission(p.start, p.end);
      all = all.concat(results);
    }

    const prep = prepareCommission.bind(null);
    const exists = x => !!x;
    const events = all.map(prep).filter(exists);

    return yield sendEvents.sendCommissions(that.eventName, events);
  });
}

function commissionPeriods(i_days, i_count) {
  let current = moment().startOf('day');
  let vals = [];

  for (let i = 0; i < i_count; i++) {
    let now = current.format('YYYY-MM-DD');
    current = current.subtract(i_days, 'days');
    let then = current.format('YYYY-MM-DD');
    vals.push({start:then, end:now});
  }

  return vals;
}


function prepareCommission(transaction) {
    const extraParams = JSON.parse(transaction.extraParams);

    const event = {
      affiliate_name: AFFILIATE_NAME,
      merchant_name: MERCHANT_NAME,
      merchant_id: '',
      currency: 'usd',
      transaction_id: transaction.orderNumber,
      order_id: transaction.orderNumber,
      outclick_id: extraParams.dp,
      purchase_amount: transaction.paymentAmount,
      commission_amount: transaction.estimatedCommission,
      state: STATUS_MAP[transaction['orderStatus']] ? STATUS_MAP[transaction['orderStatus']] : '',
      effective_date: moment(transaction.orderTime, 'MM-DD-YYYY HH:mm:ss').format('YYYY-MM-DDT00:00:00.000Z'),
    };

    return event;
  }


module.exports = AliexpressGenericApi;
