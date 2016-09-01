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

  var that = this;

  this.eventName = 'shoogloo';

  this.getCampaign = function*(campaignId) {
    return yield that.doApi('GetCampaign', {
      api_key: that.clientSoap.cfg.api_key,
      affiliate_id: that.clientSoap.cfg.affiliate_id,
      campaign_id: campaignId
    }, 'GetCampaignResult.campaign.creatives.creative_info');
  }

  this.getMerchants = singleRun(function* () {
    debug("getMerchants");
    that.clientSoap = require('./api')();
    yield that.clientSoap.setup('offers'); // setup our soap client
    // const verticals = yield that.doApi('GetVerticals', {
    //   api_key: that.clientSoap.cfg.api_key,
    //   affiliate_id: that.clientSoap.cfg.affiliate_id}, 'GetVerticalsResult.verticals.vertical');
    //    const keyByVerticalNames = _.indexBy(verticals, 'vertical_name');

    const offers = yield that.doApi('OfferFeed', {
      api_key: that.clientSoap.cfg.api_key,
      affiliate_id: that.clientSoap.cfg.affiliate_id,
      media_type_category_id: 0,
      vertical_category_id: 0,
      vertical_id: 0,
      offer_status_id: 0,
      tag_id: 0,
      start_at_row: 1,
      row_limit: 0

    }, 'OfferFeedResult.offers.offer');
    
    const activeOffers = offers.filter((offer) => offer.offer_status.status_id === '1');
    let offerWithCreative = [];
    for(var offer of activeOffers) {
      const creativeInfos = yield that.doApi('GetCampaign', {
        api_key: that.clientSoap.cfg.api_key,
        affiliate_id: that.clientSoap.cfg.affiliate_id,
        campaign_id: offer.campaign_id
      }, 'GetCampaignResult.campaign.creatives.creative_info');
      if(creativeInfos)
        offerWithCreative = offerWithCreative.concat(creativeInfos.map((creativeInfo) => {
          creativeInfo.offer_id = offer.offer_id;
          creativeInfo.offer_name = offer.offer_name;
          creativeInfo.category = offer.vertical_name;
          creativeInfo.status = offer.offer_status.status_name;
          creativeInfo.payout = offer.payout;
          creativeInfo.thumbnail_image_url = offer.thumbnail_image_url;
          creativeInfo.description = offer.description;
          creativeInfo.payout = offer.payout;
          creativeInfo.price_format = offer.price_format;
          creativeInfo.allowed_countries = offer.allowed_countries;
          creativeInfo.merchant = {
            affiliate_id: that.clientSoap.cfg.affiliate_id,
            display_url: offer.thumbnail_image_url,
            name : offer.offer_name,
            description: offer.description
          };
          creativeInfo.cashback = [{
            affiliate_id: that.clientSoap.cfg.affiliate_id,
            display_url: offer.thumbnail_image_url,
            name : offer.offer_name,
            description: offer.description,
          }];
          return creativeInfo;
        }));

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
    
    const event_conversions = results[0].event_conversions;
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
    currency: o_obj.currency_symbol,
    purchase_amount: o_obj.price,
    commission_amount: o_obj.order_total,
    state: o_obj.disposition,
    effective_date: new Date(o_obj.event_conversion_date)
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
