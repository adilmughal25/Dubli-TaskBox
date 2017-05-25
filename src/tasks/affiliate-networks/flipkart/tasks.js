"use strict";

const _ = require('lodash');
const debug = require('debug')('flipkart:processor');
const moment = require('moment');
const sendEvents = require('../support/send-events');
const singleRun = require('../support/single-run');

const AFFILIATE_NAME = 'direct-partner';
const MERCHANT_NAME = 'flipkart';

const FlipkartGenericApi = function(s_entity) {
  if (!(this instanceof FlipkartGenericApi)) {
    debug("instantiating FlipkartGenericApi for: %s", s_entity);
    return new FlipkartGenericApi(s_entity);
  }

  var that = this;

  this.entity = s_entity ? s_entity.toLowerCase() : 'ominto';
  this.client = require('./api')(this.entity);
  this.eventName = (this.entity !== 'ominto' ? this.entity + '-' : '') + 'flipkart';

  this.getCommissionDetails = singleRun(function* () {
    const start = moment().subtract(90, 'days').format('YYYY-MM-DD');
    const end = moment().format('YYYY-MM-DD');
    const results = yield that.client.ordersReport(start, end);

    const events = [].concat(
      // changing the transactions state from confirmed to initiated [this change is for
      // points systems for Indian customers]
      // results.Approved.map(prepareCommission.bind(null, 'confirmed')),
      results.Approved.map(prepareCommission.bind(null, 'initiated')),
      results.Disapproved.map(prepareCommission.bind(null, 'cancelled')),
      results.Cancelled.map(prepareCommission.bind(null, 'cancelled')),
      results.Pending.map(prepareCommission.bind(null, 'initiated'))
    );

    return yield sendEvents.sendCommissions(that.eventName, events);
  });
};

function prepareCommission(status, o_obj) {

  // https://affiliate.flipkart.com/api-docs/af_report_ref.html#request-and-response-details
  // flipkart send us only one date, ie the order date

  const event = {
    affiliate_name: AFFILIATE_NAME,
    merchant_name: MERCHANT_NAME,
    merchant_id: '',
    transaction_id: o_obj.affiliateOrderItemId,
    order_id: o_obj.affiliateOrderItemId,
    outclick_id: o_obj.affExtParam1,
    commission_amount: o_obj.tentativeCommission.amount,
    purchase_amount: o_obj.sales.amount,
    currency: o_obj.tentativeCommission.currency,
    state: status,
    // effective_date: status === 'pending' ? Date.parse(o_obj.orderDate) : 'auto'
    effective_date: Date.parse(o_obj.orderDate)
  };
  return event;
}

module.exports = FlipkartGenericApi;

/*

snippets from emails to/from flipkart, provided as documentation:

----
Pending = Tentative = Orders that are not confirmed either way
Cancelled = Failed = Orders that are cancelled by the customer per the 30-day return policy
Disapproved = Orders on which commissions are manually disapproved by Flipkart due to fraud
Approved = Processed = Orders that are guaranteed by Flipkart to be paid in commissions to us

----

Q:
  When I'm querying this data for a date range, for example '2015-05-01 through 2015-05-31'
  with status 'Approved', does this mean "a) all orders that were placed in may and now have
  status='approved'", or "b) all orders that were approved in may"?

  If the answer is (a), does this mean that in order to maintain good accounting, I will
  need to continually scan 90 days or so worth of data just to try to find any that have
  changed in status in that time?

A:
  The answer is (a). If you query the data for a date range between '2015-05-01 through
  2015-05-31' with status 'Approved', it means all orders that were placed in May and
  now have status='approved'.

  We approve the orders for a given month (at one go) after 31 days, counting from
  the last day of that month. Say, all orders of 1-31 May will be approved at one
  go in the 1st week of July (before 30-June, all these May orders will be in
  pending/tentative status).

----
2. What's the difference between 'Cancelled' and 'Disapproved' ?

    >> 'Disapproved' orders are those on which commissions are manually disapproved
    by Flipkart team due to fraud reasons. 'Cancelled' orders are those which are
    either cancelled by customer or Fipkart team as per the 30-day return policy

3. There's an order date, but I don't see any way of identifying the date when something
became approved/disapproved/cancelled/pending/tentative/failed ? is this data unavailable ?

    >> Yes, this data is not available. We only provide the order date. All valid orders
    for a given month are moved from 'Pending' (pending & tentative are the same) to
    'Approved' status after 31 days from the last day of that month (say, all
    pending orders of 1-31 Aug are 'approved' in the 1st week of October).

4. There doesn't seem to be an api for payment info or invoices. Is there any
way we can find out when the commission for any given order has been paid to us?

    >> No, we don't provide API for payment info or invoices. Payments for all
    the 'approved' orders are made by the last week of the same month (say, all
    pending orders of 1-31 Aug are 'approved' in the 1st week of October and payment
    is credited by last week of October). You can refer "Reports --> Payments Report"
    section in affiliate panel and refer the invoice amount for a give month with
    next month's date (say, commission amount for May'15 orders will have payment
    date as 28-June-2015, June'15 orders will have payment date as 28-July-2015,
    and so on).

 */
