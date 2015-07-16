"use strict";

var _ = require('lodash');
var co = require('co');
var debug = require('debug')('affiliatewindow:processor');
var sendEvents = require('./support/send-events');
var singleRun = require('./support/single-run');
var client = require('./api-clients/affiliatewindow')();

// helper
var ary = x => _.isArray(x) ? x : [x];

var getMerchants = singleRun(function*() {
  yield client.setup();
  var merchants = (yield doApiMerchants()).map(m => ({merchant:m}));
  yield doApiCashback(merchants);
  yield sendEvents.sendMerchants('affiliatewindow', merchants);
});

var doApiMerchants = co.wrap(function* (){
  var response = yield client.getMerchantList({sRelationship:'joined'});
  return ary(response.getMerchantListReturn.Merchant);
});

var doApiCashback = co.wrap(function* (a_merchants) {
  for (var i = 0; i < a_merchants.length; i++) {
    var rec = a_merchants[i];
    var merchant = rec.merchant;
    var cg = yield client.getCommissionGroupList({iMerchantId: merchant.iId});
    cg = ary(cg.getCommissionGroupListReturn.CommissionGroup);
    merchant.commissions = cg;
  }
});

module.exports = {
  getMerchants: getMerchants
};
