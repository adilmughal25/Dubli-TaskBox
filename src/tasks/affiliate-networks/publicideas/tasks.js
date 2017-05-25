"use strict";

const _ = require('lodash');
const co = require('co');
const debug = require('debug')('publicideas:processor');
const utils = require('ominto-utils');
const moment = require('moment');
const sendEvents = require('../support/send-events');
const singleRun = require('../support/single-run');
const createClient = require('./api');

const AFFILIATE_NAME = 'publicideas-';

const ary = x => _.isArray(x) ? x : [x];

const STATUS_MAP = {
  0: 'cancelled', // their status: 'refused'
  1: 'initiated', // their status: 'pending'
  2: 'confirmed'  // their status: 'approved'
};

// massage the input a tiny little bit, mostly for ease-of-use on the lambda side
function clean(merchants) {
  return merchants.map(function(merchant) {
    var links = ary(_.get(merchant, 'promotional_elements.links.link') || []);
    var cashback = ary(_.get(merchant, 'commissions.global_commission') || []);
    var m = _.omit(merchant, 'promotional_elements', 'commissions');
    m.feeds = merchant.promotional_elements.feeds;
    var rec = {
      merchant: m,
      cashback: cashback,
      links: links
    };
    return rec;
  });
}

function prepareCommission(s_region, o_obj) {

  const event = {
    affiliate_name: AFFILIATE_NAME + s_region,
    merchant_name: '', // o_obj.title - not sure if this is correct?
    merchant_id: '',
    transaction_id: o_obj.id,
    order_id: o_obj.id,
    outclick_id: o_obj.cashBack,
    purchase_amount: o_obj.montantVente,
    commission_amount: o_obj.montantCom,
    state: STATUS_MAP[o_obj.statut],
    currency: s_region === 'latam' ? 'MXN' : 'EUR',
    effective_date: new Date(o_obj.statut === 1 ? o_obj.dateAction : o_obj.dateValid)
  };
  debug({eventData:event, inputData:o_obj}, "Created Commission event");
  return event;
}

function setup(s_region) {
  const client = createClient(s_region);
  const getMerchants = singleRun(function* (){
    const merchantsRaw = yield client.getMerchants();
    const merchants = clean(merchantsRaw);
    return yield sendEvents.sendMerchants('publicideas-'+s_region, merchants);
  });

  const getCommissionDetails = singleRun(function* () {
    const start = moment().subtract(90, 'days').toDate();
    const end = new Date();
    const pending = yield client.getPendingCommissions(start, end);
    const validated = yield client.getValidatedCommissions(start, end);
    const all = [].concat(pending, validated);
    const events = all.map(prepareCommission.bind(null, s_region));
    return yield sendEvents.sendCommissions('publicideas-'+s_region, events);
  });

  const tasks = {
    getMerchants: getMerchants,
    getCommissionDetails: getCommissionDetails
  };
  return tasks;
}

module.exports = setup;
