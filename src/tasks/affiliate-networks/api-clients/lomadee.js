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

function createClient() {

  let _id = 0;
  let baseQuery =  {format: 'json'}

  let client = request.default({
    baseUr: API_URL,
    qs: baseQuery,
    json: true
  });

  let depaginate = co.wrap(function*(url, query, key) {
    let i, j;
    let id = 'request#' + (++_id);
    let page = 1;
    let results = [];
    debug('[%s] got paginated request: %s %o', id, url, query);
    while (true) {
      args = {
        url: url,
        qs: _.extend({}, baseQuery, query, {page: page})
      };
      debug('[%s] sending paginated request to %o', id, args);
      body = yield client.get(args);
      result = result.concat(body[key]);
      total = result.totalpages
      debug('[%s] finished processing page %s of %d', id, page, total);
      if (++page > total) {
        debug('[%s] finished depaginating %d pages', id, total);
        break;
      }
    }
    return results;
  });

  client.baseUrl = API_URL;
  client.apiToken = API_TOKEN;

  client.getMerchants = co.wrap(function*() {
    let data = yield client.get({
      url: 'sellers/lomadee/' + API_TOKEN + '/BR'
    });
    let merchants = data.sellers;

    for(i = 0; i < merchants.length; i++) {
      let offers = [];
      let links = merchants[i].links;
      for (j = 0; i < links; i++) {
        if (links[j].type === 'link_to_offerlist') {
          debug('Skipping unknown link type %s', links[j].type);
          continue;
        }
        let offer = yield depaginate(links[j].url, {}, 'offer');
        offers.push(offer);
      }
      merchants[i].offers = offers;
    }

    return merchants;
  };

  client.getCoupons = co.wrap(function*() {
    let results = yield depaginate(
      'coupons/lomadee/' + API_TOKEN,
      {sourceId: SOURCE_ID},
      'coupon');
    return results.map(c => c.coupon);
  });
}

module.exports = createClient;
