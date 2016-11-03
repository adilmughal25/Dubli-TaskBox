"use strict";

const _ = require('lodash');
const co = require('co');
const debug = require('debug')('fan:processor');
const sendEvents = require('../support/send-events');
const singleRun = require('../support/single-run');

const exists = x => !!x;

//TODO: Confirm if other states are available & populate them
const STATE_MAP = {
  'Pending' :   'initiated',
  'Approved':   'confirmed',
  'Rejected':   'cancelled',
  'Paid'    :   'paid'
};

//TODO: Confirm if other currencies are available & populate them
const CURRENCY_MAP = {
  '$':    'usd'
};

const FanGenericApi = function(s_entity) {
  if (!(this instanceof FanGenericApi)) {
    debug("instantiating FanGenericApi for: %s", s_entity);
    return new FanGenericApi(s_entity);
  }

  const that = this;
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
    yield that.clientSoap.setup(that.entity, 'offers'); // setup our soap client

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

    /*
    const addOfferForRegion = (offer, creativeInfos, offerWithCreative, searchTerm, countryCode, countryName) => {
          const uaeOffer = _.cloneDeep(offer);
          uaeOffer.allowed_countries = { country: [{country_code :  countryCode,country_name : countryName}]};
          const regionCreatives = creativeInfos.filter(creativeInfo => creativeInfo.creative_name.indexOf(searchTerm) !== -1);
          regionCreatives && regionCreatives[0] && offerWithCreative.push(that.prepareMerchant(uaeOffer, regionCreatives[0]));
      };
    */
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

    yield that.clientSoap.setup(that.entity);

    let results = [];
    let transactions = [];

    const startDate = new Date(Date.now() - (90 * 86400 * 1000));
    const endDate = new Date(Date.now() - (60 * 1000));
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
    const eventConversionsResponseKey = 'EventConversionsResult';
    results = yield that.doApi('EventConversions', eventConversionsRequestParams, eventConversionsResponseKey);

    const event_conversions = results[0].event_conversions.event_conversion;
    const conversions = Array.isArray(event_conversions) ? event_conversions : [];
    transactions = conversions.map(prepareCommission).filter(exists);

    return yield sendEvents.sendCommissions(that.eventName, transactions);
  });

  // api call generic function
  this.doApi = co.wrap(function* (method, args, key) {

    let results = yield that.clientSoap[method](args);
    if(results) {
      results = extractAry(results, key);
      results = rinse(results);
      return results || [];
    }
    return [];
  });

  /*
  this.getCampaign = function*(campaignId) {
    return yield that.doApi('GetCampaign', {
      api_key: that.clientSoap.cfg.api_key,
      affiliate_id: that.clientSoap.cfg.affiliate_id,
      campaign_id: campaignId
    }, 'GetCampaignResult.campaign.creatives.creative_info');
  }
  */

  this.prepareMerchant = function(offer, link) {

    return {
      //affiliate_id: that.clientSoap.cfg.affiliate_id,
      display_url: offer.preview_link,
      logo: offer.thumbnail_image_url,
      name : offer.offer_name,
      description: offer.description,
      unique_link : link.unique_link.replace('&s1=', '&s2='),
      offer_id : offer.offer_id,
      offer_name : offer.offer_name,
      category : offer.vertical_name,
      status : offer.offer_status.status_name,
      payout : offer.payout,
      thumbnail_image_url : offer.thumbnail_image_url,
      price_format : offer.price_format,
      allowed_countries : offer.allowed_countries || [],
      cashback : [{
        display_url: offer.preview_link,
        name : offer.offer_name,
        description: offer.description,
        rate: offer.payout
      }]
    };
  }
};

/**
 * Function to prepare a single commission transaction for our data event.
 * @param {Object} o_obj  The individual commission transaction straight from webgains
 * @returns {Object} transaction
 */
function prepareCommission(o_obj) {
  return {
    affiliate_name: o_obj.programName,
    transaction_id: o_obj.macro_event_conversion_id,
    order_id: o_obj.order_id,
    outclick_id: o_obj.subid_1,
    currency: CURRENCY_MAP[o_obj.currency_symbol],
    purchase_amount: o_obj.order_total || "0",
    commission_amount: o_obj.price,
    state: STATE_MAP[o_obj.disposition],
    effective_date: o_obj.event_conversion_date
  };
}

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

module.exports = FanGenericApi;
