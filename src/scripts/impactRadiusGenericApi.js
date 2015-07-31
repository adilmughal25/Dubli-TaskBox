"use strict";

const _ = require('lodash');
const moment = require('moment');
const utils = require('ominto-utils');
const getClient = require('./api-clients/impact-radius');
const debug = require('debug')('impactradius:processor');

const sendEvents = require('./support/send-events');
const singleRun = require('./support/single-run');
const cutoffDate = require('./support/cutoff-date');
const merge = require('./support/easy-merge')('CampaignId', {
  promoAds: 'CampaignId',
  campaignAds: 'CampaignId'
});

const taskCache = {};
function setup(s_whitelabel) {
  if (taskCache[s_whitelabel]) return taskCache[s_whitelabel];

  const CUTOFF_KEY = 'impactradius:'+s_whitelabel;
  const client = getClient(s_whitelabel);
  const tasks = {};

  const getMerchants = tasks.getMerchants = singleRun(function* () {
    const results = yield {
      merchants: client.getMerchants(),
      campaignAds: client.getCampaignAds(),
      promoAds: client.getPromoAds()
    };
    const merchants = merge(results);
    yield sendEvents.sendMerchants(s_whitelabel, merchants);
  });

  var getCommissionDetails = tasks.getCommissionDetails = singleRun(function* () {
    const startTime = yield cutoffDate.get(CUTOFF_KEY);
    const endTime = new Date(Date.now() - (60 * 1000)); //
    debug("fetching all events between %s and %s", startTime, endTime);
    const commissions = yield client.getCommissions(startTime, endTime);
    const events = commissions
      .map(prepareCommission) // format for kinesis/lambda
      .filter(x => !!x); // so that the prepareCommission can return 'null' to skip one
    console.log("Commission Data: ", events);
    yield sendEvents.sendCommissions(s_whitelabel, commissions);
    yield cutoffDate.set(CUTOFF_KEY, endTime);
  });

  taskCache[s_whitelabel] = tasks;

  return tasks;
}

function prepareCommission(o_irAction) {
  var o_event = {};
  o_event.transaction_id = o_irAction.Id;
  o_event.outclick_id = o_irAction.SubId1;
  o_event.purchase_amount = o_irAction.IntendedAmount;
  o_event.commission_amount = o_irAction.IntendedPayout;
  o_event.currency = o_irAction.Currency;
  switch(o_irAction.State) {
  case 'PENDING':
    o_event.state = 'initiated';
    o_event.effective_date = new Date(o_irAction.CreationDate);
    break;
  case 'APPROVED':
    if (checkDate(o_irAction.ClearedDate)) {
      o_event.state = 'paid';
      o_event.effective_date = new Date(o_irAction.ClearedDate);
    }
    else {
      // won't be in 'APPROVED' unless it's Locked
      o_event.state = 'confirmed';
      o_event.effective_date = new Date(o_irAction.LockingDate);
    }
    break;
  case 'REVERSED':
    if (checkDate(o_irAction.LockingDate)) {
      o_event.state = 'cancelled';
      o_event.effective_date = new Date(o_irAction.LockingDate);
    }
    else {
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

/*


{
  "id": "saddasdasd-c2ec-4313-87b4-c802ed80308b",
  "type": "transaction:update",
  "timestamp": 1437074431275,
  "jwt": {},
  "data": {
    "transaction_id": "da6ffcc1-39ca-4d1c-9b75-332224428948",
    "outclick_id": "2465599e-0d04-4909-9c0e-d535ed78a0de",
    "currency": "USD",
    "purchase_amount": 2999,
    "commission_amount": 299,
    "state": "confirmed",
    "effective_date": "Tue Jul 28 2015 09:12:30 GMT-0700 (PDT)"
  }
}

*/


/* TRANSACTION DATA:
 * Id: transaction_id
 * State -> state:
 *   PENDING   -> 'initiated'
 *   APPROVED  ->
 *      if locked: 'confirmed'
 *      if cleared: 'paid'
 *   REVERSED  ->
 *      if locked: 'cancelled'
 *      otherwise: 'tracked'
 * SubId1 -> outclick_id
 * Currency -> currency
 * Amount -> purchase_amount
 * Payout -> commission_amount
 * (multiple) -> effective_date
 *    if 'tracked' -> ReferringDate
 *    if 'initiated' -> CreationDate
 *    if 'cancelled' -> LockingDate
 *    if 'confirmed' -> LockingDate
 *    if 'paid' -> ClearedDate
 */


module.exports = setup;
