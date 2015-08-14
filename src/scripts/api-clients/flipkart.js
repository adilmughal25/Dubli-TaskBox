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

  /* SAMPLE DATA AS PROVIDED BY http://www.flipkart.com/affiliate/apifaq :
  {
    "orderList": [
      {
        "price": 248,
        "category": "books",
        "title": "Golden Moments (English)",
        "productId": "9780751541397",
        "quantity": 1,
        "sales": {
          "amount": 248,
          "currency": "INR"
        },
        "status": "failed",
        "affiliateOrderItemId": "12345",
        "orderDate": "02-09-2014",
        "commissionRate": 10,
        "tentativeCommission": {
          "amount": 24.8,
          "currency": "INR"
        },
        "affExtParam1": "test",
        "affExtParam2": "",
        "salesChannel": "WEBSITE",
        "customerType": "NEW"
      }
    ],
    "previous": "",
    "next": "",
    "first": "https://affiliate-api.flipkart.net/affiliate/report/orders/detail/json?startDate=2014-09-01&endDate=2014-10-02&status=cancelled&offset=0",
    "last": "https://affiliate-api.flipkart.net/affiliate/report/orders/detail/json?startDate=2014-09-01&endDate=2014-10-02&status=cancelled&offset=0"
  }

  * I don't know what 'status' means, because the url has possible status values
  * of (Pending|Approved|Cancelled|Disapproved), while the Api response has possible
  * status values of (tentative|failed). there is no documentation about how these
  * two fields relate to each other and I have no sample data to work with on this
  * one yet. Both sets of status fields are documented both in the response JSON
  * and in the api faq page. We've sent off a support email with questions to flipkart.
  *
  * committing this code as it is for now anyway, once I get this question figured out,
  */
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
