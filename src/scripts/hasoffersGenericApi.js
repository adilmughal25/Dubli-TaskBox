"use strict";

const _ = require('lodash');
const utils = require('ominto-utils');
const co = require('co');
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
    var url = client.url('Affiliate_OfferFile', 'findAll', {
      'filters[type]': 'offer thumbnail',
      limit: '10000'
    });
    debug("fetch %s", url);
    var response = yield client.get(url);
    var images = _.pluck(_.values(response.response.data.data), 'OfferFile');
    return images;
  });

  var proc = {
    getMerchants: getMerchants
  };
  return proc;
}

module.exports = createApiProcessor;
