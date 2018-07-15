"use strict";

const _ = require('lodash');
const moment = require('moment');
const sendEvents = require('../support/send-events');
const singleRun = require('../support/single-run');

const AFFILIATE_NAME = 'linkprice-';
const STATUS_MAP = {
  'pending': 'initiated',
  'reject': 'cancelled',
  'approve': 'confirmed'
};

const taskCache = {};

const LinkpriceGenericApi = function(s_region, s_entity) {
  if (!s_region) throw new Error("Linkprice Generic API needs region!");

  const region = s_region.toLowerCase();
  const entity = s_entity ? s_entity.toLowerCase() : 'dubli';
  const eventName = (entity !== 'dubli' ? entity + '-' : '') + 'linkprice';

  if (taskCache[eventName]) return taskCache[eventName];

  var tasks = {
    client: require('./api')(entity, region),
    region: region,
    entity: entity,
    eventName: eventName,
  };

  tasks.getMerchants = singleRun(function* () {
    const result = yield {
      merchants: tasks.client.getMerchants()
    };

    return yield sendEvents.sendMerchants(tasks.eventName, result.merchants);
  });

  tasks.getCommissionDetails = singleRun(function* (){
    const startDate = moment().subtract(90, 'days');
    const endDate = new Date();
    const commissions = yield tasks.client.getTransactions(startDate, endDate);
    const events = commissions.map(prepareCommission.bind(null, tasks.region));

    return yield sendEvents.sendCommissions(tasks.eventName, events);
  });

  taskCache[eventName] = tasks;

  return tasks;

}


function prepareCommission(region, transaction) {

    const event = {
      affiliate_name: AFFILIATE_NAME + region,
      merchant_name: transaction.camp_title,
      merchant_id: transaction.camp_id,
      transaction_id: transaction.record_id,
      order_id: transaction.order_id,
      outclick_id: transaction.sub,
      purchase_amount: transaction.amount,
      commission_amount: transaction.pay_for_sale,
      currency: transaction.currency_name,
      state: STATUS_MAP[transaction.status] ? STATUS_MAP[transaction.status] : '',
      effective_date: transaction.stamp
    };

    return event;
  }


module.exports = LinkpriceGenericApi;
