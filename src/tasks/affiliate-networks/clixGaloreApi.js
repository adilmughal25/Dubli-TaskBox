"use strict";

/*
 * ClixGalore, probably the worst wtf case...
 * They seem to structure the whole progam differently -Ominto is not joining/related to programs/merchants but more to individual banners from such merchants.
 * - merchant Ids or such isnt existing either - so we create one with base64 out of the merchant name
 * @TODO: - complete the list of possible currency strings returned by any of the feeds - all feeds using diffrent syntax
 *
 * getCommissionDetails:
 * !Note: transactions do not have any Ids - no transactionIds what so ever
 */

const _ = require('lodash');
const co = require('co');
const debug = require('debug')('clixgalore:processor');
const sendEvents = require('./support/send-events');
const singleRun = require('./support/single-run');
const client = require('./api-clients/clixGalore')();

const ary = x => x ? (_.isArray(x) ? x : [x]) : [];
const exists = x => !!x;
const merge = require('./support/easy-merge')('mid_base64', {
  banners: 'mid_base64',
  links: 'mid_base64',
  coupons: 'mid_base64',
});

var getMerchants = singleRun(function* () {
  const merchants = [];

  // they dont have "merchants" so we have to filter individual merchants from their Banner lists and create a unique merchant list.
  const banners = ary(yield client.curlXml('affiliateJoinRequests'))
    .map(prepareBanners)
    .filter(exists)
    .map( b => {
      // fill our merchant list
      if(!merchants[b.mid_base64]) {
        merchants.push( {mid_base64: b.mid_base64, name: b.merchant_program});
      }
      return b;
    });

  const linkcodes = ary(yield client.getFeed('affiliateLinkCode')).map(prepareLinks);
  const coupons = ary(yield client.getFeed('coupons')).map(prepareCoupons);

  const events = merge({
    merchants: merchants,
    banners: banners,
    links: linkcodes,
    coupons: coupons,
  });

  yield sendEvents.sendMerchants('clixgalore', events);
});

/**
 * Retrieve all commission details (sales/transactions) from ClixGalore.
 * @returns {undefined}
 */
var getCommissionDetails = singleRun(function* () {
  let transactions = [], response = [];
  const startDate = new Date(Date.now() - (30 * 86400 * 1000));
  const endDate = new Date(Date.now() - (60 * 1000));

  transactions = [].concat(
    ary(yield client.getFeed('transactionsConfirmed', null, {SD: startDate, ED:endDate})),
    ary(yield client.getFeed('transactionsPending', null, {SD: startDate, ED:endDate})),
    ary(yield client.getFeed('transactionsCancelled', null, {SD: startDate, ED:endDate}))
  );

  const events = transactions.map(prepareCommission).filter(exists);

  yield sendEvents.sendCommissions('clixgalore', events);
});

const STATE_MAP = {
  'approved': 'initiated',
  'pending': 'initiated',
  'declined': 'cancelled',
};

const CURRENCY_MAP = {
  'US': 'usd',
  'US$': 'usd',
  'AU': 'aud',
  'AU$': 'aud',
  'Rs': 'inr',
  'IN': 'inr',
  'NZ': 'nzd',
  'NZ$': 'nzd',
  'UK': 'gbp',
  'UK£': 'gbp',
  '€': 'eur',
  'EU': 'eur',
  '¥': 'jpy',
  'JP': 'jpy',
  'SGD': 'sgd',
  'SG$': 'sgd',
  '฿': 'thb',
  'BT': 'thb',
};

function prepareBanners(o_obj) {
  if(o_obj.Program_Type !== '% Per Sale' || o_obj.Merchant_Status !== 'Active' || o_obj.Status !== 'Approved') {
    return;
  }

  let o_banner = {
    mid_base64: new Buffer(o_obj.Merchant_Program).toString('base64'),
    merchant_program: o_obj.Merchant_Program,
    currency: CURRENCY_MAP[o_obj.Currency] || o_obj.Currency,
    rate: Number(o_obj.Rate),
    banner_name: o_obj.Banner_Name,
    merchant_status: o_obj.Merchant_Status,
  };

  return o_banner;
}

function prepareLinks(o_obj) {
  if(o_obj.Program_Type !== '% Per Sale') {
    return;
  }

  let o_link = {
    mid_base64: new Buffer(o_obj.Merchant_Program).toString('base64'),
    merchant_program: o_obj.Merchant_Program,
    currency: CURRENCY_MAP[o_obj.Currency] || o_obj.Currency,
    rate: Number(o_obj.Commission_Rate),
    banner_name: o_obj.Banner_Name,
    merchant_status: o_obj.Merchant_Status,
    category_1: o_obj.Category_1,
    category_2: o_obj.Category_2,
    category_3: o_obj.Category_3,
    category_4: o_obj.Category_4,
    tracking_code: o_obj.Tracking_Code,
  };

  return o_link;
}

const commissionRegex = /\((.*)\) ([0-9\.]*)(\%?)/i;  // "(US$) 30.00%" => 'US$', '30.00', '%'
function prepareCoupons(o_obj) {
  if(o_obj.Program_Type !== '% Per Sale') {
    return;
  }

  let a_commission = commissionRegex.exec(o_obj.Commission);
  if(a_commission===null || a_commission[3] !== '%') {
    return;
  }

  let o_link = {
    mid_base64: new Buffer(o_obj.Merchant).toString('base64'),
    merchant_program: o_obj.Merchant,
    currency: CURRENCY_MAP[a_commission[1]] || a_commission[1],
    rate: Number(a_commission[2]),
    coupon_code: o_obj.Coupon_Code,
    coupon_title: o_obj.Coupon_Title,
    valid_from: o_obj.Valid_From,
    valid_until: o_obj.Valid_Until,
    coupon_description: o_obj.Coupon_Description,
    coupon_url: o_obj.Coupon_URL,
    image: o_obj.Image,
    thumbnail: o_obj.Thumbnail,
    text_link: o_obj.Text_Link,
    graphic_link: o_obj.Graphic_Link,
  };

  return o_link;
}

const amountPregPattern = /([^0-9\\.])/gi;  // to clean amounts like "AU$123.45", "NZ$432.12", ...
function prepareCommission(o_obj) {
  let eff_date = o_obj.Declined_Date || o_obj.Confirmed_Date || o_obj.Transaction_Date;
  let event = {
    affiliate_name: o_obj.Merchant_Site,
    // transaction_id: null,
    outclick_id: o_obj.Aff_Order_ID,
    currency: CURRENCY_MAP[o_obj.Currency],
    purchase_amount: o_obj.Sale_Value.replace(amountPregPattern, ''),
    commission_amount: o_obj.Commission.replace(amountPregPattern, ''),
    state: STATE_MAP[o_obj.Status.toLowerCase()],
    effective_date: new Date(eff_date)
  };

  return event;
}

module.exports = {
  getMerchants: getMerchants,
  getCommissionDetails: getCommissionDetails
};
