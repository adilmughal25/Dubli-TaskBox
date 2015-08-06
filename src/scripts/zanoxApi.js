"use strict";

const _ = require('lodash');
const co = require('co');
const debug = require('debug')('zanox:processor');
const moment = require('moment');
const utils = require('ominto-utils');
const sendEvents = require('./support/send-events');
const singleRun = require('./support/single-run');

const merge = require('./support/easy-merge')('@id', {
  admedia: 'program.@id',
  incentives: 'program.@id',
  exclusiveIncentives: 'program.@id'
});

const client = require('./api-clients/zanox')();

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

var getCommissionDetails = singleRun(function* () {
  const queue = [];
  const days = 2;
  const add = (date, type) => queue.push(pagedApiCall('$getAllSalesOfDate', 'saleItems.saleItem', {datetype: type}, [date]));
  for (let i = 0; i < days; i++) {
    let date = moment().subtract(i, 'days').format('YYYY-MM-DD');
    add(date, 'tracking_date');
    add(date, 'modified_date');
  }
  const results = yield queue;
  const allRecords = results.reduce( (m,i) => m.concat(i), [] );
  const all = _.values(_.indexBy(allRecords, '@id'));
  const exists = x => !!x;
  const events = all.map(prepareCommission).filter(exists);
  sendEvents.sendCommissions('zanox', events);
});

// 'confirmed' means payment is approved and will happen soon, so we can count it as 'paid'
const STATE_MAP = {
  open: 'tracked',
  rejected: 'cancelled',
  approved: 'confirmed',
  confirmed: 'paid'
};

function prepareCommission(o_obj) {
  const event = {
    transaction_id: _.get(o_obj, '@id'),
    outclick_id: _.get(o_obj, 'subPublisher.@id'),
    purchase_amount: o_obj.amount,
    commission_amount: o_obj.commission,
    currency: o_obj.currency,
    state: STATE_MAP[o_obj.reviewState],
    effective_date: o_obj.reviewState === 'open' ?
      o_obj.tracking_date : o_obj.modifiedDate
  };
  return o_obj;
}

var pagedApiCall = co.wrap(function* (method, bodyKey, params, prefix) {
  var results = [];
  var perPage = 50;
  var page = 0;
  var total = 0;

  var start = Date.now();
  while(true) {
    var arg = _.extend({}, params, {page:page, items:perPage});
    debug("%s : page %d of %s (%s)", method, page, Math.floor(total/perPage) || 'unknown', JSON.stringify({args:arg,prefix:prefix}));
    var response;
    if (prefix) {
      var argList = (_.isArray(prefix) ? prefix : [prefix]).concat([arg]);
      response = yield client[method].apply(client, argList);
    } else {
      response = yield client[method](arg);
    }
    if (_.isArray(response) && response.length === 1) response = response[0];
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
  getMerchants: getMerchants,
  getCommissionDetails: getCommissionDetails
};
