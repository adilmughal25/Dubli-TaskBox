"use strict";

var _ = require('lodash');
var co = require('co');
var debug = require('debug')('publicideas:api');
var utils = require('ominto-utils');
var sendEvents = require('./support/send-events');

var client = utils.remoteApis.publicideasClient();
var ary = x => _.isArray(x) ? x : [x];
var merchantsRunning = false;
function* getMerchants() {
  if (merchantsRunning) { throw 'already-running'; }
  merchantsRunning = true;

  try {
    var merchants = yield client.getMerchants();
    merchants = clean(merchants);
    yield sendEvents.sendMerchants('publicideas', merchants);
  } finally {
    merchantsRunning = false;
  }
}

// massage the input a tiny little bit, mostly for ease-of-use on the lambda side
function clean(merchants) {
  return merchants.map(function(merchant) {
    var links = ary(_.get(merchant, 'promotional_elements.links.link') || []);
    var cashback = ary(_.get(merchant, 'commissions.global_commission') || []);
    var m = _.omit(merchant, 'promotional_elements', 'commissions');
    m.feeds = merchant.promotional_elements.feeds;
    var rec = {
      merchant: m,
      cashback: cashback,
      links: links
    };
    return rec;
  });
}

module.exports = {
  getMerchants: getMerchants
};
