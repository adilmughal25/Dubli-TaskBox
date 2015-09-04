"use strict";

const _ = require('lodash');
const co = require('co');
const debug = require('debug')('admitad:processor');
const sendEvents = require('./support/send-events');
const singleRun = require('./support/single-run');
const moment = require('moment');

/**
 * Retrieve all commission details (sales/transactions) from Admitad within given period of time.
 * @returns {undefined}
 */
var getCommissionDetails = singleRun(function* () {
  let transactions = [],
      events = [],
      startDate = new Date(Date.now() - (30 * 86400 * 1000)),
      endDate = new Date(Date.now() - (60 * 1000));
  const exists = x => !!x;

  debug("fetching all transactions between %s and %s", startDate, endDate);

  transactions = yield pagedApiCall('getStatisticsByAction', 'results', {date_start: startDate, date_end:endDate});
  //yield sendEvents.sendCommissions('admitad', transactions);
  //events = transactions.map(prepareCommission).filter(exists);
  //yield sendEvents.sendCommissions('admitad', events);
});

/**
 * Perform paginated api requests to any specified method of api client.
 * @param {String} method - The method of the api to call
 * @param {String} bodyKey - Attribute name/path in response body object to deep select as results
 * @param {Object} params - The params to pass onto the api method
 * @returns {Array}
 */
var pagedApiCall = co.wrap(function* (method, bodyKey, params) {
  const client = getClient();
  let results = [],
      perPage = 50,
      page = 0,
      total = 0,
      start = Date.now();

	// check that we call a method which actually is provided by the api client
	if (typeof client[method] !== 'function') {
    throw new Error("Method " + method + " is not available by our api client.");
	}

	// perform api calls with pagination until we reach total items to fetch
  while(true) {
    let arg = _.extend({}, params, {offset:(++page * perPage)-perPage, limit:perPage}),
      response;

    debug("%s : page %d of %s (%s)", method, page, Math.ceil(total/perPage) || 'unknown', JSON.stringify({args:arg}));

    // perform actual api call
    response = yield client[method](arg);

    let items = _.get(response, bodyKey) || [];
    results = results.concat(items);
    total = (response._meta !== undefined ) ? (response._meta.count || 0) : 0;

    if (page * perPage >= total) break;
  }

	let end = Date.now();
  debug("%s finished: %d items over %d pages (%dms)", method, results.length, page, end-start);

  return results;
});

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
  var event = {
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

let _client;
function getClient() {
  if (!_client) {
    _client = require('./api-clients/admitad')();
  }
  return _client;
}

module.exports = {
  getCommissionDetails: getCommissionDetails
};
