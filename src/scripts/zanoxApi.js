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

var client = require('./api-clients/zanox')();

var getMerchants = singleRun(function*() {
  var joined = yield pagedApiCall('$getProgramApplications', 'programApplicationItems.programApplicationItem', {'status':'confirmed'});

  var validIds = _.pluck(joined, 'program.@id').reduce((m,i) => _.set(m,i,1), {});
  var results = yield {
    merchants: pagedApiCall('$getPrograms', 'programItems.programItem', {'partnership':'DIRECT'}),
    admedia: pagedApiCall('$getAdmedia', 'admediumItems.admediumItem', {'admediumtype':'text','partnership':'direct'}),
    incentives: apiCall('$getIncentives', 'incentiveItems.incentiveItem', {'incentiveType':'coupons'}),
    exclusiveIncentives: apiCall('$getExclusiveIncentives', 'incentiveItems.incentiveItem', {'incentiveType':'coupons'}),
  };
  var merchants = merge(results);

  // sadly, zanox doesn't let us clamp any of the above 4 api calls to only
  // merchants which we have actually applied for. this bit filters the list
  // down to just those merchants who we are joined to.
  merchants = onlyValid(merchants, validIds);

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

function onlyValid(a_items, o_validIds) {
  var fs = require('fs');
  return a_items.filter( x => !! o_validIds[_.get(x,'merchant.@id')] );
}

module.exports = {
  getMerchants: getMerchants
};
