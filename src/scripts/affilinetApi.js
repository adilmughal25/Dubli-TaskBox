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
var client = require('./api-clients').affilinetClient();

var getMerchants = singleRun(function*() {
  yield client.ensureLoggedIn();
  var merchants = yield client.getPrograms();
  var ids = _.pluck(merchants, 'ProgramId');
  var results = yield {
    coupons: client.getVouchers(),
    links: client.getCreatives({programIds:ids}),
  };

  results.merchants = merchants;
  var merged = merge(results);
  yield sendEvents.sendMerchants('affilinet', merchants);
});


module.exports = {
  getMerchants: getMerchants
};
