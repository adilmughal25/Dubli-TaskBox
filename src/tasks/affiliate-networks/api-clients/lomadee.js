"use strict";

/*
 * Lomadee API client for their RESTful API.
 *
 * API Documentation
 *    Merchants API: http://developer.buscape.com.br/portal/developer/documentacao/apis-afiliados/api-lomadee/lojas/
 */

const _ = require('lodash');
const co = require('co');
const request = require('request-promise');
const debug = require('debug')('lomadee:api-client');

const API_URL = ' http://sandbox.buscape.com.br/service/';
const API_TOKEN = '5749507a5a7258304352673d';
const SOURCE_ID = '9262544';
const MAX_RESULTS = 100;

function createClient() {

  let _id = 0;
  let baseQuery =  {format: 'json'}

  let client = request.defaults({
    baseUrl: API_URL,
    qs: baseQuery,
    json: true
  });

  let depaginate = co.wrap(function*(url, query, key) {
    let id = 'request#' + (++_id);
    let page = 1;
    let results = [];
    debug('[%s] got paginated request: %s %o', id, url, query);
    while (true) {
      let args = {
        url: url,
        qs: _.extend({}, baseQuery, query, {page: page, results: MAX_RESULTS})
      };
      debug('[%s] sending paginated request to %o', id, args);
      let body = yield client.get(args);
      results = results.concat(body[key]);
      // we're using totalresultsavailable because totalPages maxes out at 999
      let total = Math.ceil(body.totalresultsavailable / MAX_RESULTS);
      debug('[%s] finished processing page %s of %d', id, page, total);
      if (++page > total) {
        debug('[%s] finished depaginating %d pages', id, total);
        break;
      }
    }
    return results.map(r => r[key]);
  });

  client.baseUrl = API_URL;
  client.apiToken = API_TOKEN;

  client.getMerchants = co.wrap(function*() {
    let i, j;
    let data = yield client.get({
      url: 'sellers/lomadee/' + API_TOKEN + '/BR'
    });
    let merchants = data.sellers;

    let promises = [];
    for(i = 0; i < merchants.length; i++) {
      promises.push(co.wrap(function*() {
        merchants[i].offers = yield depaginate(
          'findOfferList/lomadee/' + API_TOKEN,
          {allowedSellers: merchants[i].id},
          'offer');
        return merchants[i];
      })());
    }

    yield Promise.all(promises);

    return merchants;
  });

  client.getCoupons = co.wrap(function*() {
    return yield depaginate(
      'coupons/lomadee/' + API_TOKEN,
      {sourceId: SOURCE_ID},
      'coupon');
  });

  return client;
}

module.exports = createClient;
