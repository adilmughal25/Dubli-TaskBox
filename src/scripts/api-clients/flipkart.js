"use strict";

const AFFILIATE_ID = 'ominto';
const AFFILIATE_TOKEN = '8d1c9a5c73444554ada5b2fd7ff3562d';
const API_URL = 'https://affiliate-api.flipkart.net/affiliate/';

const _ = require('lodash');
const co = require('co');
const moment = require('moment');
const querystring = require('querystring');
const request = require('request-promise');

const statuses = 'Cancelled Approved Pending Disapproved'.split(' ');
const fixUrl = u => u.indexOf(API_URL) === 0 ? u.replace(API_URL, '') : u;


// require('./src/scripts/api-clients/flipkart')().ordersReport(new Date(Date.now() - (86400 * 1000 * 120)), new Date()).then(x => console.log("ret",x), e => console.log("err",e))


function createClient() {
  const client = request.defaults({
    baseUrl: API_URL,
    resolveWithFullResponse: false,
    simple: true,
    headers: {
      'Fk-Affiliate-Id': AFFILIATE_ID,
      'Fk-Affiliate-Token': AFFILIATE_TOKEN
    }
  });

  //  JSON API: https://affiliate-api.flipkart.net/affiliate/report/orders/detail/json?startDate=yyyy-MM-dd&endDate=yyyy-MM-dd&status=<status>&offset=0

  client.getPaginated = co.wrap(function* (url, key) {
    let currentUrl = fixUrl(url);
    let results = [];
    while (true) {
      let response = yield client.get(url);
      let val = _.get(response, key);
      if (val && _.isArray(val)) results = results.concat(val);
      if (! response.next) break;
      currentUrl = fixUrl(response.next);
    }
    return results;
  });

  client.ordersReportByStatus = co.wrap(function* (start, end, status) {
    let url = 'report/orders/detail/json?' + querystring.stringify({
      startDate: moment(start).format('YYYY-MM-DD'),
      endDate: moment(end).format('YYYY-MM-DD'),
      status: status,
      offset: 0
    });
    return yield client.getPaginated(url);
  });


  client.ordersReport = co.wrap(function* (start, end) {
    const promises = {};
    statuses.forEach(status => promises[status] = client.ordersReportByStatus(start,end,status));
    const results = yield promises;
    return results;
  });

  return client;
}

module.exports = createClient;
