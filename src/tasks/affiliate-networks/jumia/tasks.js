"use strict";

const _ = require('lodash');
const co = require('co');
const debug = require('debug')('jumia:processor');
const sendEvents = require('../support/send-events');
const singleRun = require('../support/single-run');
const request = require('request-promise');

const exists = x => !!x;

//TODO: Confirm if other states are available & populate them
const STATE_MAP = {
  'Pending': 'initiated',
  'Approved': 'confirmed',
  'Rejected': 'cancelled',
  'Paid': 'paid'
};

//symbol:code
const CURRENCY_MAP = {
  '$': 'usd',
  'MAD': 'mad',
  'Sh': 'kes',  //Kenya Shillings
  'KSh': 'kes',  //Kenya Shillings
  'CFA': 'xof',  //Cameroon & Ivory Coast (XAF for the Central African CFA franc and XOF for the West African CFA franc)
  '£': 'egp', //Egypt Pound
  'GH₵': 'ghs', //Ghana - Ghanaian Cedi
  '₦': 'ngn', //Nigerian Naira
  'NGN': 'ngn' //Nigerian Naira  
};

const JumiaGenericApi = function (s_entity) {
  if (!(this instanceof JumiaGenericApi)) {
    debug("instantiating JumiaGenericApi for: %s", s_entity);
    return new JumiaGenericApi(s_entity);
  }

  var that = this;

  this.entity = s_entity ? s_entity.toLowerCase() : '';
  that.clientSoap = require('./api')(this.entity);
  this.eventName = this.entity;

  /**
   * Retrieve all merchant details (deals/cashbacks/etc) from affiiate
   * @returns {undefined}
   */
  this.getMerchants = singleRun(function* () {

    const api_key = that.clientSoap.cfg.api_key;
    const affiliate_id = that.clientSoap.cfg.affiliate_id;
    yield that.clientSoap.setupOffers(that.entity, 'offers');

    const getOfferFeedReq = {
      api_key: that.clientSoap.cfg.api_key,
      affiliate_id: that.clientSoap.cfg.affiliate_id,
      media_type_category_id: 0,
      vertical_category_id: 0,
      vertical_id: 0,
      offer_status_id: 0,
      tag_id: 0,
      start_at_row: 1,
      row_limit: 0
    };
    const offers = yield that.doApi('OfferFeed', getOfferFeedReq, 'OfferFeedResult.offers.offer');

    const activeOffers = offers.filter((offer) => offer.offer_status.status_id === '1');

    const offerWithCreative = [];

    for (var offer of activeOffers) {
      const getCampaignRequestParams = {
        api_key: api_key,
        affiliate_id: affiliate_id,
        campaign_id: offer.campaign_id
      };
      const getCampaignResponseKey = 'GetCampaignResult.campaign.creatives.creative_info';
      const creativeInfos = yield that.doApi('GetCampaign', getCampaignRequestParams, getCampaignResponseKey);

      const linkCreatives = creativeInfos.filter(creativeInfo => creativeInfo.creative_type.type_id === "1");
      linkCreatives && linkCreatives[0] && offerWithCreative.push(that.prepareMerchant(offer, linkCreatives[0]));
    }

    return yield sendEvents.sendMerchants(that.eventName, offerWithCreative);
  });

  /**
   * Retrieve all commission details (sales/transactions) from affiiate within given period of time.
   * @returns {undefined}
   */
  this.getCommissionDetails = singleRun(function* () {

    yield that.clientSoap.setupReports(that.entity);

    let results = [];
    let transactions = [];

    const startDate = new Date(Date.now() - (90 * 86400 * 1000));
    const endDate = new Date(Date.now());
    const eventConversionsRequestParams = {
      start_date: that.clientSoap.dateFormat(startDate),
      end_date: that.clientSoap.dateFormat(endDate),
      api_key: that.clientSoap.cfg.api_key,
      affiliate_id: that.clientSoap.cfg.affiliate_id,
      site_offer_id: 0,
      currency_id: 0,
      event_type: 'all',
      exclude_bot_traffic: false,
      start_at_row: 0,
      row_limit: 0
    };

    const eventConversionsResponseKey = 'ConversionsResult';
    results = yield that.doApi('Conversions', eventConversionsRequestParams, eventConversionsResponseKey);

    const event_conversions = results[0].conversions.conversion;
    const conversions = Array.isArray(event_conversions) ? event_conversions : [];
    transactions = yield conversions.map(that.prepareCommission).filter(exists);
    return sendEvents.sendCommissions(that.eventName, transactions);
  });

  // api call generic function
  this.doApi = co.wrap(function* (method, args, key) {
    let results = yield that.clientSoap[method](args);
    if (results) {
      results = extractAry(results, key);
      // results = rinse(results); // causing issues with date
      return results || [];
    }
    return [];
  });

  this.prepareMerchant = function (offer, link) {

    if (!offer.allowed_countries || offer.allowed_countries.length == 0 || !Array.isArray(offer.allowed_countries)) {
      offer.allowed_countries = [];
    }

    return {
      display_url: offer.preview_link,
      logo: offer.thumbnail_image_url,
      name: offer.offer_name,
      description: offer.description,
      unique_link: link.unique_link.replace('&s1=', '&s2='),
      offer_id: offer.offer_id,
      offer_name: offer.offer_name,
      category: offer.vertical_name,  //always coming as Jumia.. can be commented as well.
      status: offer.offer_status.status_name,
      payout: offer.payout,
      thumbnail_image_url: offer.thumbnail_image_url,
      price_format: offer.price_format,
      allowed_countries: offer.allowed_countries,
      cashback: [{
        display_url: offer.preview_link,
        name: offer.offer_name,
        description: offer.description,
        rate: offer.payout
      }]
    };
  };

  /**
   * Function to prepare a single commission transaction for our data event.
   * @param {Object} o_obj  The individual commission transaction straight from webgains
   * @returns {Object} transaction
   */
  this.prepareCommission = co.wrap(function* (o_obj) {
    //Jumia sends order currency local and commission is USD
    if ('$' !== o_obj.currency_symbol) {  //this should not happen
      console.log("ERROR: Unable to understand Currency Symbol ", o_obj.currency_symbol);
      return;
    }

    var purchaseAmount = 0;
    var currencyCode = CURRENCY_MAP[o_obj.order_currency_symbol];
    var convDate = new Date(o_obj.conversion_date);

    if (currencyCode) {
      var currencyConvUrl = 'https://api.ominto.com/currencyConversions?type=json';
      currencyConvUrl = currencyConvUrl + "&date=" + convDate.getFullYear() + "-" + ("0" + (convDate.getMonth() + 1)).slice(-2) +
      "-" + ("0" + convDate.getDate()).slice(-2);
      currencyConvUrl = currencyConvUrl + "&cur=" + currencyCode;

      console.log("currency conv url: ", currencyConvUrl);
      yield request.get(currencyConvUrl, function (error, response, body) {
        console.log('body:', body); 
        var jsonBody = JSON.parse(body);

        if(response.statusCode == 200) {
          if(jsonBody && (!jsonBody.error) && jsonBody.currencies && jsonBody.currencies.length > 0) {
            purchaseAmount = Number(o_obj.order_total || "0") / jsonBody.currencies[0].bid;
            console.log("original amount %s, converted amount %s, conversion rate %s currency %s, conversion date %s",
            o_obj.order_total, purchaseAmount, jsonBody.currencies[0].bid, currencyCode, convDate);
          }
        }
      });
    }
    else {
      console.log("ERROR: Setting purchase amount to zero as currency code not understood.  ", currencyCode);
    }

    return {
      affiliate_name: o_obj.offer_name,
      transaction_id: o_obj.conversion_id,
      order_id: o_obj.order_id,
      outclick_id: o_obj.subid_1 || o_obj.subid_2,
      currency: 'usd',  //since it's always converted to usd
      purchase_amount: purchaseAmount,
      commission_amount: Number(o_obj.price || "0"),
      state: STATE_MAP[o_obj.disposition],
      effective_date: convDate
    };
  });
};

/**
 * Function to removes SOAP-y residue
 * @param {Object} obj
 * @returns {Object} obj [rinsed]
 */
function rinse(obj) {
  if (_.isString(obj)) return obj;
  if (_.isArray(obj)) return obj.map(rinse);
  if (_.isObject(obj)) {
    delete obj.attributes;
    if (obj.$value) {
      return obj.$value;
    }
    return _.mapValues(obj, rinse);
  }
  return obj;
}

var ary = x => _.isArray(x) ? x : [x];

function extractAry(result, key) {
  return result = ary(_.get(result, key) || []);
}

module.exports = JumiaGenericApi;