"use strict";

const _ = require('lodash');
const co = require('co');
const _debug = (a,b) => require('debug')(['zanox', 'processor', a, b].join(':'));
const moment = require('moment');
const utils = require('ominto-utils');
const sendEvents = require('../support/send-events');
const singleRun = require('../support/single-run');

const merge = require('../support/easy-merge')('@id', {
  admedia: 'program.@id',
  incentives: 'program.@id',
  exclusiveIncentives: 'program.@id'
});
const ary = x => _.isArray(x) ? x : [x];

// 'confirmed' means payment is approved and will happen soon, so we can count it as 'paid'
const STATE_MAP = {
  open: 'initiated',
  rejected: 'cancelled',
  approved: 'confirmed',
  confirmed: 'paid'
};

const ZanoxGenericApi = function(s_region, s_entity) {
  const debug = _debug(s_region, s_entity);
  if (!(this instanceof ZanoxGenericApi)) {
    debug("instantiating ZanoxGenericApi for: %s-%s", s_entity, s_region);
    return new ZanoxGenericApi(s_region, s_entity);
  }

  var that = this;

  this.entity = s_entity ? s_entity.toLowerCase() : 'ominto';
  this.region = s_region ? s_region.toLowerCase() : 'global';
  this.client = require('./api')(this.entity, this.region);
  this.eventName = (this.entity !== 'ominto' ? this.entity + '-' : '') + 'zanox';
  this.eventName += (this.entity === 'ominto' && this.region === 'global') ? '' : '-' + this.region;

  this.getMerchants = singleRun(function*() {
    let joined = yield that.pagedApiCall('$getProgramApplications', 'programApplicationItems.programApplicationItem', {'status':'confirmed'});

    let validIds = _.pluck(joined, 'program.@id').reduce((m,i) => _.set(m,i,1), {});
    const results = yield {
      merchants: that.pagedApiCall('$getPrograms', 'programItems.programItem', {'partnership':'DIRECT'}),
      admedia: that.pagedApiCall('$getAdmedia', 'admediumItems.admediumItem', {'admediumtype':'text','partnership':'direct'}),
      incentives: that.apiCall('$getIncentives', 'incentiveItems.incentiveItem', {'incentiveType':'coupons'}),
      exclusiveIncentives: that.apiCall('$getExclusiveIncentives', 'incentiveItems.incentiveItem', {'incentiveType':'coupons'}),
    };
    // require('fs').writeFileSync('erf.json', JSON.stringify(results));
    let merchants = merge(results);

    // sadly, zanox doesn't let us clamp any of the above 4 api calls to only
    // merchants which we have actually applied for. this bit filters the list
    // down to just those merchants who we are joined to.
    merchants = onlyValid(merchants, validIds);

    return yield sendEvents.sendMerchants(that.eventName, merchants);
  });

  // changing the number of days for commissions api from 90 days to 30 days,
  // as the volume of api calls made is huge and zanox has raised a concern with the same.
  // please do not change this back to 90 days without approval.
  this.getCommissionDetails = singleRun(function* () {
    const queue = [];
    const days = 160;
    const add = (date, type) => queue.push(that.pagedApiCall('$getAllSalesOfDate', 'saleItems.saleItem', {datetype: type}, [date]));
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

    return yield sendEvents.sendCommissions(that.eventName, events);
  });

  this.pagedApiCall = co.wrap(function* (method, bodyKey, params, prefix) {
    let results = [];
    let perPage = 50;
    let page = 0;
    let total = 0;

    const start = Date.now();
    let arg = _.extend({}, params, {page:page, items:perPage});
    debug("%s : page %d of %s (%s)", method, page, Math.floor(total/perPage) || 'unknown', JSON.stringify({args:arg,prefix:prefix}));
    let response;

    if (prefix) {
      let argList = (_.isArray(prefix) ? prefix : [prefix]).concat([arg]);
      response = yield that.client[method].apply(that.client, argList);
    } else {
      response = yield that.client[method](arg);
    }

    response.forEach((responseItem) => {
      let items = _.get(responseItem, bodyKey) || [];
      results = results.concat(items);
    });

    const end = Date.now();

    debug("%s finished: %d items over %d pages (%dms)", method, results.length, page-1, end-start);

    return results;
  });

  this.apiCall = co.wrap(function* (method, bodyKey, params) {
    const start = Date.now();
    let arg = _.extend({}, params);
    debug("%s (%s)", method, JSON.stringify(arg));

    const response = yield that.client[method](arg);
    let items = _.get(response, bodyKey) || [];
    if (!_.isArray(items)) items = [items];
    const end = Date.now();
    debug("%s finished: %d items (%dms)", method, items.length, end-start);

    return items;
  });
};

/**
 * Find our outclick id / Subid in Zanox action item.
 * Its an *optional* object in the response. If Zanox has no zpar0 value, the object is not defined.
 * Obj: [].gpps.gpp.$
 * @returns {String}
 */
function findSubId(o_obj) {
  const fields = ary(_.get(o_obj, 'gpps.gpp')).reduce((m,x) => {
    return (x !== undefined ? _.set(m, x['@id'], x.$) : {'zpar0':''});
  }, {});

  return fields.zpar0;
}

function prepareCommission(o_obj) {
  const event = {
    transaction_id: _.get(o_obj, '@id'),
    order_id: _.get(o_obj, '@id'),
    outclick_id: findSubId(o_obj),
    purchase_amount: o_obj.amount,
    commission_amount: o_obj.commission,
    currency: o_obj.currency,
    state: STATE_MAP[o_obj.reviewState],
    effective_date: new Date(o_obj.reviewState === 'open' ?
      o_obj.trackingDate : o_obj.modifiedDate)
  };
  return event;
}

function onlyValid(a_items, o_validIds) {
  var fs = require('fs');
  return a_items.filter( x => !! o_validIds[_.get(x,'merchant.@id')] );
}

module.exports = ZanoxGenericApi;
