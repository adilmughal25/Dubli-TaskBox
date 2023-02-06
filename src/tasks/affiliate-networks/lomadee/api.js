"use strict";

/*
 * Lomadee API client for their RESTful API.
 *
 * API Documentation
 *    Merchants API: http://developer.buscape.com.br/portal/developer/documentacao/apis-afiliados/api-lomadee/lojas/
 */

const _ = require('lodash');
const co = require('co');
const request = require('axios');
const debug = require('debug')('lomadee:api-client');

const API_URL = ' http://sandbox.buscape.com.br/service/'; // sandbox url
//const API_URL = ' http://bws.buscape.com.br/service/'; // production url
const API_TOKEN = '5749507a5a7258304352673d';
const SOURCE_ID = '33225840';
const MAX_RESULTS = 100;

function createClient() {

  let _id = 0;
  let baseQuery =  {format: 'json'}

  let client = request.extend({
    prefixUrl: API_URL,
    qs: baseQuery,
    responseType: 'json',
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

  let getPage = co.wrap(function*(id, url, query, page) {
    let args = {
      url: url,
      qs: _.extend({}, baseQuery, query, {page: page, results: MAX_RESULTS})
    };
    debug('[%s] sending paginated request to %o', id, args);
    let body = yield carefulGet(args);
    if (!body) {
      debug('[%s] failed to retrive response, skipping %o', id, args);
    }
    else {
      debug('[%s] finished processing page %d', id, page);
    }
    return body;
  });


  let depaginate = co.wrap(function*(url, query, transform) {
    let id = 'request#' + (++_id);
    let page = 1;
    debug('[%s] got paginated request: %s %o', id, url, query);
    let promise = getPage(id, url, query, page);
    let results = [promise.then(data => transform(data))];
    let first = yield promise
    if (first) {
      // I'm using totalresultsavailable because totalPages maxes out at 999
      let total = Math.ceil(first.totalresultsavailable / MAX_RESULTS);
      // This created a defer objec that we can resolve when ready
      let d  = {};
      let p = new Promise((resolve, reject) => {
        d.resolve = resolve;
        d.reject = reject;
      });
      // The recursive loop method instead of a for or while method is to allow
      // us to defer each iteration of the loop to the next execution step which
      // creates fair queuing between the various merchants
      let loop = co.wrap(function*() {
        if (++page > total) {
          return d.resolve();
        }
        results.push(getPage(id, url, query, page)
          .then(data => transform(data)));
        setTimeout(loop, 0);
      });
      loop();
      yield p;
      debug('[%s] finished depaginating %d page(s)', id, total);
    }
    results = yield Promise.all(results);
    let items = [];
    results.forEach(result => {
      items = items.concat(result);
    });

    return items;
  });

  client.baseUrl = API_URL;
  client.apiToken = API_TOKEN;

  client.getOffers = co.wrap(function*(merchantId) {
    return yield depaginate(
      'findOfferList/lomadee/' + API_TOKEN,
      {allowedSellers: merchantId},
      body => {
        let result = [];
        if (body.offer) {
          body.offer.forEach(offer => {
            let item = offer.offer;
            if(item.seller && item.seller.coupon) {
              item.coupon = item.seller.coupon;
            }
            delete item.seller
            result.push(item);
          });
        }
        return result;
      });
  });

  client.getMerchants = co.wrap(function*() {
    let results = [];
    let data = yield carefulGet({
      url: 'sellers/lomadee/' + API_TOKEN + '/BR'
    });
    let sellers = data.sellers || [];
    for (let i = 0; i < sellers.length; i++) {
      // The external API gets merchant with id = 0, which on subsequent api call
      // gets incorrect data.
      // TODO: clarify with lomadee about this!!!
      if(sellers[i].id != 0){
        results.push(co.wrap(function*(merchant){
          let id = 'merchant#' + merchant.id;
          debug('[%s] Getting merchant details', id);

          // get merchant information
          let seller = (yield carefulGet({
            url: 'viewSellerDetails/' + API_TOKEN,
            qs: _.extend({}, baseQuery, {sellerId: merchant.id})
          })).seller || {};
          seller.advertiserid = merchant.advertiserId;
          seller.thumbnail = merchant.thumbnail;
          try {
            // check for additional links
            var linkCandidate = (seller.links || []).filter(l => _.get(l, 'link.type') === 'seller');
            if (linkCandidate && linkCandidate.length) {
              seller.link = seller.links ? [0].link : null;
            }
            debug('[%s] Creating affiliate link', id);

            // get the redirectUrl for the merchant using the displayUrl [deep linking]
            var redirectUrl = _.get(yield carefulGet({
              url: 'createLinks/lomadee/' + API_TOKEN,
              qs: _.extend({}, baseQuery, {sourceId: SOURCE_ID, link1: _.get(seller.links[0], 'link.url')})
            }), 'lomadeelinks[0].lomadeelink.redirectlink');

            seller.redirectUrl = redirectUrl;
          } catch (e){}

          // seller.offers = yield client.getOffers(seller.id);
          return seller;
        })(sellers[i]));
      }
    }
    return yield Promise.all(results);
  });

  client.getCoupons = co.wrap(function*() {
    return yield depaginate(
      'coupons/lomadee/' + API_TOKEN,
      {sourceId: SOURCE_ID},
      body => {
        let result = [];
        if (body.coupon) {
          body.coupon.forEach(coupon => {
            let item = coupon.coupon;
            item.advertiserid = item.seller.advertiserid;
            delete item.seller;
            result.push(item);
          });
        }
        return result;
      });
  });

  return client;
}

module.exports = createClient;
