"use strict";

const _ = require('lodash');
const co = require('co');
const debug = require('debug')('pepperjam:processor');
const utils = require('ominto-utils');
const moment = require('moment');
const sendEvents = require('../support/send-events');
const singleRun = require('../support/single-run');

const configs = require('../../../../configs.json');
const utilsDataClient = utils.restClient(configs.data_api);

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

    let allCommissions = [];

    let taskDate = yield utilsDataClient.get('/getTaskDateByAffiliate/' + AFFILIATE_NAME, true, this);

    if (taskDate.body && taskDate.body !== "Not Found") {
      let startCount = moment().diff(moment(taskDate.body.start_date), "days")
      let endCount = moment().diff(moment(taskDate.body.end_date), "days");
      allCommissions = yield that.getCommissionsByDate(startCount, endCount);
      yield utilsDataClient.patch('/inactivateTask/' + AFFILIATE_NAME, true, this);
    }

    const results = yield that.client.getPaginated('/publisher/report/transaction-details', {startDate:startDate, endDate:endDate});
    allCommissions = allCommissions.concat(results);
    const events = allCommissions.map(prepareCommission).filter(exists);
    return yield sendEvents.sendCommissions(that.eventName, events);
  });

  this.getCommissionsByDate = co.wrap(function* (fromCount, toCount) {
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
        startDate = moment().subtract(startCount, 'days').format('YYYY-MM-DD');
        endDate = moment().subtract(endCount, 'days').format('YYYY-MM-DD');

        const results = yield that.client.getPaginated('/publisher/report/transaction-details', {startDate:startDate, endDate:endDate});
        allCommissions = allCommissions.concat(results);

        endCount = (startCount - endCount >= 90) ? endCount - 90 : toCount;
        startCount = startCount - 90;
      }

      debug('finish');
    } catch (e) {
      console.log('Error --> ' + JSON.stringify(e));
    }
    return allCommissions;
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
