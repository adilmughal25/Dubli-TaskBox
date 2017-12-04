"use strict";

const _ = require('lodash');
const moment = require('moment');
const sendEvents = require('../support/send-events');
const singleRun = require('../support/single-run');

const AFFILIATE_NAME = 'adservice-';

const taskCache = {};

const AdserviceGenericApi = function(s_region, s_entity) {
  if (!s_region) throw new Error("Adservice Generic API needs region!");

  const region = s_region.toLowerCase();
  const entity = s_entity ? s_entity.toLowerCase() : 'dubli';
  const eventName = (entity !== 'dubli' ? entity + '-' : '') + 'adservice-' + region;

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
    const start = moment().subtract(90, 'days');
    const end = new Date();
    const commissions = yield tasks.client.getTransactions(start, end);
    //const events = commissions.map(prepareCommission.bind(null, tasks.region));

    return yield sendEvents.sendCommissions(tasks.eventName, commissions);
  });

  taskCache[eventName] = tasks;

  return tasks;
  
} 

module.exports = AdserviceGenericApi;
