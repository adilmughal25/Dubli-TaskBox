"use strict";

var _ = require('lodash');
var co = require('co');
var debug = require('debug')('commissionfactory:processor');
var utils = require('ominto-utils');
var sendEvents = require('./support/send-events');
var singleRun = require('./support/single-run');

var merge = require('./support/easy-merge')('Id', {
  coupons: 'merchantId',
  links: 'merchantId'
});

var client = require('./api-clients/commissionfactory')();

const MERCHANT_URL = '/Merchants?status=Joined&commissionType=Percent per Sale';
const COUPONS_URL = '/Coupons';
const PROMOTIONS_URL = '/Promotions';

var getMerchants = singleRun(function*() {
  var results = yield {
    merchants: client.get(MERCHANT_URL),
    coupons: client.get(COUPONS_URL),
    links: client.get(PROMOTIONS_URL)
  };
  // console.log(JSON.stringify(results, null, 2));
  var merchants = merge(results);
  yield sendEvents.sendMerchants('commissionfactory', merchants);
});

module.exports = {
  getMerchants: getMerchants
};
