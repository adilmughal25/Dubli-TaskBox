"use strict";

const _ = require('lodash');
const co = require('co');
const moment = require('moment');
const utils = require('ominto-utils');
const sendEvents = require('../support/send-events');
const singleRun = require('../support/single-run');
const configs = require('../../../../configs.json');
const utilsDataClient = utils.restClient(configs.data_api);

const AFFILIATE_NAME = 'impactradius';

const merge = require('../support/easy-merge')('CampaignId', {
  promoAds: 'CampaignId',
  campaignAds: 'CampaignId'
});

const taskCache = {};
function ImpactRadiusGenericApi(s_whitelabel, s_region, s_entity) {
  if (!s_whitelabel) throw new Error("ImpactRadius Generic API needs whitelabel!");
  if (!(this instanceof ImpactRadiusGenericApi)) return new ImpactRadiusGenericApi(s_whitelabel, s_region, s_entity);

  this.region = s_region ? s_region.toLowerCase() : 'us';
  this.entity = s_entity ? s_entity.toLowerCase() : 'ominto';

  let _tag = s_whitelabel + '-' + this.entity+ '-' + this.region;
  if (taskCache[_tag]) return taskCache[_tag];

  var that = this;

  const tasks = {
    client: require('./api')(s_whitelabel, that.entity, that.region),
    eventName: (that.entity !== 'ominto' ? that.entity + '-' : '') + s_whitelabel + '-' + that.region
  };
  const debug = require('debug')(tasks.eventName + ':processor');

  const getMerchants = tasks.getMerchants = singleRun(function* () {
    const results = yield {
      merchants: tasks.client.getMerchants(),
      campaignAds: tasks.client.getCampaignAds(),
      promoAds: tasks.client.getPromoAds()
    };
    const merchants = merge(results);

    return yield sendEvents.sendMerchants(tasks.eventName, merchants);
  });

  const getCommissionDetails = tasks.getCommissionDetails = singleRun(function* () {
    const startTime = moment().subtract(90, 'days').toDate();
    const endTime = new Date(Date.now() - (60 * 1000)); //

    let allCommissions = [];

    let taskDate = yield utilsDataClient.get('/getTaskDateByAffiliate/' + AFFILIATE_NAME, true, this);

    if (taskDate.body && taskDate.body !== "Not Found") {
      let startCount = moment().diff(moment(taskDate.body.start_date), "days")
      let endCount = moment().diff(moment(taskDate.body.end_date), "days");
      allCommissions = yield tasks.getCommissionsByDate(startCount, endCount);
      yield utilsDataClient.patch('/inactivateTask/' + AFFILIATE_NAME, true, this);
    }

    debug("fetching all events between %s and %s", startTime, endTime);

    const commissions = yield tasks.client.getCommissions(startTime, endTime);
    allCommissions = allCommissions.concat(commissions);
    const events = allCommissions
      .map(prepareCommission.bind(null, s_whitelabel)) // format for kinesis/lambda
      .filter(x => !!x); // so that the prepareCommission can return 'null' to skip one

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
        startDate = moment().subtract(startCount, 'days').toDate();
        endDate = moment().subtract(endCount, 'days').toDate();

        const commissions = yield tasks.client.getCommissions(startDate, endDate);
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

  taskCache[_tag] = tasks;

  return tasks;
}

// As per the impact-radius documentation, 'Oid' field is populated with order_id,
// but when cross-verified with the data that we are receiving, this field is empty.
// Adding the transaction_id as the order_id for now.
function prepareCommission(affiliate_name, o_irAction) {

  // Using ‘Amount’ instead of ‘IntendedAmount’ for ‘Purchase Amount’ & ‘Payout’
  // instead of ‘IntendedPayout’ for ‘Commission Amount’ - as confirmed by impact-radius support
  var o_event = {};
  o_event.affiliate_name = affiliate_name,
  o_event.merchant_name = o_irAction.CampaignName || '',
  o_event.merchant_id = o_irAction.CampaignId || '',
  o_event.transaction_id = o_irAction.Id;
  o_event.order_id = o_irAction.Oid;
  o_event.outclick_id = o_irAction.SubId1;
  o_event.purchase_amount = o_irAction.Amount;
  o_event.commission_amount = o_irAction.Payout;
  o_event.currency = o_irAction.Currency.toLowerCase();

  switch(o_irAction.State) {
    case 'PENDING':
      o_event.state = 'initiated';
      o_event.effective_date = new Date(o_irAction.CreationDate);
      break;
    case 'APPROVED':
      if (checkDate(o_irAction.ClearedDate)) {
        o_event.state = 'paid';
        o_event.effective_date = new Date(o_irAction.ClearedDate);
      } else {
        // won't be in 'APPROVED' unless it's Locked
        o_event.state = 'confirmed';
        o_event.effective_date = new Date(o_irAction.LockingDate);
      }
      break;
    case 'REVERSED':
      if (checkDate(o_irAction.LockingDate)) {
        o_event.state = 'cancelled';
        o_event.effective_date = new Date(o_irAction.LockingDate);
      } else {
        // this will eventually become 'cancelled' once LockingDate happens,
        // though it can flip back into PENDING at any time until then; therefore
        // we treat it as 'PENDING'
        o_event.state = 'initiated';
        o_event.effective_date = new Date(o_irAction.CreationDate);
      }
      break;
  }

  return o_event;
}

function checkDate(d) {
  if (!d) return false;
  const now = Date.now();
  const then = new Date(d).getTime();
  if (now > then) return true;
  return false;
}

module.exports = ImpactRadiusGenericApi;
