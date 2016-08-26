"use strict";

const _ = require('lodash');
const utils = require('ominto-utils');
const co = require('co');
const moment = require('moment');
const sendEvents = require('../support/send-events');
const singleRun = require('../support/single-run');

const merge = require('../support/easy-merge')('id', {
  images: 'offer_id',
});

const STATUS_MAP = {
  'pending': 'initiated',
  'approved': 'confirmed',
  'rejected': 'cancelled'
};

const HasOffersGenericApi = function(s_networkName, s_entity) {
  if (!s_networkName) throw new Error("HasOffers Generic API needs a network name!");
  if (!(this instanceof HasOffersGenericApi)) return new HasOffersGenericApi(s_networkName, s_entity);

  var that = this;

  this.entity = s_entity ? s_entity.toLowerCase() : 'ominto';
  this.client = require('./api')(this.entity, s_networkName);
  this.eventName = (this.entity !== 'ominto' ? this.entity + '-' : '') + s_networkName;

  const debug = require('debug')(this.eventName + ':processor');

  this.getMerchants = singleRun(function* (){
    var results = yield {
      merchants: that.doApiAffiliateOffers(),
      images: that.doApiAffiliateOfferImages()
    };

    yield that.doApiGetAllTrackingLinks(results.merchants);
    // get country information - by doing a subsequent api call
    yield that.getTargetCountries(results.merchants, s_networkName);
    // get category information - by doing a subsequent api call
    yield that.getTargetCategories(results.merchants);

    var merged = merge(results);
    return yield sendEvents.sendMerchants(that.eventName, merged);
  });

  this.doApiGetAllTrackingLinks  = co.wrap(function* (merchants) {
    for (var i = 0; i < merchants.length; i++) {
      var merchant = merchants[i];
      var url = that.client.url('Affiliate_Offer', 'generateTrackingLink', {
        offer_id:merchant.id
      });
      debug("fetch %s", url);

      var response = yield that.client.get(url);
      merchant.click_url = response.response.data.click_url;
    }
  });

  this.doApiAffiliateOffers = co.wrap(function* (){
    // changing function to fetch merchants from 'findAll/tofindMyOffers' to 'findMyApprovedOffers'.
    // this will only fetch approved merchants instead of all merchants from the affiliate
    var url = that.client.url('Affiliate_Offer', 'findMyApprovedOffers', {
      'filters[status]': 'active',
      'filters[payout_type][]': ['cpa_percentage', 'cpa_flat', 'cpa_both']
    });
    debug("fetch %s", url);

    var response = yield that.client.get(url);
    var offers = that.client.addCurrencies(_.pluck(_.values(response.response.data), 'Offer'));
    return offers;
  });

  this.doApiAffiliateOfferImages = co.wrap(function* () {
    const url = that.client.url('Affiliate_OfferFile', 'findAll', {
      'filters[type]': 'offer thumbnail',
      limit: '10000'
    });
    debug("fetch %s", url);

    const response = yield that.client.get(url);
    const images = _.pluck(_.values(response.response.data.data), 'OfferFile');
    return images;
  });


  /*
  https://api.hasoffers.com/Apiv3/json?NetworkId=arabyads&Target=Affiliate_Report&Method=getConversions&api_key=2f4b194614629ed6fdb455104523d571b4d30f4b8df95eb89b8efbd12ce664c8&fields%5B%5D=Stat.approved_payout&fields%5B%5D=Stat.affiliate_info1&fields%5B%5D=Stat.id&fields%5B%5D=Stat.currency&fields%5B%5D=Stat.sale_amount&fields%5B%5D=Stat.datetime&fields%5B%5D=Stat.conversion_status&limit=1000&page=1&data_start=2016-08-17&data_end=2016-08-17
  const commFields = 'affiliate_info1 id currency approved_payout sale_amount datetime conversion_status'
    .split(' ')
    .map(f => 'Stat.'+f);
  */
  // changing the field 'approved_payout' to 'payout' as per the conversation with
  // hasoffers/tune support team. According to the support team - "Stat.approved_payout
  // it is intended to aggregate the sum of payouts, and not for querying individual conversions.
  // When querying for individual conversions, we advise that you use Stat.payout to be able
  // to use Stat.currency."
  const commFields = 'affiliate_info1 id currency payout sale_amount datetime conversion_status'
    .split(' ')
    .map(f => 'Stat.'+f);

  this.getCommissionDetails = co.wrap(function* () {
    const start = moment().subtract(90, 'days').format('YYYY-MM-DD');
    const end = moment().format('YYYY-MM-DD');
    let results = [];
    let page = 1;

    while (true) {
      const url = that.client.url('Affiliate_Report', 'getConversions', {
        'data_start': start,
        'data_end': end,
        'fields[]': commFields,
        'limit': 1000,
        'page': page
      });

      debug("fetch %s", url);

      const response = yield that.client.get(url);
      if (response.response.status == -1) throw new Error("Error in "+s_networkName+" commission processing: "+response.response.errorMessage);
      if (_.get(response, 'response.errors.publicMessage')) throw new Error("Error in "+s_networkName+" commission processing: " + _.get(response, 'response.errors.publicMessage'));
      results = results.concat(_.get(response, 'response.data.data') || []);
      if ( page >= Number(_.get(response, 'response.data.pageCount'))) break;  // value can be "null"
      page += 1;
    }

    const events = results.map(prepareCommission);
    return yield sendEvents.sendCommissions(that.eventName, events);
  });

  // to get the countries information for the merchant
  this.getTargetCountries = co.wrap(function* (merchants, affiliate){
    for (var i = 0; i < merchants.length; i++) {
      var merchant = merchants[i];
      var url = that.client.url('Affiliate_Offer', 'getTargetCountries', {
        'ids[]':merchant.id
      });
      debug(">> fetch %s", url);

      var countries = [];
      var response = yield that.client.get(url);
      if (response && response.response && response.response.data[0] && response.response.data[0].countries) {
        var countriesMetaData = response.response.data[0].countries || [];
        for (var country in countriesMetaData) {
          if (countriesMetaData.hasOwnProperty(country)) {
            // in our application we dont have uk, hence converted to gb
            if (countriesMetaData[country].code.toLowerCase() === "uk"){
              countries.push("gb");
            }
            else
              countries.push(countriesMetaData[country].code.toLowerCase());
          }
        }
      }
      merchant.country = countries || [];

      // if no region is fetch then default it
      if(merchant.country.length == 0){
        merchant.country = defaultCountry(affiliate);
      }
    }
  });

  // to get the categories information for the merchant
  this.getTargetCategories = co.wrap(function* (merchants){
    for (var i = 0; i < merchants.length; i++) {
      var merchant = merchants[i];
      var url = that.client.url('Affiliate_Offer', 'getCategories', {
        'ids[]':merchant.id
      });
      debug(">> fetch %s", url);
      var response = yield that.client.get(url);
      var categories = [];
      if (response && response.response && response.response.data[0] && response.response.data[0].categories) {
        categories = response.response.data[0].categories || [];
      }
      merchant.categories = categories;
    }
  });
};

function prepareCommission(o_obj) {
  const S = o_obj.Stat;
  const event = {
    transaction_id: S.id,
    order_id: S.id,
    outclick_id: S.affiliate_info1,
    purchase_amount: S.sale_amount,
    //commission_amount: S.approved_payout,
    commission_amount: S.payout,
    currency: S.currency,
    state: STATUS_MAP[S.conversion_status],
    effective_date: S.conversion_status === 'pending' ? new Date(S.datetime) : 'auto'
  };
  return event;
}

// if the merchant country is empty, then default it to country based of the affiliate
// Bug 103 (comments) has the description
function defaultCountry(affiliate){
  var defaultCountry = [];

  // default country is set based of majority country counts of merchants for this affiliate
  switch(affiliate) {
    case 'arabyads':
        defaultCountry = ["ae"];
        break;
    case 'vcommission':
        defaultCountry = ["in"];
        break;
    case 'shopstylers':
        defaultCountry = ["my"];
        break;
    default:
        break;
  }
  return defaultCountry;
}

module.exports = HasOffersGenericApi;
