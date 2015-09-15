"use strict";

/*
 * Lomadee API client for their RESTful API.
 *
 * API Documentation
 *    Merchants API: http://developer.buscape.com.br/portal/developer/documentacao/apis-afiliados/api-lomadee/lojas/
 */

var _ = require('lodash');
var co = require('co');
const request = require('request-promise');
var debug = require('debug')('lomadee:api-client');

const API_URL = ' http://sandbox.buscape.com.br/service/';
const API_TOKEN = '5749507a5a7258304352673d';
const SOURCE_ID = '9262544';

function createClient() {

  var _id = 0;
  var baseQuery =  {format: 'json'}

  var client = request.default({
    baseUr: API_URL,
    qs: baseQuery,
    json: true
  });

  var depaginate = co.wrap(function*(url, query, key) {
    var i, j;
    var id = 'request#' + (++_id);
    var page = 1;
    var results = [];
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
    var data = yield client.get({
      url: 'sellers/lomadee/' + API_TOKEN + '/BR'
    });
    var merchants = data.sellers;

    for(i = 0; i < merchants.length; i++) {
      var offers = [];
      var links = merchants[i].links;
      for (j = 0; i < links; i++) {
        if (links[j].type === 'link_to_offerlist') {
          debug('Skipping unknown link type %s', links[j].type);
          continue;
        }
        var offer = yield depaginate(links[j].url, {}, 'offer');
        offers.push(offer);
      }
      merchants[i].offers = offers;
    }

    return merchants;
  };

  client.getCoupons = co.wrap(function*() {
    var results = yield depaginate(
      'coupons/lomadee/' + API_TOKEN,
      {sourceId: SOURCE_ID},
      'coupon');
    return results.map(c => c.coupon);
  });
}
