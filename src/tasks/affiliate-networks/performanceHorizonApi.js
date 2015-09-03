"use strict";

const _ = require('lodash');
const debug = require('debug')('performancehorizon:processor');
const moment = require('moment');
const utils = require('ominto-utils');
const sendEvents = require('./support/send-events');
const singleRun = require('./support/single-run');

const client = require('./api-clients/performance-horizon')();

const ary = x => !!x ? (_.isArray(x) ? x : [x]) : [];


// doesn't seem to have coupons/deals/links in their api, this api just returns
// commission rates and advertiser info
var getMerchants = singleRun(function* (){
  const url = client.url('merchants');
  debug("fetching url %s", url);
  var data = yield client.get(url);
  var merchants = (data.campaigns || []).map(function(campaign) {
    return {merchant:campaign.campaign};
  });

  yield sendEvents.sendMerchants('performancehorizon', merchants);
});

var getCommissionDetails = singleRun(function* () {
  const start = moment().subtract(90, 'days').format('YYYY-MM-DD HH:mm:ss');
  const end = moment().format('YYYY-MM-DD HH:mm:ss');
  let results = [];
  let page = 1;
  while (true) {
    const url = client.url('transactions', {start:start, end:end, page:page});
    debug('fetching url %s', url);
    const response = yield client.get(url);
    results = results.concat(ary(response.conversions));
    const ceiling = response.offset + response.limit;
    debug('loaded %d of %d', Math.min(ceiling,response.count), response.count);
    if (ceiling >= response.count) break;
    page += 1;
  }
  const events = results.map(extractConversionData).map(prepareCommission);
  yield sendEvents.sendMerchants('performancehorizon', events);
});

function extractConversionData(d) {
  return d.conversion_data;
}

const STATUS_MAP = {
  'approved': 'confirmed',
  'mixed': 'confirmed',
  'pending': 'initiated',
  'rejected': 'cancelled'
};

function prepareCommission(o_obj) {
  const event = {
    transaction_id: o_obj.conversion_id,
    outclick_id: o_obj.click.publisher_reference,
    purchase_amount: o_obj.conversion_value.value,
    commission_amount: o_obj.conversion_value.publisher_commission,
    currency: o_obj.currency,
    state: STATUS_MAP[o_obj.conversion_value.conversion_status],
    effective_date: o_obj.conversion_value.conversion_status === 'pending' ? new Date(o_obj.conversion_time) : 'auto'
  };
  return event;
}

module.exports = {
  getMerchants: getMerchants,
  getCommissionDetails: getCommissionDetails
};
