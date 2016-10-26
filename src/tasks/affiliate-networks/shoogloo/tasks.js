"use strict";

/*
 * getCommissions() with SOAP client not 100% finished. Stopped during implementation, as we prefer to use the webhooks instead.
 * Remove obsolete code as soon thats final...
 */

const _ = require('lodash');
const co = require('co');
const debug = require('debug')('shoogloo:processor');
const utils = require('ominto-utils');
const sendEvents = require('../support/send-events');
const singleRun = require('../support/single-run');

const exists = x => !!x;
const XmlEntities = require('html-entities').XmlEntities;
const entities = new XmlEntities();

const merge = require('../support/easy-merge')('id', {
  links: 'programId',
  coupons: 'programId',
  deals: 'program.id',
});


  
const ShooglooGenericApi = function() {
  if (!(this instanceof ShooglooGenericApi)) {
    debug("instantiating ShooglooGenericApi");
    return new ShooglooGenericApi();
  }

  const that = this;
  that.clientSoap = require('./api')();

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
    }

  this.eventName = 'shoogloo';

  this.getCampaign = function*(campaignId) {
    return yield that.doApi('GetCampaign', {
      api_key: that.clientSoap.cfg.api_key,
      affiliate_id: that.clientSoap.cfg.affiliate_id,
      campaign_id: campaignId
    }, 'GetCampaignResult.campaign.creatives.creative_info');
  }

  this.prepareMerchant = function(offer, link) {
    return {
          cashback : [{
            affiliate_id: that.clientSoap.cfg.affiliate_id,
            display_url: offer.preview_link,
            name : offer.offer_name,
            description: offer.description,
            rate: offer.payout
          }],
          merchant : {
            affiliate_id: that.clientSoap.cfg.affiliate_id,
            display_url: offer.preview_link,
            logo: offer.thumbnail_image_url,
            name : offer.offer_name,
            description: offer.description
          },
          unique_link : link.unique_link.replace('&s1=', '&s2='),
          offer_id : offer.offer_id,
          offer_name : offer.offer_name,
          category : offer.vertical_name,
          status : offer.offer_status.status_name,
          payout : offer.payout,
          thumbnail_image_url : offer.thumbnail_image_url,
          description : offer.description,
          price_format : offer.price_format,
          allowed_countries : offer.allowed_countries || {
            country: [{
              country_code :  "AE",
              country_name : "UAE"
            }
            ]
          }
        };
  }

  this.getMerchants = singleRun(function* () {
    
    const api_key = that.clientSoap.cfg.api_key;
    const affiliate_id = that.clientSoap.cfg.affiliate_id;
    yield that.clientSoap.setup('offers'); // setup our soap client

    const offers = yield that.doApi('OfferFeed', getOfferFeedReq, 'OfferFeedResult.offers.offer');
    const activeOffers = offers.filter((offer) => offer.offer_status.status_id === '1');

    const addOfferForRegion = (offer, creativeInfos, offerWithCreative, searchTerm, countryCode, countryName) => {
          const uaeOffer = _.cloneDeep(offer);
          uaeOffer.allowed_countries = { country: [{country_code :  countryCode,country_name : countryName}]};
          const regionCreatives = creativeInfos.filter(creativeInfo => creativeInfo.creative_name.indexOf(searchTerm) !== -1);
          regionCreatives && regionCreatives[0] && offerWithCreative.push(that.prepareMerchant(uaeOffer, regionCreatives[0]));
      };

    const offerWithCreative = [];

    for(var offer of activeOffers) {
      const getCampaignRequestParams = { api_key: api_key, affiliate_id: affiliate_id, campaign_id: offer.campaign_id};
      const getCampaignResponseKey = 'GetCampaignResult.campaign.creatives.creative_info';
      const creativeInfos = yield that.doApi('GetCampaign', getCampaignRequestParams, getCampaignResponseKey);
      if(offer.offer_name.indexOf('Souq') == -1) {
        const linkCreatives = creativeInfos.filter(creativeInfo => creativeInfo.creative_type.type_id === "1");
        linkCreatives && linkCreatives[0] && offerWithCreative.push(that.prepareMerchant(offer, linkCreatives[0]));
      } else {
        addOfferForRegion(offer, creativeInfos, offerWithCreative, 'UAE - English', 'AE', 'UAE');
        addOfferForRegion(offer, creativeInfos, offerWithCreative, 'Egypt - English', 'EG', 'Egypt');
        addOfferForRegion(offer, creativeInfos, offerWithCreative, 'KSA - English', 'SA', 'Saudi Arabia');
      }

    } 
    
    return yield sendEvents.sendMerchants(that.eventName, offerWithCreative);
  });

  /**
   * Retrieve all commission details (sales/transactions) from webgains within given period of time.
   * @returns {undefined}
   */
  this.getCommissionDetails = singleRun(function* () {
    debug("getCommissionDetails");
    that.clientSoap = require('./api')();
    yield that.clientSoap.setup(); // setup our soap client
    let results = [];
    let transactions = [];
    const startDate = new Date(Date.now() - (90 * 86400 * 1000));
    const endDate = new Date(Date.now() - (60 * 1000));
    results = yield that.doApi('EventConversions', {
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
    }, 'EventConversionsResult');
    
    const event_conversions = results[0].event_conversions.event_conversion;
    const conversions = Array.isArray(event_conversions) ? event_conversions : [];
    transactions = conversions.map(prepareCommission).filter(exists);
    return yield sendEvents.sendCommissions(that.eventName, transactions);
  });

  this.doApi = co.wrap(function* (method, args, key) {
    let results = yield that.clientSoap[method](args)
      .then(extractAry(key))
      .then(resp => rinse(resp))
      .catch((e) => {
        e.stack = e.body + ' (' +e.stack + ')'
        throw e;
      });
    return results || [];
  });
};

/**
 * Filter out merchants we are not yet approved for.
 */
function approvedAffiliate(item) {
  var status = Number(item.merchant.affiliateApprovalStatus);
  if (status === 1) return true;
  if (status === 2) return true;
  return false;
}

//TODO: Populate other states
const STATE_MAP = {
  'Pending':    'initiated',
  'Approved':   'confirmed',
  'Rejected':   'cancelled',
  'Paid': 'completed' 
};
//TODO: Populate other currencies
const CURRENCY_MAP = {
  '$':    'usd'
};

/**
 * Function to prepare a single commission transaction for our data event.
 * @param {Object} o_obj  The individual commission transaction straight from webgains
 * @returns {Object}
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

var ary = x => _.isArray(x) ? x : [x];
function extractAry(key) {
  return resp => ary(_.get(resp, key) || []);
}

// rinse: removes SOAP-y residue
function rinse(any) {
  if (_.isString(any)) return any;
  if (_.isArray(any)) return any.map(rinse);
  if (_.isObject(any)) {
    delete any.attributes;
    if (any.$value) {
      return any.$value;
    }
    return _.mapValues(any, rinse);
  }
  return any;
}


module.exports = ShooglooGenericApi;