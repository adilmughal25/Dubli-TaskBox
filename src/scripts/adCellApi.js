"use strict";

var _ = require('lodash');
var co = require('co');
var debug = require('debug')('affiliatewindow:processor');
var sendEvents = require('./support/send-events');
var singleRun = require('./support/single-run');
var client = require('./api-clients/adCell')();

const getMerchants = singleRun(function* () {
	let results = yield pagedApiCall('getAffiliateProgram', 'items');
	let merchants = results.map(merchant => ({merchant: merchant}));
	yield sendEvents.sendMerchants('adcell', merchants);
});

/**
 * Perform paginated api requests to any specified method of api client.
 * @param {String} method - The method of the api to call
 * @param {String} bodyKey - Attribute name/path in response body object to deep select as results
 * @param {Object} params - The params to pass onto the api method
 * @param {Object} params.page - which page to fetch from api
 * @param {Object} params.rows - how many rows/items per page to fetch
 * @returns {Array}
 */
var pagedApiCall = co.wrap(function* (method, bodyKey, params) {
  let results = [],
			perPage = 50,	// default is 25
  		page = 0,
			total = 0,
			start = Date.now();

	// check that we call a method which actually is provided by the api client
	if (typeof client[method] !== 'function') {
		throw new Error("Method " + method + " is not available by our api client.");
	}

	// perform api calls with pagination until we reach total items to fetch
  while(true) {
    let arg = _.extend({}, params, {page:++page, rows:perPage}),
				response;

		debug("%s : page %d of %s (%s)", method, page, Math.floor(total/perPage) || 'unknown', JSON.stringify({args:arg}));

		// perform actual api call
    response = yield client[method](arg);

    let items = _.get(response, bodyKey) || [];
    results = results.concat(items);
    total = response.total.totalItems;
		
    if (page * perPage >= response.total.totalItems) break;
  }
  
	let end = Date.now();
  debug("%s finished: %d items over %d pages (%dms)", method, results.length, page, end-start);

  return results;
});

module.exports = {
  getMerchants: getMerchants,
};
