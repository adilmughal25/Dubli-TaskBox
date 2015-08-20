"use strict";

const _ = require('lodash');
const debug = require('debug')('flipkart:processor');
const moment = require('moment');
const sendEvents = require('./support/send-events');
const singleRun = require('./support/single-run');
const client = require('./api-clients/flipkart')();

/****
 ***
 **
 * FlipKart is still incomplete, i'm still waiting for support issues on it.
 * However, most of this code should be more or less what we need once we have
 * heard back.
 *
 * The primary unsolved issue is based on how far back we need to query the
 * API to catch changes in permissions.. We may also need to have some sort of
 * 'have we processed this status yet' check because of the 90+ day check.
 **
 ***
 ****/

var getCommissionDetails = singleRun(function* () {
  const start = moment().subtract(90, 'days').format('YYYY-MM-DD');
  const end = moment().format('YYYY-MM-DD');
  const results = yield client.ordersReport(start, end);
  const events = [].concat(
    results.Approved.map(prepareCommission.bind(null, 'confirmed')),
    results.Disapproved.map(prepareCommission.bind(null, 'cancelled')),
    results.Cancelled.map(prepareCommission.bind(null, 'cancelled')),
    results.Pending.map(prepareCommission.bind(null, 'pending'))
  );
  return yield sendEvents.sendCommissions('flipkart', events);
});

function prepareCommission(status, o_obj) {
  const event = {
    transaction_id: o_obj.affilliateOrderItemId,
    outclick_id: o_obj.affExtParam1,
    commission_amount: o_obj.tentativeCommission.amount,
    purchase_amount: o_obj.sales.amount,
    currency: o_obj.tentativeCommission.currency,
    state: status,
    effective_date: o_obj.orderDate
  };
  return event;
}

/* SAMPLE DATA AS PROVIDED BY http://www.flipkart.com/affiliate/apifaq :
 *
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

*/
