"use strict";

const _ = require('lodash');
const co = require('co');
const debug = require('debug')('adcell:processor');
const sendEvents = require('../support/send-events');
const singleRun = require('../support/single-run');

const STATE_MAP = {
  open: 'initiated',
  cancelled: 'cancelled',
  accepted: 'confirmed',
};

var merge = require('../support/easy-merge')(
  'programId',            // the identifier for our merchants
  {
    coupons: 'programId', // the identifier of coupons to match an merchant identifier
    text: 'programId',    // the identifier of promo text to match an merchant identifier
    cashback: 'programId' // the identifier of commissions to match an merchant identifier
  }
);

const AdCellGenericApi = function(s_entity) {
  if (!(this instanceof AdCellGenericApi)) {
    debug("instantiating AdCellGenericApi for: %s", s_entity);
    return new AdCellGenericApi(s_entity);
  }

  var that = this;

  this.entity = s_entity ? s_entity.toLowerCase() : 'ominto';
  this.client = require('./api')(this.entity);
  this.eventName = (this.entity !== 'ominto' ? this.entity + '-' : '') + 'adcell';

  /**
   * Retrieve all merchant/program information from AdCell including there commissions and coupons.
   * @returns {undefined}
   */
  this.getMerchants = singleRun(function* () {
    let response;
    let results = {};
    let merchants = {};
    let programs = [];
    let merchantIds = [];
    let coupons = [];
    let text = [];
    let commission = [];

    programs = yield that.pagedApiCall('getAffiliateProgram', 'items');

    // prepare an array of merchant ids for requesting Coupons for those merchants
    merchantIds = programs.map((m) => {
      return m.programId;
    });

    /*
     * AdCell requires us to pass the list (array) of programIds in following format, which causes exceeded URL lengths with to many programids.
     * URL Request format: https://..../?programIds[]=3687&programIds[]=1762&programIds[]=...
     * So we split the list of ids into chunks and process them batch by batch.
     */

    let idGroupSize = 25; // split list into groups of each 25 Ids, resulting in a URL param list of 25 times "&programIds[]=12345"
    let idGroups = merchantIds.map(function(e,i) {
      return i%idGroupSize===0 ? merchantIds.slice(i,i+idGroupSize) : null;
    }).filter((x) => {return x;});

    // get all coupons for each group of programIds
    for( let i=0; i<idGroups.length; i++) {
      response = yield that.pagedApiCall('getPromotionType', 'items', {programIds: idGroups[i]}, ['Coupon']);
      coupons = coupons.concat(response);
      response = yield that.pagedApiCall('getPromotionType', 'items', {programIds: idGroups[i]}, ['Text']);
      text = text.concat(response);
    }

    // get commission information for each group of programIds
    for( let i=0; i<idGroups.length; i++) {
      response = yield that.pagedApiCall('getCommissions', 'items', {programIds: idGroups[i]});
      commission = commission.concat(response);
    }

    results = {
      merchants: programs,
      coupons: coupons,
      text: text,
      cashback: commission
    };

    merchants = merge(results);
    return yield sendEvents.sendMerchants(that.eventName, merchants);
  });

  /**
   * Retrieve all commission details (sales/transactions) from AdCell within given period of time.
   * @returns {undefined}
   */
  this.getCommissionDetails = singleRun(function* () {
    let transactions = [],
        events = [],
        startDate = new Date(Date.now() - (90 * 86400 * 1000)),
        endDate = new Date(Date.now() - (60 * 1000));
    const exists = x => !!x;

    debug("fetching all transactions between %s and %s", startDate, endDate);

    transactions = yield that.pagedApiCall('getStatisticsByCommission', 'items', {startDate: startDate, endDate:endDate});
    events = transactions.map(that.prepareCommission).filter(exists);

    return yield sendEvents.sendCommissions(that.eventName, events);
  });

  /**
   * Perform paginated api requests to any specified method of api client.
   * @param {String} method - The method of the api to call
   * @param {String} bodyKey - Attribute name/path in response body object to deep select as results
   * @param {Object} params - The params to pass onto the api method
   * @param {Array} extra - extra arguments to pass to the api method
   * @returns {Array}
   */
  this.pagedApiCall = co.wrap(function* (method, bodyKey, params, extra) {
    let results = [];
    let perPage = 250;	// default is 25
    let page = 0;
    let total = 0;
    let start = Date.now();

    // check that we call a method which actually is provided by the api client
    if (typeof that.client[method] !== 'function') {
      throw new Error("Method " + method + " is not available by our api client.");
    }

    // perform api calls with pagination until we reach total items to fetch
    while(true) {
      let arg = [_.extend({}, params, {page:++page, rows:perPage})].concat(extra);

      debug("%s : page %d of %s (%s)", method, page, Math.floor(total/perPage) || 'unknown', JSON.stringify({args:arg}));

      // perform actual api call
      let response = yield that.client[method].apply(that.client, arg);

      let items = _.get(response, bodyKey) || [];
      results = results.concat(items);
      total = (response.total !== undefined ) ? response.total.totalItems || response.total.numberItems : 0;

      if (page * perPage >= total) break;
    }

    let end = Date.now();
    debug("%s finished: %d items over %d pages (%dms)", method, results.length, page, end-start);

    return results;
  });

  /**
   * Function to prepare a single commission transaction for our data event.
   * @param {Object} o_obj  The individual commission transaction straight from AdCell
   * @returns {Object}
   */
  this.prepareCommission = function(o_obj) {

    // https://www.adcell.de/api/v2/#&controller=Affiliate_Statistic&apiCall=affiliate_statistic_byCommission
    // using auto as date for a transactions added a bug. hence using "o_obj.createTime"
    // for "open"transactions, "o_obj.changeTime" for "accepted" transactions &
    // "cancelled" transactions instead. (check STATUS_MAP for statuses)

    var _date = 'auto';
    if(o_obj.status === 'open')
      _date = new Date(o_obj.createTime);
    else if(o_obj.status === 'accepted' || o_obj.status === 'cancelled')
      _date = new Date(o_obj.changeTime);

    var event = {
      affiliate_name: o_obj.programName,
      transaction_id: o_obj.commissionId,
      order_id: o_obj.commissionId,
      outclick_id: o_obj.subId,
      currency: 'eur',
      purchase_amount: o_obj.totalShoppingCart,
      commission_amount: o_obj.totalCommission,
      state: STATE_MAP[o_obj.status],
      //effective_date: (o_obj.changeTime !== '' ? new Date(o_obj.changeTime) : 'auto')
      effective_date: _date
    };
    return event;
  };
};

module.exports = AdCellGenericApi;
