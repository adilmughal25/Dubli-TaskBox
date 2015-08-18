"use strict";

var _ = require('lodash');
var co = require('co');
var debug = require('debug')('publicideas:processor');
var utils = require('ominto-utils');
var sendEvents = require('./support/send-events');
var singleRun = require('./support/single-run');

var createClient = require('./api-clients/publicideas');
var ary = x => _.isArray(x) ? x : [x];


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

function setup(s_region) {
  const client = createClient(s_region);
  const getMerchants = singleRun(function* (){
    const merchantsRaw = yield client.getMerchants();
    const merchants = clean(merchantsRaw);
    yield sendEvents.sendMerchants('publicideas-'+s_region, merchants);
  });

  const tasks = {
    getMerchants: getMerchants
  };
  return tasks;
}

module.exports = setup;
