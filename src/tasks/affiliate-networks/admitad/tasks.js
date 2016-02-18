"use strict";

const _ = require('lodash');
const co = require('co');
const debug = require('debug')('admitad:processor');
const sendEvents = require('../support/send-events');
const singleRun = require('../support/single-run');
const moment = require('moment');

const exists = x => !!x;
const merge = require('../support/easy-merge')('id', {
  coupons: 'campaign.id',
  links: 'campaign'
});

const AdmitadGenericApi = function(s_entity) {
  if (!(this instanceof AdmitadGenericApi)) {
    debug("instantiating AdmitadGenericApi for: %s", s_entity);
    return new AdmitadGenericApi(s_entity);
  }

  var that = this;

  this.entity = s_entity ? s_entity.toLowerCase() : 'ominto';
  this.client = require('./api')(this.entity);
  this.eventName = (this.entity !== 'ominto' ? this.entity + '-' : '') + 'admitad';

  /**
   * Retrieve all commission details (sales/transactions) from Admitad within given period of time.
   * @returns {undefined}
   */
  this.getCommissionDetails = singleRun(function* () {
    let startDate = new Date(Date.now() - (30 * 86400 * 1000));
    let endDate = new Date(Date.now() - (60 * 1000));

    debug("fetching all transactions between %s and %s", startDate, endDate);

    let transactions = yield that.pagedApiCall('getStatisticsByAction', 'results', {status_updated_start: startDate, status_updated_end:endDate});
    const events = transactions.map(prepareCommission).filter(exists);

    return yield sendEvents.sendCommissions(that.eventName, events);
  });

  this.getMerchants = singleRun(function* () {
    let merchants = yield that.pagedApiCall('getMerchants', 'results');
    let links = [];
    let coupons = [];
    let promises = [];

    for (let id of _.pluck(merchants, 'id')) {
      promises.push(
        that.pagedApiCall('getLinks', 'results', { id: id })
        .then(results => {
          if (_.isEmpty(results)) {
            debug("found empty links for '%s'", id);
            return [];
          } else {
            debug("adding campaign id to links. id=[%s] count=[%s]", id, results.length);
            return _(results).reject(_.isEmpty).forEach(l => l.campaign = id).value();
          }
        })
        .then(results => links = links.concat(results))
      );
      promises.push(
        that.pagedApiCall('getCoupons', 'results', {campaign: id})
        .then(results => coupons = coupons.concat(results))
      );
    }

    yield Promise.all(promises);

    const results = yield {
      merchants: merchants,
      coupons: _.flattenDeep(coupons),
      links: _.flattenDeep(links)
    };

    // console.error(JSON.stringify(results.links, null, 2));
    // console.error(JSON.stringify(merge(results)));
    return yield sendEvents.sendMerchants(that.eventName, merge(results));
  });

  /**
   * Perform paginated api requests to any specified method of api client.
   * @param {String} method - The method of the api to call
   * @param {String} bodyKey - Attribute name/path in response body object to deep select as results
   * @param {Object} params - The params to pass onto the api method
   * @returns {Array}
   */
  this.pagedApiCall = co.wrap(function* (method, bodyKey, params) {
    let results = [];       // aggregated result sets
    let perPage = 250;      // number of max records per response/page
    let page = 0;           // current page of request
    let total = 0;          // total count of records available at response
    let start = Date.now();

    // check that we call a method which actually is provided by the api client
    if (typeof that.client[method] !== 'function') {
      throw new Error("Method " + method + " is not available by our api client.");
    }

    // perform api calls with pagination until we reach total items to fetch
    while(true) {
      let arg = _.extend({}, params, {offset:(++page * perPage)-perPage, limit:perPage});

      debug("%s : page %d of %s (%s)", method, page, Math.ceil(total/perPage) || 'unknown', JSON.stringify({args:arg}));

      // perform actual api call
      let response = yield that.client[method](arg);

      let items = (bodyKey && _.get(response, bodyKey)) || response || [];
      results = results.concat(items);
      total = (response._meta !== undefined ) ? (response._meta.count || 0) : 0;

      if (page * perPage >= total) break;
    }

    let end = Date.now();
    debug("%s finished: %d items over %d pages (%dms)", method, results.length, page, end-start);

    return results;
  });
};

const STATE_MAP = {
  'pending':    'initiated',
  'approved':   'confirmed',
  'approved_but_stalled - waiting': 'initiated',  // docu says it exists but i doubt the syntax
  'confirmed':  'confirmed',
  'confirmed, but detained': 'confirmed',         // docu says it exists but i doubt the syntax
  'declined':   'cancelled',
  'rejected':   'cancelled',
};

/**
 * Function to prepare a single commission transaction for our data event.
 * @param {Object} o_obj  The individual commission transaction straight from Admitad
 * @returns {Object}
 */
function prepareCommission(o_obj) {
  let event = {
    affiliate_name: o_obj.advcampaign_name,
    transaction_id: o_obj.action_id,
    outclick_id: o_obj.subid,
    currency: o_obj.currency.toLowerCase(),
    purchase_amount: o_obj.cart,
    commission_amount: o_obj.payment,
    state: STATE_MAP[o_obj.status],
    effective_date: 'auto'
  };
  return event;
}

module.exports = AdmitadGenericApi;
