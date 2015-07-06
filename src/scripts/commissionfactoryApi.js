"use strict";

var _ = require('lodash');
var co = require('co');
var debug = require('debug')('commissionfactory:api');
var utils = require('ominto-utils');
var sendEvents = require('./support/send-events');

var merge = require('./support/easy-merge')('id', {
  coupons: 'merchantId',
  links: 'merchantId'
});

var client = utils.remoteApis.commissionfactoryClient();

const MERCHANT_URL = '/Merchants?status=Joined&commissionType=Percent per Sale';
const COUPONS_URL = '/Coupons';
const PROMOTIONS_URL = '/Promotions';

var merchantsRunning = false;
function* getMerchants() {
  if (merchantsRunning) { throw 'already-running'; }
  merchantsRunning = true;

  try {
    var results = yield {
      merchants: client.get(MERCHANT_URL),
      coupons: client.get(COUPONS_URL),
      links: client.get(PROMOTIONS_URL)
    };

    var merchants = merge(results);
    console.log("got merchants: ", merchants);

    yield sendMerchantsToEventHub(merchants);
  } finally {
    merchantsRunning = false;
  }
}

function sendMerchantsToEventHub(merchants) {
  if (! merchants) { merchants = []; }
  debug("found %d merchants to process", merchants.length);
  return sendEvents.sendMerchants('commissionfactory', merchants);
}


module.exports = {
  getMerchants: getMerchants
};
