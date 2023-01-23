"use strict";

const _ = require('lodash');
const co = require('co');
//const utils = require('ominto-utils');
const sendEvents = require('../support/send-events');
const singleRun = require('../support/single-run');
const moment = require('moment');

const AFFILIATE_NAME = 'affilinet-';

const merge = require('../support/easy-merge')('ProgramId', {
  links: 'ProgramId',
  coupons: 'ProgramId'
});
const exists = x => !!x;
const isDate = x => (/^\d{4}(-\d{2}){2}T(\d{2}:){2}\d{2}/).test(x);

// Testing States
const STATE_MAP = {
  
  'Open': 'initiated',
  
  'Confirmed': 'confirmed',
  
  'Cancelled': 'cancelled'
  
};

const AffilinetGenericApi = function(s_region, s_entity) {
  if (!s_region) throw new Error("Affili.net Generic API needs region!");
  if (!(this instanceof AffilinetGenericApi)) return new AffilinetGenericApi(s_region, s_entity);

  var that = this;

  this.entity = s_entity ? s_entity.toLowerCase() : 'ominto';
  this.client = require('./api')(this.entity, s_region);
  this.eventName = (this.entity !== 'ominto' ? this.entity + '-' : '') + 'affilinet-' + s_region;

  const debug = require('debug')(this.eventName + ':processor');

  this.getMerchants = singleRun(function*() {
    yield that.client.ensureLoggedIn();
    var results = yield {
      merchants: that.client.getPrograms(),
      coupons: that.client.getVouchers()
    };
    debug("merchants count: %d", results.merchants.length);
    debug("coupons count: %d", results.coupons.length);
    var ids = _.pluck(results.merchants, 'ProgramId');
    let links = [];
    for (let i = 0; i < ids.length; i += 50) {
      let group = ids.slice(i, i+50);
      links = links.concat(yield that.client.getCreatives({programIds:group}));
      debug("[%d of %d] %d links totals", i+1, ids.length, links.length);
    }
    results.links = links;
    debug("links count: %d", results.links.length);

    var merged = merge(results).filter(checkIfActive);
    return yield sendEvents.sendMerchants(that.eventName, merged);
  });

  this.getCommissionDetails = singleRun(function* () {
    yield that.client.ensureLoggedIn();
    const startDate = moment().subtract(270, 'days').format('YYYY-MM-DD');
    const endDate = moment().format('YYYY-MM-DD');
    const results = yield [
      that.client.getTransactions({startDate:startDate, endDate:endDate, valuationType:'DateOfRegistration'}),
      that.client.getTransactions({startDate:startDate, endDate:endDate, valuationType:'DateOfConfirmation'})
    ];
    const all = Array.prototype.concat.apply([], results);
    const events = all.map(prepareCommission.bind(null, s_region)).filter(exists);
    return yield sendEvents.sendCommissions(that.eventName, events);
  });
};

function prepareCommission(region, o_obj) {

  let date = new Date(o_obj.RegistrationDate);
  if (typeof o_obj.CheckDate === 'string' && isDate(o_obj.CheckDate)) {
    date = new Date(o_obj.CheckDate);
  }
  const event = {
    affiliate_name: AFFILIATE_NAME + region,
    merchant_name: o_obj.ProgramTitle || '',
    merchant_id: o_obj.ProgramId || '',
    transaction_id: o_obj.TransactionId,
    order_id: o_obj.TransactionId,
    outclick_id: o_obj.SubId,
    purchase_amount: o_obj.NetPrice,
    commission_amount: o_obj.PublisherCommission,
    state: STATE_MAP[o_obj.TransactionStatus],
    currency: (region === 'uk' ? 'gbp' : 'eur'),
    effective_date: date
  };

  return event;
}

function checkIfActive(rec) {
  if (rec.merchant.PartnershipStatus !== 'Active') return false;
  return true;
}

module.exports = AffilinetGenericApi;
