"use strict";

var _ = require('lodash');
var co = require('co');
var debug = require('debug')('pepperjam:processor');
var utils = require('ominto-utils');
var sendEvents = require('./support/send-events');
var singleRun = require('./support/single-run');

var client = require('./api-clients').pepperjamClient();

var merge = require('./support/easy-merge')('id', {
  coupons: 'program_id',
  links: 'program_id',
  generic: 'program_id'
});

var getMerchants = singleRun(function*(){
  var results = yield {
    merchants: client.getPaginated('/publisher/advertiser', {status:'joined'}),
    coupons: client.getPaginated('/publisher/creative/coupon'),
    links: client.getPaginated('/publisher/creative/text'),
    generic: client.getPaginated('/publisher/creative/generic')
  };

  var merchants = merge(results);
  yield sendEvents.sendMerchants('pepperjam', merchants);
});

module.exports = {
  getMerchants: getMerchants
};
