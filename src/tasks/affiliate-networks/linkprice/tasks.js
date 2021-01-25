"use strict";

const _ = require('lodash');
const moment = require('moment');
const sendEvents = require('../support/send-events');
const singleRun = require('../support/single-run');

const utils = require('ominto-utils');
const configs = require('../../../../configs.json');
const utilsDataClient = utils.restClient(configs.data_api);

const AFFILIATE_NAME = 'linkprice';
// 100 (Normal) / 300(Apply cancel) / 310(Confirm cancel)
// / 200(Waiting commission)/ 210(confirm commission
// MER) / 220(confirm commission AFF)
const STATUS_MAP = {
  '100': 'initiated',
  '200': 'initiated',
  '300': 'initiated',
  '310': 'cancelled',
  '210': 'confirmed',
  '220': 'initiated'
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
    const allMerchants = yield tasks.client.getMerchants();
    const result = _.filter(allMerchants, merchant => merchant.status === 'APR');

    return yield sendEvents.sendMerchants(tasks.eventName, result);
  });

  tasks.getCommissionDetails = singleRun(function* (){
    let monthsToBeProcessed = 3;
    let taskDate = yield utilsDataClient.get('/getTaskDateByAffiliate/' + AFFILIATE_NAME, true, this);

    if (taskDate.body && taskDate.body !== "Not Found") {
      let startCount = moment().diff(moment(taskDate.body.start_date), "days")
      monthsToBeProcessed = Math.round(startCount / 30);
      yield utilsDataClient.patch('/inactivateTask/' + AFFILIATE_NAME, true, this);
    }
    const startDate = moment().subtract(monthsToBeProcessed, 'months');
    const endDate = moment().endOf('month');

    let commissions = [];
    for(let i = 0; i <= monthsToBeProcessed; i++) {
      let formattedDate = startDate.format('YYYYMM');
      let res = yield tasks.client.getTransactions(formattedDate);
      startDate.add(1,'month');
      commissions = commissions.concat(res);
    }

    //Ignoring all of the transactions having status of either 220 or 300
    commissions = _.filter(commissions, commission => commission.status != '220' && commission.status != '300');

    const events = commissions.map(prepareCommission.bind(null));

    return yield sendEvents.sendCommissions(tasks.eventName, events);
  });

  taskCache[eventName] = tasks;

  return tasks;

}


function prepareCommission(transaction) {

    const event = {
      affiliate_name: AFFILIATE_NAME,
      merchant_name: transaction.m_id,
      merchant_id: transaction.m_id,
      transaction_id: transaction.trlog_id,
      order_id: transaction.o_cd,
      outclick_id: transaction.user_id,
      purchase_amount: transaction.sales,
      commission_amount: transaction.commission,
      currency: 'krw',
      state: STATUS_MAP[transaction.status] ? STATUS_MAP[transaction.status] : '',
      effective_date: moment(transaction.create_time_stamp, 'YYYYMMDD').format('YYYY-MM-DD'),

    };

    return event;
  }


module.exports = LinkpriceGenericApi;
