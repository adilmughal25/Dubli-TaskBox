"use strict";

var _ = require('lodash');
var co = require('co');
var debug = require('debug')('avantlink:api');
var utils = require('ominto-utils');
var sendEvents = require('./send-events');

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

function merge(o_obj) {
  var empty = x => ({merchant:x, links:[]});
  var results = o_obj.merchants
    .reduce( (m,x) => _.set(m, x.lngMerchantId, empty(x)), {});
  delete o_obj.merchants;

  o_obj.links.forEach(function(o_link) {
    if (!results[o_link.Merchant_Id]) return;
    results[o_link.Merchant_Id].links.push(o_link);
  });
  delete o_obj.links;

  return _.values(results);
}

module.exports = {
  getMerchants: getMerchants
};
