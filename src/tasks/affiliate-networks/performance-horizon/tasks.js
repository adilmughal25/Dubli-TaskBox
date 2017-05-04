"use strict";

const _ = require('lodash');
const debug = require('debug')('performancehorizon:processor');
const moment = require('moment');
const utils = require('ominto-utils');
const sendEvents = require('../support/send-events');
const singleRun = require('../support/single-run');

const AFFILIATE_NAME = 'performancehorizon';

const ary = x => !!x ? (_.isArray(x) ? x : [x]) : [];

const STATUS_MAP = {
  'approved': 'confirmed',
  'mixed': 'confirmed',
  'pending': 'initiated',
  'rejected': 'cancelled'
};

const PerformanceHorizonGenericApi = function(s_entity) {
  if (!(this instanceof PerformanceHorizonGenericApi)) {
    debug("instantiating PerformanceHorizonGenericApi for: %s", s_entity);
    return new PerformanceHorizonGenericApi(s_entity);
  }

  var that = this;

  this.entity = s_entity ? s_entity.toLowerCase() : 'ominto';
  this.client = require('./api')(this.entity);
  this.eventName = (this.entity !== 'ominto' ? this.entity + '-' : '') + 'performancehorizon';

  // doesn't seem to have coupons/deals/links in their api, this api just returns
  // commission rates and advertiser info
  this.getMerchants = singleRun(function* (){
    const url = that.client.getUrl('merchants');
    debug("fetching url %s", url);
    var data = yield that.client.get(url);
    var merchants = (data.campaigns || []).map(function(campaign) {
      return {merchant:campaign.campaign};
    });

    return yield sendEvents.sendMerchants(that.eventName, merchants);
  });

  this.getCommissionDetails = singleRun(function* () {

    // changing from 90 to 180 days (to fetch travel related transactions updates)
    const start = moment().subtract(180, 'days').format('YYYY-MM-DD HH:mm:ss');
    const end = moment().format('YYYY-MM-DD HH:mm:ss');

    let results = [];
    let page = 1;

    while (true) {
      const url = that.client.getUrl('transactions', {start:start, end:end, page:page});
      debug('fetching url %s', url);
      const response = yield that.client.get(url);
      results = results.concat(ary(response.conversions));
      const ceiling = response.offset + response.limit;
      debug('loaded %d of %d', Math.min(ceiling,response.count), response.count);
      if (ceiling >= response.count) break;
      page += 1;
    }

    const events = results.map(extractConversionData).map(prepareCommission);

    return yield sendEvents.sendCommissions(that.eventName, events);
  });
};

function extractConversionData(d) {
  return d.conversion_data;
}

function prepareCommission(o_obj) {

  // http://docs.performancehorizon.apiary.io/#reference/export-reporting/export-conversions/export-conversions
  // perviously the effective_date had the initial date i.e. if the status was pending,
  // else it was set to auto. this added a bug, i.e. when an travel related transaction for
  // merchant like expedia was approved, because the date was set to auto, the actual
  // date of approval(confirmed) gets updated to current date. hence using "conversion_items[0].approved_at"
  // for approved transactions & mixed transactions and "conversion_items[0].last_update"
  // for rejected transactions instead. (check STATUS_MAP for statuses)

  var _date = 'auto';
  if(o_obj.conversion_value.conversion_status === 'pending')
    _date = new Date(o_obj.conversion_time);
  else if(o_obj.conversion_value.conversion_status === 'approved' || o_obj.conversion_value.conversion_status === 'mixed')
    _date = new Date(o_obj.conversion_items[0].approved_at);
  else if(o_obj.conversion_value.conversion_status === 'rejected')
    _date = new Date(o_obj.conversion_items[0].last_update);

  const event = {
    affiliate_name: AFFILIATE_NAME,
    merchant_name: o_obj.campaign_title || '',
    merchant_id: o_obj.campaign_id || '',
    transaction_id: o_obj.conversion_id,
    order_id: o_obj.conversion_id,
    outclick_id: o_obj.click.publisher_reference,
    purchase_amount: o_obj.conversion_value.value,
    commission_amount: o_obj.conversion_value.publisher_commission,
    currency: o_obj.currency,
    state: STATUS_MAP[o_obj.conversion_value.conversion_status],
    // effective_date: o_obj.conversion_value.conversion_status === 'pending' ? new Date(o_obj.conversion_time) : 'auto'
    effective_date: _date
  };
  return event;
}

module.exports = PerformanceHorizonGenericApi;
