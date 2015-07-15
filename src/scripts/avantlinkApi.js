"use strict";

var _ = require('lodash');
var co = require('co');
var debug = require('debug')('avantlink:processor');
var utils = require('ominto-utils');
var sendEvents = require('./support/send-events');
var singleRun = require('./support/single-run');
var merge = require('./support/easy-merge')('lngMerchantId', {
  links: 'Merchant_Id'
});
var client = require('./api-clients').avantlinkClient();

var getMerchants = singleRun(function*(){
  yield sendEvents.sendMerchants('avantlink', merge(yield {
    merchants: client.getMerchants().then(hasPercentage),
    links: client.getTextLinks()
  }));
});

function hasPercentage(merchants) {
  return merchants.filter(m => m.strActionCommissionType === 'percent');
}

module.exports = {
  getMerchants: getMerchants
};
