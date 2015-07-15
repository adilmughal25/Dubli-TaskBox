"use strict";

var _ = require('lodash');
var co = require('co');
var debug = require('debug')('zanox:processor');
var utils = require('ominto-utils');
var sendEvents = require('./support/send-events');
var singleRun = require('./support/single-run');

var merge = require('./support/easy-merge')('@id', {
  admedia: 'program.@id',
  incentives: 'program.@id',
  exclusiveIncentives: 'program.@id'
});

var client = require('./api-clients').zanoxClient();

var getMerchants = singleRun(function*() {
  var results = yield {
    merchants: pagedApiCall('$getPrograms', 'programItems.programItem'),
    admedia: pagedApiCall('$getAdmedia', 'admediumItems.admediumItem', {'admediumtype':'text'}),
    incentives: apiCall('$getIncentives', 'incentiveItems.incentiveItem', {'incentiveType':'coupons'}),
    exclusiveIncentives: apiCall('$getExclusiveIncentives', 'incentiveItems.incentiveItem', {'incentiveType':'coupons'}),
  };
  var merchants = merge(results);
  sendEvents.sendMerchants('zanox', merchants);
});

var pagedApiCall = co.wrap(function* (method, bodyKey, params) {
  var results = [];
  var perPage = 50;
  var page = 0;
  var total = 0;

  var start = Date.now();
  while(true) {
    var arg = _.extend({}, params, {page:page, items:perPage});
    debug("%s : page %d of %s (%s)", method, page, Math.floor(total/perPage) || 'unknown', JSON.stringify(arg));
    var response = yield client[method](arg);
    var items = _.get(response, bodyKey) || [];
    results = results.concat(items);
    total = response.total;
    if (++page * perPage >= response.total) break;
  }
  var end = Date.now();

  debug("%s finished: %d items over %d pages (%dms)", method, results.length, page-1, end-start);

  return results;
});

var apiCall = co.wrap(function* (method, bodyKey, params) {
  var start = Date.now();
  var arg = _.extend({}, params);
  debug("%s (%s)", method, JSON.stringify(arg));
  var response = yield client[method](arg);
  var items = _.get(response, bodyKey) || [];
  var end = Date.now();
  debug("%s finished: %d items (%dms)", method, items.length, end-start);
  return items;
});

module.exports = {
  getMerchants: getMerchants
};
