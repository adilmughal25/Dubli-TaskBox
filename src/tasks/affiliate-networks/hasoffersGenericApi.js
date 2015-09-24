"use strict";

const _ = require('lodash');
const utils = require('ominto-utils');
const co = require('co');
const moment = require('moment');
const sendEvents = require('./support/send-events');
const singleRun = require('./support/single-run');

const merge = require('./support/easy-merge')('id', {
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
  this.client = require('./api-clients/hasoffers')(this.entity, s_networkName);
  this.eventName = (this.entity !== 'ominto' ? this.entity + '-' : '') + 'hasoffer-' + s_networkName;

  const debug = require('debug')(this.eventName + ':processor');

  this.getMerchants = singleRun(function* (){
    var results = yield {
      merchants: that.doApiAffiliateOffers(),
      images: that.doApiAffiliateOfferImages()
    };

    yield that.doApiGetAllTrackingLinks(results.merchants);
    var merged = merge(results);
    return yield sendEvents.sendMerchants(that.eventName, merged);
  });

  this.doApiGetAllTrackingLinks  = co.wrap(function* (merchants) {
    for (var i = 0; i < merchants.length; i++) {
      var merchant = merchants[i];
      var url = that.client.url('Affiliate_Offer', 'generateTrackingLink', {offer_id:merchant.id});
      debug("fetch %s", url);

      var response = yield that.client.get(url);
      merchant.click_url = response.response.data.click_url;
    }
  });

  this.doApiAffiliateOffers = co.wrap(function* (){
    var url = that.client.url('Affiliate_Offer', 'findAll', {
      'filters[status]': 'active',
      'filters[payout_type]': 'cpa_percentage'
    });
    debug("fetch %s", url);

    var response = yield that.client.get(url);
    var offers = _.pluck(_.values(response.response.data), 'Offer');
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

  const commFields = 'affiliate_info1 id currency approved_payout sale_amount datetime conversion_status'
    .split(' ')
    .map(f => 'Stat.'+f);

  this.getCommissionDetails = co.wrap(function* () {
    const start = moment().subtract(30, 'days').format('YYYY-MM-DD');
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

      const response = yield that.client.get(url);
      if (response.response.status == -1) throw new Error("Error in "+s_networkName+" commission processing: "+response.response.errorMessage);
      results = results.concat(response.response.data.data || []);
      if ( page >= Number(response.response.data.pageCount)) break;  // value can be "null"
      page += 1;
    }

    const events = results.map(prepareCommission);
    return yield sendEvents.sendCommissions(that.eventName, events);
  });
};

function prepareCommission(o_obj) {
  const S = o_obj.Stat;
  const event = {
    transaction_id: S.id,
    outclick_id: S.affiliate_info1,
    purchase_amount: S.sale_amount,
    commission_amount: S.approved_payout,
    currency: S.currency,
    state: STATUS_MAP[S.conversion_status],
    effective_date: S.conversion_status === 'pending' ? new Date(S.datetime) : 'auto'
  };
  return event;
}

module.exports = HasOffersGenericApi;
