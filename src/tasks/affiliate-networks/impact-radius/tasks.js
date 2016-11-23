"use strict";

const _ = require('lodash');
const moment = require('moment');
const utils = require('ominto-utils');
const sendEvents = require('../support/send-events');
const singleRun = require('../support/single-run');

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
    debug("fetching all events between %s and %s", startTime, endTime);

    const commissions = yield tasks.client.getCommissions(startTime, endTime);
    const events = commissions
      .map(prepareCommission.bind(null, that.region)) // format for kinesis/lambda
      .filter(x => !!x); // so that the prepareCommission can return 'null' to skip one

    return yield sendEvents.sendCommissions(tasks.eventName, events);
  });

  taskCache[_tag] = tasks;

  return tasks;
}

// As per the impact-radius documentation, 'Oid' field is populated with order_id,
// but when cross-verified with the data that we are receiving, this field is empty.
// Adding the transaction_id as the order_id for now.
function prepareCommission(region, o_irAction) {
  var o_event = {};
  o_event.transaction_id = o_irAction.Id;
  o_event.order_id = o_irAction.Id;
  o_event.outclick_id = o_irAction.SubId1;
  o_event.purchase_amount = o_irAction.IntendedAmount;
  o_event.commission_amount = o_irAction.IntendedPayout;
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
