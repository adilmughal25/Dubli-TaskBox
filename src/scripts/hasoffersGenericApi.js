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

function createApiProcessor(s_networkName) {
  var client = require('./api-clients/hasoffers')(s_networkName);
  var debug = require('debug')(s_networkName + ':hasoffers:processor');

  var getMerchants = singleRun(function* (){
    var results = yield {
      merchants: doApiAffiliateOffers(),
      images: doApiAffiliateOfferImages()
    };
    yield doApiGetAllTrackingLinks(results.merchants);
    var merged = merge(results);
    yield sendEvents.sendMerchants(s_networkName, merged);
  });

  var doApiGetAllTrackingLinks  = co.wrap(function* (merchants) {
    for (var i = 0; i < merchants.length; i++) {
      var merchant = merchants[i];
      var url = client.url('Affiliate_Offer', 'generateTrackingLink', {offer_id:merchant.id});
      debug("fetch %s", url);
      var response = yield client.get(url);
      merchant.click_url = response.response.data.click_url;
    }
  });

  var doApiAffiliateOffers = co.wrap(function* (){
    var url = client.url('Affiliate_Offer', 'findAll', {
      'filters[status]': 'active',
      'filters[payout_type]': 'cpa_percentage'
    });
    debug("fetch %s", url);
    var response = yield client.get(url);
    var offers = _.pluck(_.values(response.response.data), 'Offer');
    return offers;
  });

  var doApiAffiliateOfferImages = co.wrap(function* () {
    const url = client.url('Affiliate_OfferFile', 'findAll', {
      'filters[type]': 'offer thumbnail',
      limit: '10000'
    });
    debug("fetch %s", url);
    const response = yield client.get(url);
    const images = _.pluck(_.values(response.response.data.data), 'OfferFile');
    return images;
  });


  const commFields = 'affiliate_info1 id currency approved_payout sale_amount datetime conversion_status'
    .split(' ')
    .map(f => 'Stat.'+f);
  var getCommissionDetails = co.wrap(function* () {
    const start = moment().subtract(30, 'days').format('YYYY-MM-DD');
    const end = moment().format('YYYY-MM-DD');
    let results = [];
    let page = 1;
    while (true) {
      const url = client.url('Affiliate_Report', 'getConversions', {
        'data_start': start,
        'data_end': end,
        'fields[]': commFields,
        'limit': 1000,
        'page': page
      });
      const response = yield client.get(url);
      if (response.response.status == -1) throw new Error("Error in "+s_networkName+" commission processing: "+response.response.errorMessage);
      results = results.concat(response.response.data.data || []);
      if (response.response.data.pageCount >= page) break;
      page += 1;
    }

    const events = results.map(prepareCommission);
    yield sendEvents.sendCommissions(s_networkName, events);
  });

  const STATUS_MAP = {
    'pending': 'initiated',
    'approved': 'confirmed',
    'rejected': 'cancelled'
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

  var proc = {
    getMerchants: getMerchants,
    getCommissionDetails: getCommissionDetails
  };
  return proc;
}

module.exports = createApiProcessor;
