"use strict";

const _ = require('lodash');
const co = require('co');
const debug = require('debug')('snapdeal:api-client');
const moment = require('moment');
const querystring = require('querystring');
const request = require('got');
//const limiter = require('ominto-utils').promiseRateLimiter;

const statuses = 'approved cancelled'.split(' ');
const checkUrl = url => url.indexOf(API_CFG.url) === 0 ? url.replace(API_CFG.url, '') : url;

const API_CFG = {
  url: 'http://affiliate-feeds.snapdeal.com/feed/api/',
  ominto: {
    id: '49052',
    token: 'be78e62f11c1392ec5c991f2f83459'
  }
};

/**
 * Snapdeal client for making calls to the orders API.
 * Snapdeal Documentation : You cannot make more than 20 API requests per second.
 * @param {String} s_entity - name of the account
 * @returns {Object} Snapdeal - refernece object
 * @constructor
 */
function SnapdealClient(s_entity) {

  if (!(this instanceof SnapdealClient)) return new SnapdealClient(s_entity);
  if (!s_entity) throw new Error("Missing required argument 's_entity'!");
  if (!API_CFG[s_entity]) throw new Error("Entity '" + s_entity + "' is not defined in API_CFG.");
  debug("Create new client for entity: %s", s_entity);

  this.cfg = API_CFG[s_entity];

  this.client = request.default({
    baseUrl: API_CFG.url,
    simple: true,
    json: true,
    headers: {
      'Snapdeal-Affiliate-Id': this.cfg.id,
      'Snapdeal-Token-Id': this.cfg.token,
      'Accept': 'application/json'
    }
  });

  // Limiter : 20 API requests per second.
  //limiter.request(this.client, 20, 1).debug(debug);
}

/**
 * Function to paginate api calls.
 * Snapdeal Documentation : You can get data for a maximum of 500 orders in a single request.
 * The response of each request contains the value of an attribute called "nextUrl", and on
 * sending a request to this URL, you will receive the data for the next 500 orders. Repeat
 * this process until you receive data for all orders.
 * @param {String} url - api url to get the data
 * @param {String} key - name of the object that has to be extracted every time from the paginated data
 * @returns {Object} results - json object containing complete response data
 */
SnapdealClient.prototype.Paginate = co.wrap(function * (url, key) {

  let results = [];
  let currentUrl = checkUrl(url);
  while (true) {

    debug("fetch url : %s%s", API_CFG.url, currentUrl);
    let response = yield this.client.get(currentUrl);
    debug(" next url : %s", response.nextURL);

    // extract the data based of the keyword provided in 'key'
    let data = _.get(response, key);
    if (data && _.isArray(data)) results = results.concat(data);

    // break when there is nothing to paginate
    if (!response.nextURL) break;

    currentUrl = checkUrl(response.nextURL);
  }

  return results;
});

/**
 * Function to fetch order reports for each Status (defined in const statuses)
 * @param {Date} start - start date of the api call
 * @param {Date} end - end date of the api call
 * @param {String} status - approved or cancelled
 * @returns {Object} Object - json object containing response data
 */
SnapdealClient.prototype.orderReportByStatus = co.wrap(function * (start, end, status) {

  let url = 'order?' + querystring.stringify({
    startDate: moment(start).format('YYYY-MM-DD'),
    endDate: moment(end).format('YYYY-MM-DD'),
    status: status
  });

  return yield this.Paginate(url, 'productDetails');
});

/**
 * Function to fetch order reports
 * @param {Date} start - start date of the api call
 * @param {Date} end - end date of the api call
 * @returns {Object} results - json object containing response data
 */
SnapdealClient.prototype.orderReport = co.wrap(function * (start, end) {

  const promises = {};
  const that = this;
  statuses.forEach(status => promises[status] = that.orderReportByStatus(start, end, status));
  const results = yield promises;

  return results;
});

module.exports = SnapdealClient;
