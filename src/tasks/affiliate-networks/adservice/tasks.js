"use strict";

const _ = require('lodash');
const co = require('co');
const moment = require('moment');
const sendEvents = require('../support/send-events');
const singleRun = require('../support/single-run');

const debug = require('debug')('adservice:processor');
const utils = require('ominto-utils');
const configs = require('../../../../configs.json');
const utilsDataClient = utils.restClient(configs.data_api);

const AFFILIATE_NAME = 'adservice-';
const STATUS_MAP = {
  'pending': 'initiated',
  'reject': 'cancelled',
  'approve': 'confirmed'
};

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
    const startDate = moment().subtract(90, 'days');
    const endDate = new Date();

    let allCommissions = [];

    let taskDate = yield utilsDataClient.get('/getTaskDateByAffiliate/' + AFFILIATE_NAME + tasks.region, true, this);

    if (taskDate.body && taskDate.body !== "Not Found") {
      let startCount = moment().diff(moment(taskDate.body.start_date), "days")
      let endCount = moment().diff(moment(taskDate.body.end_date), "days");
      allCommissions = yield tasks.getCommissionsByDate(startCount, endCount);
      yield utilsDataClient.patch('/inactivateTask/' + AFFILIATE_NAME + tasks.region, true, this);
    }

    const commissions = yield tasks.client.getTransactions(startDate, endDate);
    allCommissions = allCommissions.concat(commissions);
    const events = allCommissions.map(prepareCommission.bind(null, tasks.region));

    return yield sendEvents.sendCommissions(tasks.eventName, events);
  });

  tasks.getCommissionsByDate = co.wrap(function* (fromCount, toCount) {
    let startDate;
    let endDate;
    let allCommissions = [];
    try {

      let startCount = fromCount;
      let endCount = (fromCount - toCount > 90) ? fromCount - 90 : toCount;

      debug('start');

      while (true) {
        debug('inside while');
        if (startCount <= toCount) {
          break;
        }

        debug('start date --> ' + moment().subtract(startCount, 'days').toDate() + ' start count --> ' +startCount);
        debug('end date --> ' + moment().subtract(endCount, 'days').toDate() + ' end count --> ' +endCount);
        startDate = new Date(Date.now() - (startCount * 86400 * 1000));
        endDate = new Date(Date.now() - (endCount * 86400 * 1000));

        const commissions = yield tasks.client.getTransactions(startDate, endDate);
        allCommissions = allCommissions.concat(commissions);

        endCount = (startCount - endCount >= 90) ? endCount - 90 : toCount;
        startCount = startCount - 90;
      }

      debug('finish');
    } catch (e) {
      console.log(e);
    }
    return allCommissions;
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
  

module.exports = AdserviceGenericApi;
