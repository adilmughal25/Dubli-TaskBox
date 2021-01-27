"use strict";

const _ = require('lodash');
const co = require('co');
const debug = require('debug')('adtraction:processor');
const sendEvents = require('../support/send-events');
const singleRun = require('../support/single-run');

const moment = require('moment');
const utils = require('ominto-utils');
const configs = require('../../../../configs.json');
const utilsDataClient = utils.restClient(configs.data_api);

const AFFILIATE_NAME = 'adtraction';

const exists = x => !!x;

 const STATUS_MAP = {
  0: 'Rejected',
  1: 'Approved',
  2: 'Pending',
  3: 'Not Available'
};

const adtractionGenericApi = function (s_entity) {
  if (!(this instanceof adtractionGenericApi)) {
    debug("instantiating AdtractionGenericApi for: %s", s_entity);
    return new adtractionGenericApi(s_entity);
  }

  var that = this;

  this.entity = s_entity ? s_entity.toLowerCase() : 'ominto';
  this.client = require('./api')(this.entity);
  this.eventName = (this.entity !== 'ominto' ? this.entity + '-' : '') + 'adtraction';

  this.getMerchants = singleRun(function* () {
    var results = yield {
      merchants: that.client.getMerchants(),
      coupons: that.client.getCoupons()
    };

    results.merchants = JSON.parse(results.merchants);
    results.coupons = JSON.parse(results.coupons);

    var merchants = mergeResults(results);
    merchants = merchants.map(prepareMerchant).filter(exists);
    return sendEvents.sendMerchants(that.eventName, merchants);
  });

  this.getCommissionDetails = singleRun(function* () {
    const startDate = new Date(Date.now() - (90 * 86400 * 1000));  //90 days
    const endDate = new Date(Date.now());

    let allCommissions = [];

    let taskDate = yield utilsDataClient.get('/getTaskDateByAffiliate/' + AFFILIATE_NAME, true, this);

    if (taskDate.body && taskDate.body !== "Not Found") {
      let startCount = moment().diff(moment(taskDate.body.start_date), "days");
      let endCount = moment().diff(moment(taskDate.body.end_date), "days");
      allCommissions = yield that.getCommissionsByDate(startCount, endCount);
      yield utilsDataClient.patch('/inactivateTask/' + AFFILIATE_NAME, true, this);
    }

    var results = yield that.client.getCommissions(startDate, endDate);
    results = JSON.parse(results);
    allCommissions = allCommissions.concat(results);
    const events = allCommissions.map(prepareCommission).filter(exists);
    return sendEvents.sendCommissions(that.eventName, events);
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
        startDate = new Date(Date.now() - (startCount * 86400 * 1000));
        endDate = new Date(Date.now() - (endCount * 86400 * 1000));

        let commissions = yield that.client.getCommissions(startDate, endDate);
        commissions = JSON.parse(commissions);
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
};

function prepareMerchant(o_obj) {

  let merchant = o_obj.merchant;
  let coupons = o_obj.coupons;

  return {
    affiliate_id: merchant.programId + "-(" + merchant.channelId + ")",
    display_url: merchant.programURL,
    logo: merchant.logoURL,
    name: merchant.programName,
    unique_link: merchant.trackingURL,
    category: merchant.category,
    status: STATUS_MAP[merchant.approvalStatus],
    allowed_countries: merchant.market || [],
    cashback: prepareCashbacks(merchant),
    coupons: prepareCoupons(coupons)
  };
}

function prepareCashbacks(merchant) {
  var cashbacks = [];

  for (var i = 0; i < merchant.compensations.length; i++) {
    let comp = merchant.compensations[i];
    if (comp.transactionType == 3) {  // type 3 is Sale
      cashbacks.push({
        name: comp.name,
        rate: comp.value,
        type: (comp.type === '%') ? 'cashback' : 'flat',
        currency: merchant.currency ? merchant.currency.toLowerCase() : ''
      });
    }
  }

  return cashbacks;
}

function prepareCoupons(o_obj) {
  var coupons = [];

  for (var i = 0; i < o_obj.length; i++) {
    let coupon = o_obj[i];

    coupons.push({
      //mid_base64: new Buffer(o_obj.Merchant).toString('base64'),
      merchant_program: coupon.programName,
      //currency: CURRENCY_MAP[a_commission[1]] || a_commission[1],
      //rate: Number(a_commission[2]),
      coupon_code: coupon.offerCoupon || '',
      coupon_title: coupon.offerDescription,
      valid_from: coupon.validFrom,
      valid_until: coupon.validTo,
      coupon_description: coupon.offerDescription,
      coupon_url: coupon.trackingURL
    });
  }

  return coupons;
}

function prepareCommission(o_obj) {
  var status = 'initiated';
  status = o_obj.paid === 'true' ? 'paid' : status;
  status = o_obj.cancelled === 'true' ? 'cancelled' : status;

  const event = {
    affiliate_name: AFFILIATE_NAME,
    merchant_name: o_obj.programName || '',
    merchant_id: o_obj.programId + "-(" + o_obj.channelId + ")",
    transaction_id: o_obj.orderId,
    order_id: o_obj.orderId,
    outclick_id: o_obj.epi,
    currency: o_obj.currency.toLowerCase(),
    purchase_amount: o_obj.orderValue,
    commission_amount: o_obj.commission,
    state: status,
    effective_date: new Date(o_obj.transactionDate)
  };

  return event;
}

function mergeResults(o_obj) {
  var res = {};
  var make = k => res[k] || (res[k] = { coupons: [] });
  var set = (i, k, v) => make(i)[k] = v;
  var add = (i, k, v) => make(i)[k].push(v);

  if (Array.isArray(o_obj.merchants)) {
    o_obj.merchants.forEach(m => set(m.programId, 'merchant', m));
  }
  else
    set(o_obj.merchants.programId, 'merchant', o_obj.merchants);

  o_obj.coupons.forEach(c => add(c.programId, 'coupons', c));
  o_obj.coupons.forEach(c => c.validFrom = new Date(c.validFrom).toISOString());
  o_obj.coupons.forEach(c => c.validTo = new Date(c.validTo).toISOString());
  return _.values(res).filter(x => 'merchant' in x);
}

module.exports = adtractionGenericApi;
