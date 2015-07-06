"use strict";

var _ = require('lodash');
var debug = require('debug')('vcommission:api');
var utils = require('ominto-utils');
var co = require('co');
var sendEvents = require('./support/send-events');
var merge = require('./support/easy-merge')('id', {
  images: 'offer_id',
});

var client = utils.remoteApis.vcommissionClient();

var merchantsRunning = false;
function* getMerchants() {
  if (merchantsRunning) { throw 'already-running'; }
  merchantsRunning = true;
  try {
    var results = yield {
      merchants: doApiAffiliateOffers(),
      images: doApiAffiliateOfferImages()
    };
    yield doApiGetAllTrackingLinks(results.merchants);
    var merged = merge(results);
    yield sendEvents.sendMerchants('vcommission', merged);
    // console.log("results", results);
  } finally {
    merchantsRunning = false;
  }
}

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

module.exports = {
  getMerchants: getMerchants
};
