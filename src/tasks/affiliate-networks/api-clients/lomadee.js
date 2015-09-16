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

  let carefulGet = co.wrap(function*(args) {
    let result;
    let tries = 5;
    while (tries > 0) {
      try {
        result = yield client.get(args);
        return result;
      }
      catch (e) {
        tries--;
        debug('Error fetching %o, %d more tries. Error was %o', args, tries, e);
      }
    }
    debug('Retries exhausted featching %o', args);
    return {};
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
      let body = yield carefulGet(args);
      if (!body) {
        debug('[%s] failed to retrive response, skipping %o', id, args);
        ++page;
        continue;
      }
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

  client.getOffers = co.wrap(function*(merchantId) {
    return yield depaginate(
      'findOfferList/lomadee/' + API_TOKEN,
      {allowedSellers: merchantId},
      'offer');
  });

  client.getMerchants = co.wrap(function*() {
    let results = []
    let data = yield carefulGet({
      url: 'sellers/lomadee/' + API_TOKEN + '/BR'
    });
    let sellers = data.sellers || []
    for (let i = 0; i < sellers.length; i++) {
      results.push(co.wrap(function*(merchant){
        let id = 'merchant#' + merchant.id;
        debug('[%s] Getting merchant details', id);
        let seller = (yield carefulGet({
          url: 'viewSellerDetails/' + API_TOKEN,
          qs: _.extend({}, baseQuery, {sellerId: merchant.id})
        })).seller;
        seller.advertiserid = merchant.advertiserId
        seller.link = seller.links.filter(l => l.link.type === 'seller')[0].link;
        debug('[%s] Creating affiliate link', id);
        seller.link.lomadee = (yield carefulGet({
          url: 'createLinks/lomadee/' + API_TOKEN,
          qs: _.extend({}, baseQuery, {sourceId: SOURCE_ID, link1: seller.link.url})
        })).lomadeelinks[0].lomadeelink.redirectlink;
        return seller;
      })(sellers[i]));
    }
    return yield Promise.all(results);
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
