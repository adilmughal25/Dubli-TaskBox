"use strict";

var _ = require('lodash');
var co = require('co');
var debug = require('debug')('zanox:api');
var utils = require('ominto-utils');
var sendEvents = require('./support/send-events');
var client = utils.remoteApis.zanoxClient();

var merchantsRunning = false;
function* getMerchants() {
  if (merchantsRunning) { throw 'already-running'; }
  merchantsRunning = true;

  var results = yield {
    merchants: pagedApiCall('$getPrograms', 'programItems.programItem'),
    admedia: pagedApiCall('$getAdmedia', 'admediumItems.admediumItem', {'admediumtype':'text'}),
    incentives: apiCall('$getIncentives', 'incentiveItems.incentiveItem', {'incentiveType':'coupons'}),
    exclusiveIncentives: apiCall('$getExclusiveIncentives', 'incentiveItems.incentiveItem', {'incentiveType':'coupons'}),
  };

  // require('fs').writeFileSync('zanox.test.json', JSON.stringify(results), 'utf8');
  var merchants = merge(results);

  sendMerchantsToEventHub(merchants);
  merchantsRunning = false;
}

function merge(o_obj) {
  var results = {};

  var _push = function push(key, idField) {
    return function(item) {
      var id = _.get(item, idField);
      if (!results[id]) return;
      results[id][key].push(item);
    };
  };

  o_obj.merchants.forEach(function(merchant) {
    var id = merchant['@id'];
    results[id] = {
      merchant: merchant,
      admedia: [],
      incentives: [],
      exclusiveIncentives: []
    };
  });
  delete o_obj.merchants;


  o_obj.admedia.forEach(_push('admedia', 'program.@id'));
  delete o_obj.admedia;

  o_obj.incentives.forEach(_push('incentives', 'program.@id'));
  delete o_obj.incentives;

  o_obj.exclusiveIncentives.forEach(_push('exclusiveIncentives', 'program.@id'));
  delete o_obj.exclusiveIncentives;

  return _.values(results);
}

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

function sendMerchantsToEventHub(merchants) {
  if (! merchants) { merchants = []; }
  debug("found %d merchants to process", merchants.length);
  return sendEvents.sendMerchants('zanox', merchants);
}

module.exports = {
  getMerchants: getMerchants
};