"use strict";

/*
 * The entire process of getting the merchant information will take many minutes!
 *
 * In order to get all necessary merchant data, we would need to requests:
 * - getPrograms() - paginated with 500 rows per requests (approx 2 calls)
 * - getProgramDetails() - for each program we have to perform a single call to get details (#programs * 1)
 * - getVoucherCodes() - paginated call to fetch all vouchers (approx 2-5 calls)
 * - searchCommonAds() - paginated call to fetch all common ads (over 12,500 ads) *slow api - approx 50sec per call
 * Documentation suggests we have 2,000 request/hour - however it repeatingly failed already after ~656 requests on Ominto acc but not on DubLi.
 */

const _ = require('lodash');
const co = require('co');
const debug = require('debug')('belboon:processor');
const moment = require('moment');
const sendEvents = require('./support/send-events');
const singleRun = require('./support/single-run');
const jsonify = require('./api-clients/jsonify-xml-body');

const merge = require('./support/easy-merge')('programid', {
  details:  'programid',
  vouchers: 'programid',
  promos: 'programid',
});

const PROGRAMS_ARGS = {
  // *adPlatformId:      BelboonGenericApi.client.siteId,
  partnershipStatus:  'PARTNERSHIP',  // partnershipStatus (AVAILABLE, PENDING, PARTNERSHIP, PAUSED, REJECTED)
  // programLanguage:    null, // programLanguage
  // query:              null, // utf8_encode('gewinn'), // query
  // orderBy:            [],   // orderBy array('programid' => 'ASC')
};

const VOUCHER_ARGS = {
  // *adPlatformIds: [BelboonGenericApi.client.siteId], // array of adPlatformId's *required
  hasPartnership: true,   // true|false, filter for vouchers with a active partner relationship
  // programId: null,      // filter for specific programId only
  // query: null,
  // voucherCode: null,
  // voucherType: null,    // "CODE" or„LINK", or null for no filter
  // validFrom: null       // by default current date
  // validTo: null,
  // orderBy: null,
};

const COMMON_ADS_ARGS = {
  // *adPlatformIds: [BelboonGenericApi.client.siteId], // array of adPlatformId's *required
  hasPartnership: true,   // true|false, filter for vouchers with a active partner relationship
  // programId: null,      // filter for specific programId only
  adType: 'TEXT',
	// adWidth: null,
	// adHeight: null,
	// orderBy: null,
};

const ary = x => _.isArray(x) ? x : [x];
function extractAry(key) {
  return resp => ary(_.get(resp, key) || []);
}

