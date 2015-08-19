"use strict";

var _ = require('lodash');
var co = require('co');
var debug = require('debug')('adcell:processor');
var sendEvents = require('./support/send-events');
var singleRun = require('./support/single-run');
var client = require('./api-clients/adCell')();

var merge = require('./support/easy-merge')(
  'programId',            // the identifier for our merchants
  {
    coupons: 'programId', // the identifier of coupons to match an merchant identifier
    cashback: 'programId' // the identifier of commissions to match an merchant identifier
  }
);

const getMerchants = singleRun(function* () {
  let results = {},
      merchants = {},
      programs = {},
      merchantIds = [],
      coupons = {},
      commission = {};
  
	programs = yield pagedApiCall('getAffiliateProgram', 'items');

  // prepare an array of merchant ids for requesting Coupons for those merchants
  merchantIds = programs.map((m) => {
    return m.programId;
  });

  coupons = yield pagedApiCall('getPromotionTypeCoupon', 'items', {programIds: merchantIds});
  commission = yield pagedApiCall('getCommissions', 'items', {programIds: merchantIds});

  results = {
    merchants: programs,
    coupons: coupons,
    cashback: commission
  };

  merchants = merge(results);
  yield sendEvents.sendMerchants('adcell', merchants);
});

/**
 * Perform paginated api requests to any specified method of api client.
 * @param {String} method - The method of the api to call
 * @param {String} bodyKey - Attribute name/path in response body object to deep select as results
 * @param {Object} params - The params to pass onto the api method
 * @returns {Array}
 */
var pagedApiCall = co.wrap(function* (method, bodyKey, params) {
  let results = [],
      perPage = 250,	// default is 25
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
    total = (response.total !== undefined ) ? response.total.totalItems || response.total.numberItems : 0;

    if (page * perPage >= total) break;
  }

	let end = Date.now();
  debug("%s finished: %d items over %d pages (%dms)", method, results.length, page, end-start);

  return results;
});

module.exports = {
  getMerchants: getMerchants,
};
