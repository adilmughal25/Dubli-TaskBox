"use strict";

const _ = require('lodash');
const co = require('co');
const debug = require('debug')('shoogloo:processor');
const sendEvents = require('../support/send-events');
const singleRun = require('../support/single-run');
const deasync = require('deasync');
//const utils = require('ominto-utils');
const configs = require('../../../../configs.json');
//utils.clients.init(configs);
//const dataClient = utils.restClient(configs.data_api);

var merchantMeta = [];
const merge = require('../support/easy-merge')('merchant_id', {
  cashbacks: 'merchant_id',
  regions: 'merchant_id'
});

const AFFILIATE_NAME = 'shoogloo';

const exists = x => !!x;

const STATE_MAP = {
  'Pending' :   'initiated',
  'Approved':   'confirmed',
  'Rejected':   'cancelled',
  'Paid'    :   'paid'
};

const CURRENCY_MAP = {
  '$'  : 'usd',
  '£'  : 'egp',
  '﷼'  : 'irr',
  'DH' : 'aed'
};

const ShooglooGenericApi = function(s_entity) {
  if (!(this instanceof ShooglooGenericApi)) {
    debug("instantiating ShooglooGenericApi for: %s", s_entity);
    return new ShooglooGenericApi(s_entity);
  }

  var that = this;

  this.entity = s_entity ? s_entity.toLowerCase() : '';
  that.clientSoap = require('./api')(this.entity);
  this.eventName = this.entity;

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
        }]
      }
    };
  }

  /**
   * Retrieve all merchant details (deals/cashbacks/etc) from affiiate
   * @returns {undefined}
   */
  this.getMerchants = singleRun(function* () {

    const api_key = that.clientSoap.cfg.api_key;
    const affiliate_id = that.clientSoap.cfg.affiliate_id;
    yield that.clientSoap.setupOffers(that.entity, 'offers');

    const offers = yield that.doApi('OfferFeed', getOfferFeedReq, 'OfferFeedResult.offers.offer');
    const activeOffers = offers.filter((offer) => offer.offer_status.status_id === '1');

    const addOfferForRegion = (offer, creativeInfos, offerWithCreative, searchTerm, countryCode, countryName) => {
      const uaeOffer = _.cloneDeep(offer);
      uaeOffer.allowed_countries = { country: [{country_code : countryCode, country_name : countryName}]};
      const regionCreatives = creativeInfos.filter(creativeInfo => creativeInfo.creative_name.indexOf(searchTerm) !== -1);
      regionCreatives && regionCreatives[0] && offerWithCreative.push(that.prepareMerchant(uaeOffer, regionCreatives[0]));
    };

    const offerWithCreative = [];

    for (var offer of activeOffers) {
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
   * Retrieve all commission details (sales/transactions) from affiiate within given period of time.
   * @returns {undefined}
   */
  this.getCommissionDetails = singleRun(function* () {

    yield that.clientSoap.setupReports(that.entity, 'reports');

    let results = [];
    let transactions = [];
    const startDate = new Date(Date.now() - (270 * 86400 * 1000));
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

    // create a merchant meta data from merchant, cashback & regions objects from DB
    merchantMeta = merge(yield {
      merchants: that.merchantInfo(),
      cashbacks: that.cashbackInfo(),
      regions: that.regionInfo()
    });

    // get the country mappings from DB
    var countryInfo = yield that.countryInfo();

    merchantMeta = processData(merchantMeta, countryInfo);

    if(results) {
      const event_conversions = results[0].event_conversions.event_conversion;
      const conversions = Array.isArray(event_conversions) ? event_conversions : [];
      transactions = conversions.map(prepareCommission).filter(exists);

      return yield sendEvents.sendCommissions(that.eventName, transactions);
    }
  });

  // api call generic function
  this.doApi = co.wrap(function* (method, args, key) {

    let results = yield that.clientSoap[method](args);
    if(results) {
      results = extractAry(results, key);
      // results = rinse(results); // causing issues with date
      return results || [];
    }
    return [];
  });

  // call to data layer to get merchant info
  this.merchantInfo = co.wrap(function* () {
    //let result = yield dataClient.get('/getMerchantInfoByAffiliate/' + AFFILIATE_NAME, null, this);
    //return result.body || [];
  });

  // call to data layer to get merchant cashback info
  this.cashbackInfo = co.wrap(function* () {
    //let result = yield dataClient.get('/getCashbackInfoByAffiliate/' + AFFILIATE_NAME, null, this);
    //return result.body || [];
  });

  // call to data layer to get merchant region info
  this.regionInfo = co.wrap(function* () {
    //let result = yield dataClient.get('/getRegionInfoByAffiliate/' + AFFILIATE_NAME, null, this);
    //return result.body || [];
  });

  // call to data layer to get currencies info
  // this.currencyInfo = co.wrap(function* () {
  //   let result = yield dataClient.get('/getCurrencies/', null, this);
  //   return result.body || [];
  // });

  // call to data layer to get countries info
  this.countryInfo = co.wrap(function* () {
    //let result = yield dataClient.get('/getCountryInfo/', null, this);
    //return result.body || [];
  });
};

var ary = x => _.isArray(x) ? x : [x];

function extractAry(result, key) {
  return result = ary(_.get(result, key) || []);
}

/**
 * Function to prepare a single commission transaction for our data event.
 * @param {Object} o_obj  The individual commission transaction straight from webgains
 * @returns {Object} transaction
 */
function prepareCommission(o_obj) {

  var isDefaulted = false; // to process this differently
  var purchase_amount = Number(o_obj.order_total || "0");
  var commission_amount = Number(o_obj.price || "0");
  var merchant = getMerchantFromMeta(merchantMeta, o_obj.site_offer_id);
  var currency = CURRENCY_MAP[o_obj.currency_symbol];
  var date = new Date(o_obj.event_conversion_date);

  // if the purchase_amount is zero, try to estimate the currency & purchase_amount from DB
  if(purchase_amount == 0){

    if(merchant && merchant.percentageAverage > 0){
      purchase_amount = parseFloat((commission_amount * 100)/merchant.percentageAverage).toFixed(2);
    }

    // very strange but, in some cases the purchase_amount & commission_amount
    // are zero(as the fields might be missing), due to which the above calculations
    // computes to zero, hence checking it once again, and defaulting if needed
    if(purchase_amount == 0){
      purchase_amount = 0.01;
    }

    isDefaulted = true;
    currency = 'usd';
  } else {
    // if order_total is part of the reponse, then estimate the currency & purchase
    // amount in usd
    currency = CURRENCY_MAP[o_obj.order_currency_symbol];
    if(currency != 'usd'){
      var purchaseAmountInUSD = parseFloat(convertPurchaseAmount(purchase_amount, 'usd', currency, date)).toFixed(2);
      purchase_amount = purchaseAmountInUSD;
      currency = 'usd';
    }
  }

  var o_obj =  {
    affiliate_name: AFFILIATE_NAME,
    merchant_name: o_obj.site_offer_name || '',
    merchant_id: o_obj.site_offer_id || '',
    transaction_id: o_obj.macro_event_conversion_id,
    order_id: o_obj.order_id,
    outclick_id: o_obj.subid_1 || o_obj.subid_2,
    currency: currency,
    purchase_amount: parseFloat(purchase_amount),
    commission_amount: parseFloat(commission_amount),
    state: STATE_MAP[o_obj.disposition],
    effective_date: date,
    isDefaulted: isDefaulted
  };

  return o_obj;
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

/**
 * Function to extract a single merchant from merchantMeta object based on  affiliate_id
 * the regions & currencies for a give merchant based of the data in DB
 * @param {Object} merchantMeta  merchant meta data from DB
 * @param {Number} affiliate_id  affiliate_id (program id on affiliate side)
 * @returns {Object} merchant  merchant object
 */
function getMerchantFromMeta(merchantMeta, affiliate_id){

  for (let merchant of merchantMeta) {
    if(Number(merchant.merchant.affiliate_id) == Number(affiliate_id))
      return merchant;
  }
  return;
}

/**
 * Function to process the merchant data which includes, computing percentageAverage & approximating
 * the regions & currencies for a give merchant based of the data in DB
 * @param {Object} merchantMeta  merchant meta data from DB
 * @param {Object} countryInfo  country & currency mapping from DB
 * @returns {Object} merchantMeta  merchant meta data with additional fields
 */
function processData(merchantMeta, countryInfo){

  // create a country map <county, currency>
  var countryMap = countryInfo.reduce(function(map, country) {
    if(country.countries_iso2_code && country.countries_currencies_code){
      map[country.countries_iso2_code.toLowerCase()] = country.countries_currencies_code.toLowerCase();
    }
    return map;
  }, {});

  // for each merchant approximate the purchase price & curriencies
  for (let merchant of merchantMeta) {

    var percentageSum = 0, percentageCounter = 0;
    for (let cashback of merchant.cashbacks) {
      if(cashback.type === 'cashback'){
        if(cashback.rate && cashback.rate > 0){
          percentageSum += parseFloat(cashback.rate);
          percentageCounter++;
        }
      }
    }
    merchant.percentageAverage = 0;
    if(percentageCounter > 0){
      merchant.percentageAverage = parseFloat((percentageSum/percentageCounter).toFixed(2));
    }

    var curriencies = [];
    var regions = merchant.regions[0].regions.split(',');
    for (let region of regions) {
      curriencies.push(countryMap[region]);
    }
    merchant.curriencies = _.uniq(curriencies);
  }

  return merchantMeta;
}

/**
 * Function to convert the purchase amount from one currency to another based on a specific date
 * @param {Number} amount  Amount to be converted
 * @param {String} to  To currency (3 chars)
 * @param {String} from  From currency (3 chars)
 * @param {Date} date  Date of conversation
 * @returns {Number} Amount converted to specific currency from specific currency on a specific date
 */
function convertPurchaseAmount(amount, to, from, date){

  var sync = true;
  var response ;
  co(function* () {
    var reqObj = [{ 'amount': amount, 'to': to, 'from': from, 'date': date }];
    //response = yield dataClient.post('/convertCurrencies/', reqObj, this);
  });

  while(sync) {
    deasync.sleep(100);
    if(response && response.body.length > 0){
      sync = false;
    }
  }

  return response.body[0].amount ? response.body[0].amount : 0 ;
}

module.exports = ShooglooGenericApi;
