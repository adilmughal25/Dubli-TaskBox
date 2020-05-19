"use strict";

const _ = require('lodash');
const co = require('co');
const sendEvents = require('../support/send-events');
const singleRun = require('../support/single-run');

const AFFILIATE_NAME = 'direct-partner';
const MERCHANT_NAME = 'groupon';

const STATE_MAP = {
  INITIATED: 'initiated',
  VALID: 'confirmed',
  REFUNDED: 'cancelled',
  INVALID: 'cancelled',  // to be ignored
};

var ary = x => _.isArray(x) ? x : [x];
const exists = x => !!x;

const GrouponGenericApi = function(s_region, s_entity) {
  if (!s_region) throw new Error("Groupon Generic API needs region!");
  if (!(this instanceof GrouponGenericApi)) return new GrouponGenericApi(s_region, s_entity);

  var that = this;

  this.entity = s_entity ? s_entity.toLowerCase() : 'ominto';
  this.client = require('./api')(this.entity, s_region);
  this.eventName = (this.entity !== 'ominto' ? this.entity + '-' : '') + 'groupon-' + s_region;

  const debug = require('debug')(this.eventName + ':processor');

  /**
   * Retrieve all commission details (sales/transactions) from Groupon within given period of time.
   * @returns {undefined}
   */
  this.getCommissionDetails = singleRun(function* () {
    const startDate = new Date(Date.now() - (90 * 86400 * 1000));
    const endDate = new Date(Date.now());

    debug("fetching all transactions between %s and %s", startDate, endDate);

    let results = yield that.pagedApiCall('getOrders', {startDate: startDate, endDate:endDate}).then(flattenCommissions);
    const events = results.map(prepareCommission).filter(exists);

    return yield sendEvents.sendCommissions(that.eventName, events);
  });

  /**
   * Perform paginated api requests to any specified method of api client.
   * @param {String} method - The method of the api to call
   * @param {Object} params - The params to pass onto the api method
   * @param {Object} params.startDate - Date range filter, from date
   * @param {Object} params.endDate - Date range filter, until date
   * @returns {Array}
   */
  this.pagedApiCall = co.wrap(function* (method, params) {
    let results = [];
    let total = 0;
    let perPage = 250;  // default is 25
    let page = 0;
    const _startTime = Date.now();

    // check that we call a method which actually is provided by the api client
    if (typeof that.client[method] !== 'function') {
      throw new Error("Method '" + method + "' is not available by our api client.");
    }

    // perform api calls with pagination until we reach total items to fetch
    while(true) {
      let arg = _.extend({}, params, {page:++page, pageSize:perPage});

      debug("%s : page %d of %s (%s)", method, page, Math.floor(total/perPage) || 'unknown', JSON.stringify({args:arg}));

      // perform actual api call
      let response = yield that.client[method](arg);

      results = results.concat( ary(_.get(response, 'records') || []) );
      total = response.total || 0;

      if (page * perPage >= total) break;
    }

    const _endTime = Date.now();
    debug("%s finished: %d items over %d pages (%dms)", method, results.length, page, _endTime-_startTime);

    return results;
  });

};

/**
 * Function to prepare a single commission transaction for our data event.
 * @param {Object} o_obj  The individual commission transaction from Groupon api client
 * @returns {Object}
 */
function prepareCommission(o_obj) {
  var d = new Date();
  d.setDate(d.getDate() - 15);
  // https://partner-api.groupon.com/help/reporting-version-2-order-api
  // need a sample response to get the effective_date field populated

  if (o_obj.item[0].Status === 'INVALID') {
    // invalid tracked sale - to be ignored completly
    return;
  }

  let event = {
    affiliate_name: AFFILIATE_NAME,
    merchant_name: MERCHANT_NAME,
    merchant_id: '',
    transaction_id: o_obj.item[0].BillingId,
    order_id: o_obj.item[0].BillingId,
    outclick_id: o_obj.item[0].Sid,
    currency: o_obj.item[0].Currency,
    purchase_amount: o_obj.item.SaleGrossAmount,
    commission_amount: o_obj.item.LedgerAmount,
    // Keep it initiated for 1st 45 days and then change it to confirmed if the status is VALID
    state: STATE_MAP[(o_obj.item[0].Status === 'VALID' && new Date(o_obj.item[2].Datetime) > d) ? 'INITIATED': o_obj.item[0].Status],
    effective_date: new Date(o_obj.item[2].Datetime) // changing to Datetime field for now [old developers comment below]
    // Not sure anymore - i believe that date is NOT equal purchase date?! // o_obj.item[2].Datetime
  };

  return event;
}

/**
 * Flatten the nested commissions object response to more convinient flat object per item/record.
 * @params {Object} groups  Individual "groups" object from api = 1 transaction
 * @returns {Object}
 */
function flattenCommissions(groups) {
  return groups.map(function(item) { // flatten group to single item
    item.group.map(function(info) {
      _.assign(info, info.informations);
      delete info.informations;
      return info;
    });

    item.item = _.assign(item.group, item.measures);
    delete item.group;
    delete item.measures;

    return item;
  });
}

module.exports = GrouponGenericApi;
