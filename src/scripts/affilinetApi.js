"use strict";

var _ = require('lodash');
var co = require('co');
var debug = require('debug')('affilinet:processor');
var utils = require('ominto-utils');
var sendEvents = require('./support/send-events');
var singleRun = require('./support/single-run');
var merge = require('./support/easy-merge')('ProgramId', {
  links: 'ProgramId',
  coupons: 'ProgramId'
});
var client = require('./api-clients/affilinet')();

var getMerchants = singleRun(function*() {
  yield client.ensureLoggedIn();
  var results = yield {
    merchants: client.getPrograms(),
    coupons: client.getVouchers()
  };
  var ids = _.pluck(results.merchants, 'ProgramId');
  _.extend(results, yield {
    links: client.getCreatives({programIds:ids}),
  });

  var merged = merge(results);
  yield sendEvents.sendMerchants('affilinet', merged);
});


module.exports = {
  getMerchants: getMerchants
};