const BelboonGenericApi = function(s_entity) {
  if (!(this instanceof BelboonGenericApi)) {
    debug("instantiating BelboonGenericApi for: %s", s_entity);
    return new BelboonGenericApi(s_entity);
  }

  var that = this;

  this.entity = s_entity ? s_entity.toLowerCase() : 'ominto';
  this.client = require('./api-clients/belboon')(this.entity);
  this.eventName = (this.entity !== 'ominto' ? this.entity + '-' : '') + 'belboon';

  this.getMerchants = singleRun(function* () {
    yield that.client.setup();
    let response = [];

    let programs = yield that.pagedApiCall('getPrograms', 'result.handler.programs.item', _.merge({}, PROGRAMS_ARGS, {adPlatformId: that.client.siteId}));
    const merchants = programs.map((n) => {
      return n.item.reduce( (m,i) => _.extend(m, i), {});
    });

    // prepare an array of program ids for requesting further details for each
    let programIds = merchants.map((m) => {
      return m.programid;
    });

    // get all details for each single program id
    let programDetails = [];
    for( let i=0; i<programIds.length; i++) {
      response = yield that.apiCall('getProgramDetails', 'result.handler', {programId: programIds[i]});
      response[0].programid = programIds[i];
      programDetails.push(response[0]);
    }

    // get all vouchers available for our siteId
    response = yield that.pagedApiCall('getVoucherCodes', 'result.handler.voucherCodes.item', _.merge({}, VOUCHER_ARGS, {adPlatformIds: [that.client.siteId]}));
    const vouchers = response.map((n) => {
      return n.item.reduce( (m,i) => _.extend(m, i), {});
    });

    // get all common ads for our siteId
    response = yield that.pagedApiCall('searchCommonAds', 'result.handler.commonAds.item', _.merge({}, COMMON_ADS_ARGS, {adPlatformIds: [that.client.siteId]}));
    const commonads = response.map((n) => {
      return n.item.reduce( (m,i) => _.extend(m, i), {});
    });

    const events = merge({
      merchants: merchants,
      details: programDetails,
      vouchers: vouchers,
      promos: commonads,
    });

    yield sendEvents.sendMerchants(that.eventName, events);
  });

  this.getCommissionDetails = singleRun(function* () {
    yield that.client.setup();
    const startDate = new Date(Date.now() - (30 * 86400 * 1000));
    const endDate = new Date(Date.now() - (60 * 1000));
    let response = [];
    let args = {
      adPlatformIds: [that.client.siteId],
      eventChangeDateStart: moment(startDate).format('YYYY-MM-DD'),
      eventChangeDateEnd: moment(endDate).format('YYYY-MM-DD')
    };

    response = yield that.pagedApiCall('getEventList', 'result.handler.events.item', args);
    const events = response.map((n) => {
      return n.item.reduce( (m,i) => _.extend(m, i), {});
    }).map(prepareCommission);

    yield sendEvents.sendCommissions(that.eventName, events);
  });

  /**
   * Perform paginated api requests to any specified method of api client.
   * @param {String} method - The method of the api to call
   * @param {String} bodyKey - Attribute name/path in response body object to deep select as results
   * @param {Object} params - The params to pass onto the api method
   * @returns {Array}
   */
  this.pagedApiCall = co.wrap(function* (method, bodyKey, params) {
    let results = [];
    let limit = 500;
    let offset = 0;
    let total = 0;
    let start = Date.now();

    // check that we call a method which actually is provided by the api client
    if (typeof that.client[method] !== 'function') {
      throw new Error("Method " + method + " is not available by our api client.");
    }

    // perform api calls with pagination until we reach total items to fetch
    while(true) {
      let arg = _.merge({}, params, {offset:offset, limit:limit});

      debug("%s: fetch %d items with offset %d (%s)", method, limit, offset, JSON.stringify({args:arg}));

      let items = yield that.apiCall(method, bodyKey, arg);
      results = results.concat(items);

      // response doesnt provide any totals, so we have to request until 0 items returned
      if (items.length > 0) {
        offset += limit;
      } else {
        break;
      }
    }

    let end = Date.now();
    debug("%s finished: %d items over %d requests (%dms)", method, results.length, Math.ceil(offset/limit), end-start);

    return results;
  });

  this.numApiCalls = 0;
  this.apiCall = co.wrap(function* (method, bodyKey, params) {
    // check that we call a method which actually is provided by the api client
    if (typeof that.client[method] !== 'function') {
      throw new Error("Method " + method + " is not available by our api client.");
    }

    debug("#%d. api call for %s (%s)", ++that.numApiCalls, method, JSON.stringify({params:params}));

    // perform actual api call
    return yield that.client[method](params)
      .then(extractAry(bodyKey))
      .then(resp => rinse(resp))
    ;
  });
};

const STATUS_MAP = {
  REJECTED: 'cancelled',
  PENDING:  'initiated',
  APPROVED: 'confirmed'
};

function prepareCommission(o_obj) {
  const event = {
    affiliate_name: o_obj.programname,
    transaction_id: o_obj.eventid,
    outclick_id: o_obj.subid,
    currency: o_obj.eventcurrency.toLowerCase(),
    purchase_amount: o_obj.netvalue,
    commission_amount: o_obj.eventcommission,
    state: STATUS_MAP[o_obj.eventstatus],
    effective_date: o_obj.lastchangedate
  };

  return event;
}

// rinse: removes SOAP-y residue
function rinse(any) {
  if (_.isString(any)) return any;
  if (_.isArray(any)) return any.map(rinse);
  if (_.isObject(any)) {
    delete any.attributes;
    if (any.$value) {
      return any.$value;
    }

    // belboon returns dynamic assoc array like "<item><key>DynParamName</key><value>DynValue</value></item>"
    if (any.key) {
      any[any.key.$value] = any.value ? any.value.$value : '';
      delete any.key;
      delete any.value;
      return any;
    }

    return _.mapValues(any, rinse);
  }
  return any;
}

module.exports = BelboonGenericApi;
