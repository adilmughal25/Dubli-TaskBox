"use strict";

var _ = require('lodash');
var co = require('co');
var debug = require('debug')('affiliatewindow:api');
var utils = require('ominto-utils');
var sendEvents = require('./send-events');

var client = utils.remoteApis.affiliatewindowClient();


// helper
var ary = x => _.isArray(x) ? x : [x];

var merchantsRunning = false;
function* getMerchants() {
  if (merchantsRunning) { throw 'already-running'; }
  merchantsRunning = true;

  try {
    yield client.setup();
    var merchants = (yield doApiMerchants()).map(m => ({merchant:m}));
    yield doApiCashback(merchants);
    yield sendEvents.sendMerchants('affiliatewindow', merchants);
  } finally {
    merchantsRunning = false;
  }
}

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


function ary(x) {
  return _.isArray(x) ? x : [x];
}

module.exports = {
  getMerchants: getMerchants
};
