"use strict";

const _ = require('lodash');
const co = require('co');
const debug = require('debug')('flipkart:api-client');
const moment = require('moment');
const querystring = require('querystring');
let request = import('got');
//const limiter = require('ominto-utils').promiseRateLimiter;

const statuses = 'Cancelled Approved Pending Disapproved'.split(' ');
const fixUrl = u => u.indexOf(API_CFG.url) === 0 ? u.replace(API_CFG.url, '') : u;

const API_CFG = {
  url: 'https://affiliate-api.flipkart.net/affiliate/',
  ominto: {
    id: 'ominto',
    token: '8d1c9a5c73444554ada5b2fd7ff3562d',
  },
  dubli: {
    id: 'malldubli',
    token: '030fe74c94ce4dfe860ef27468021fd9',
  }
};

function FlipkartClient(s_entity) {
  if (!(this instanceof FlipkartClient)) return new FlipkartClient(s_entity);
  if (!s_entity) throw new Error("Missing required argument 's_entity'!");
  if (!API_CFG[s_entity]) throw new Error("Entity '"+s_entity+"' is not defined in API_CFG.");
  debug("Create new client for entity: %s", s_entity);

  this.cfg = API_CFG[s_entity];

  this.client = request.catch({
    baseUrl: API_CFG.url,
    resolveWithFullResponse: false,
    simple: true,
    json: true,
    headers: {
      'Fk-Affiliate-Id': this.cfg.id,
      'Fk-Affiliate-Token': this.cfg.token
    }
  });

  // Documentation: http://www.flipkart.com/affiliate/apifaq 5. => limit is 20/sec
  //limiter.request(this.client, 20, 1).debug(debug);
}

// JSON API: https://affiliate-api.flipkart.net/affiliate/report/orders/detail/json?startDate=yyyy-MM-dd&endDate=yyyy-MM-dd&status=<status>&offset=0
FlipkartClient.prototype.getPaginated = co.wrap(function* (url, key) {
  let currentUrl = fixUrl(url);
  let results = [];
  while (true) {
    debug("fetch %s%s", API_CFG.url, currentUrl);
    let response = yield this.client.get(currentUrl);

    debug("next url: %s", response.next);
    let val = _.get(response, key);

    if (val && _.isArray(val)) results = results.concat(val);
    if (!response.next) break;

    currentUrl = fixUrl(response.next);
  }
  return results;
});

FlipkartClient.prototype.ordersReportByStatus = co.wrap(function* (start, end, status) {
  let url = 'report/orders/detail/json?' + querystring.stringify({
    startDate: moment(start).format('YYYY-MM-DD'),
    endDate: moment(end).format('YYYY-MM-DD'),
    status: status,
    offset: 0
  });

  return yield this.getPaginated(url, 'orderList');
});

FlipkartClient.prototype.ordersReport = co.wrap(function* (start, end) {
  const promises = {};
  const that = this;
  statuses.forEach(status => promises[status] = that.ordersReportByStatus(start,end,status));
  const results = yield promises;

  return results;
});

module.exports = FlipkartClient;
