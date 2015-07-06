"use strict";

var _ = require('lodash');
var co = require('co');
var debug = require('debug')('avantlink:api');
var utils = require('ominto-utils');
var sendEvents = require('./support/send-events');
var merge = require('./support/easy-merge')('lngMerchantId', {
  links: 'Merchant_Id'
});
var client = utils.remoteApis.avantlinkClient();


var merchantsRunning = false;
function* getMerchants() {
  if (merchantsRunning) { throw 'already-running'; }
  merchantsRunning = true;

  try {
    yield sendEvents.sendMerchants('avantlink', merge(yield {
      merchants: client.getMerchants().then(hasPercentage),
      links: client.getTextLinks()
    }));
  } finally {
    merchantsRunning = false;
  }
}

function hasPercentage(merchants) {
  return merchants.filter(m => m.strActionCommissionType === 'percent');
}

module.exports = {
  getMerchants: getMerchants
};
