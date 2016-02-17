"use strict";

const _ = require('lodash');
const debug = require('debug')('omgpm:processor');
const moment = require('moment');
const sendEvents = require('./support/send-events');
const singleRun = require('./support/single-run');

const merge = require('./support/easy-merge')('PID', {
  coupons: 'ProgramId',
});
const isNum = /^\d+$/;
const STATUS_MAP = {
  'Pending': 'initiated',
  'Rejected': 'cancelled',
  'Validated': 'confirmed'
};

const taskCache = {};
const OmgPmGenericApi = function(s_region, s_entity) {
  if (!s_region) throw new Error("OmgPm Generic API needs region!");

  const region = s_region.toLowerCase();
  const entity = s_entity ? s_entity.toLowerCase() : 'ominto';
  const eventName = (entity !== 'ominto' ? entity + '-' : '') + 'omgpm-' + region;

  if (taskCache[eventName]) return taskCache[eventName];

  var tasks = {
    client: require('./api-clients/omgpm-legacy')(entity, region),
    region: region,
    entity: entity,
    eventName: eventName,
  };

  tasks.getMerchants = singleRun(function* () {
    const results = yield {
      merchants: tasks.client.getMerchants(),
      coupons: tasks.client.getCoupons()
    };
    const merchants = merge(results);

    return yield sendEvents.sendMerchants(tasks.eventName, merchants);
  });

  tasks.getCommissionDetails = singleRun(function* (){
    const start = moment().subtract(90, 'days');
    const end = new Date();
    const commissions = yield tasks.client.getTransactions(start, end);
    const events = commissions.map(prepareCommission.bind(null, tasks.region));

    return yield sendEvents.sendCommissions(tasks.eventName, events);
  });

  taskCache[eventName] = tasks;

  return tasks;
};

function prepareCommission(region, o_obj) {
  const event = {
    transaction_id: o_obj.TransactionID,
    outclick_id: o_obj.UID,
    purchase_amount: o_obj.TransactionValue,
    commission_amount: o_obj.SR,
    currency: (o_obj.Currency || '').trim(),
    state: isNum.test(o_obj.Paid) ? 'paid' : STATUS_MAP[o_obj.Status],
    effective_date: o_obj.Status === 'Pending' ? new Date(o_obj.TransactionTime) : 'auto',
  };

  return event;
}

module.exports = OmgPmGenericApi;
