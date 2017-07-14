"use strict";

const _ = require('lodash');
const co = require('co');
const _debug = (a,b) => require('debug')(['zanox', 'processor', a, b].join(':'));
const moment = require('moment');
const utils = require('ominto-utils');
const sendEvents = require('../support/send-events');
const singleRun = require('../support/single-run');

const AFFILIATE_NAME = 'zanox';

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
    let joined = yield that.pagedMerApiCall('$getProgramApplications', 'programApplicationItems.programApplicationItem', {'status':'confirmed'});

    let validIds = _.pluck(joined, 'program.@id').reduce((m,i) => _.set(m,i,1), {});

    // As suggested by zanox, we are adding 'purpose=startpage' query param in admedia to fetch home page urls
    const results = yield {
      merchants: that.pagedMerApiCall('$getPrograms', 'programItems.programItem', {'partnership':'DIRECT'}),
      admedia: that.pagedMerApiCall('$getAdmedia', 'admediumItems.admediumItem', {'admediumtype':'text','partnership':'direct','purpose':'startpage'}),
      incentives: that.pagedMerApiCall('$getIncentives', 'incentiveItems.incentiveItem', {'incentiveType':'coupons'}),
      exclusiveIncentives: that.pagedMerApiCall('$getExclusiveIncentives', 'incentiveItems.incentiveItem', {'incentiveType':'coupons'}),
    };
    //require('graceful-fs').writeFileSync('erf.json', JSON.stringify(results));
    let merchants = merge(results);

    // sadly, zanox doesn't let us clamp any of the above 4 api calls to only
    // merchants which we have actually applied for. this bit filters the list
    // down to just those merchants who we are joined to.
    merchants = onlyValid(merchants, validIds);
    console.log("Zanox: total merchants before adspace cloning: " + merchants.length);

    var newMerchants = [];
    // get all the commission [cashback] models for each merchants
    // for our account all the admedia for all merchants - "@adspaceId": "2067070"
    for(var i = 0; i < merchants.length; i++){
        //console.log("Zanox: processing merchant (id: %s) at index %d/%d", merchants[i].merchant['@id'], i, merchants.length);
        var adSpMerchants = yield that.cloneDuplicateAdSpaceMerchants(merchants[i]);
        //console.log("Zanox: no. of adspace merchants (id: %s) at index %d/%d is %d", merchants[i].merchant['@id'], i, merchants.length, adSpMerchants.length);

        for (var j = 0; j < adSpMerchants.length; j++) {
          newMerchants.push(adSpMerchants[j]);
          // Tracking categories and commissions [cashback]
          // following are test calls
          // let cashback = yield that.apiCall('$getTrackingCategories', 'trackingCategoryItem.trackingCategoryItem', {'programid':400, 'adspaceid': 2067070});
          // let cashback = yield that.apiCall('$getTrackingCategories', 'trackingCategoryItem.trackingCategoryItem', {'programid':18274, 'adspaceid': 2067070});
          //merchants[i].cashback = yield that.apiCall('$getTrackingCategories', 'trackingCategoryItem.trackingCategoryItem', {'programid':_.get(merchants[i], "merchant.@id"), 'adspaceid': 2067070}) || [];
        }
    }

    console.log("Zanox: total merchants after adspace cloning: " + newMerchants.length);
    return yield sendEvents.sendMerchants(that.eventName, newMerchants);
  });

  // changing the number of days for commissions api from 90 days to 30 days,
  // as the volume of api calls made is huge and zanox has raised a concern with the same.
  // please do not change this back to 90 days without approval.
  this.getCommissionDetails = singleRun(function* () {
    const queue = [];
    const days = 30;
    const add = (date, type) => queue.push(that.pagedComApiCall('$getAllSalesOfDate', 'saleItems.saleItem', {datetype: type}, [date]));
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

  this.pagedComApiCall = co.wrap(function* (method, bodyKey, params, prefix) {
    let results = [];
    let perPage = 50;
    let page = 0;
    let total = 0;

    const start = Date.now();
    while(true) {
      let arg = _.extend({}, params, {page:page, items:perPage});
      debug("%s : page %d of %s (%s)", method, page, Math.floor(total/perPage) || 'unknown', JSON.stringify({args:arg,prefix:prefix}));
      let response;

      if (prefix) {
        let argList = (_.isArray(prefix) ? prefix : [prefix]).concat([arg]);
        response = yield that.client[method].apply(that.client, argList);
      } else {
        response = yield that.client[method](arg);
      }

      if (_.isArray(response) && response.length === 1) response = response[0];

      let items = _.get(response, bodyKey) || [];
      results = results.concat(items);
      total = response.total || 0;

      if (++page * perPage >= total) break;
    }
    const end = Date.now();

    debug("%s finished: %d items over %d pages (%dms)", method, results.length, page-1, end-start);

    return results;
  });

  this.pagedMerApiCall = co.wrap(function* (method, bodyKey, params, prefix) {
    let results = [];
    let perPage = 50;
    let page = 0;
    let total = 0;

    const start = Date.now();
    while(true) {
      let arg = _.extend({}, params, {page:page, items:perPage});
      debug("%s : page %d of %s (%s)", method, page, Math.floor(total/perPage) || 'unknown', JSON.stringify({args:arg,prefix:prefix}));
      let response;

      if (prefix) {
        let argList = (_.isArray(prefix) ? prefix : [prefix]).concat([arg]);
        response = yield that.client[method].apply(that.client, argList);
      } else {
        response = yield that.client[method](arg);
      }

      if (_.isArray(response) && response.length === 1) response = response[0];

      let items = _.get(response, bodyKey) || [];
      results = results.concat(items);
      total = response.total || 0;

      if (++page * perPage >= total) break;
    }
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

  this.cloneDuplicateAdSpaceMerchants = co.wrap(function* (input) {
    var rtArray = [];
    var processed = false;

    if (input.admedia && input.admedia.length > 0) {
      try {
        processed = false;
        var length = input.admedia[0].trackingLinks.trackingLink ? input.admedia[0].trackingLinks.trackingLink.length : 0;

        for (let j = 0; j < length; j++) {
          var newMerchant = _.cloneDeep(input);

          newMerchant.admedia[0].trackingLinks.trackingLink = newMerchant.admedia[0].trackingLinks.trackingLink[j];

          if (newMerchant.incentives && newMerchant.incentives.length > 0 &&
            newMerchant.incentives[0].admedia.admediumItem.trackingLinks &&
            newMerchant.incentives[0].admedia.admediumItem.trackingLinks.trackingLink &&
            newMerchant.incentives[0].admedia.admediumItem.trackingLinks.trackingLink.length > 0
          ) {
            newMerchant.incentives[0].admedia.admediumItem.trackingLinks.trackingLink =
              newMerchant.incentives[0].admedia.admediumItem.trackingLinks.trackingLink[j];
          }

          var adspaceId = newMerchant.admedia[0].trackingLinks.trackingLink['@adspaceId'];
          if(adspaceId !== '2067070') {  
            newMerchant.merchant['@id'] = newMerchant.merchant['@id'] + "-(" + adspaceId + ")";
          }

          newMerchant.cashback = yield that.apiCall('$getTrackingCategories', 'trackingCategoryItem.trackingCategoryItem', { 'programid': _.get(input, "merchant.@id"), 'adspaceid': adspaceId }) || [];
          rtArray.push(newMerchant);
          processed = true;
        }
      }
      catch (ex) {
        console.log("ERROR: Using the orginal merchant details as clone failed due to exception: %s", ex);
      }
    }
    
    if(! processed) {
      // if (input.admedia && input.admedia.length > 0 && 
      //     input.admedia[0].trackingLinks && input.admedia[0].trackingLinks.trackingLink) {
      //   var adspaceId = input.admedia[0].trackingLinks.trackingLink['@adspaceId']
      //   input.cashback = yield that.apiCall('$getTrackingCategories', 'trackingCategoryItem.trackingCategoryItem', { 'programid': _.get(input, "merchant.@id"), 'adspaceid': adspaceId }) || [];
      // }
      // else {
      //   console.log("WARN: Unable to find cashback for merchant id %s", input.merchant['@id']);
      // }
      
      // use the default adspace id
      input.cashback = yield that.apiCall('$getTrackingCategories', 'trackingCategoryItem.trackingCategoryItem', { 'programid': _.get(input, "merchant.@id"), 'adspaceid': 2067070 }) || [];
      rtArray.push(input);
    }

    return rtArray;
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
    affiliate_name: AFFILIATE_NAME,
    merchant_name: _.get(o_obj.program, '$') || '',
    merchant_id: _.get(o_obj.program, '@id') || '',
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
