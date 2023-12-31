"use strict";

const _ = require('lodash');
const debug = require('debug')('snapdeal:processor');
const moment = require('moment');
const sendEvents = require('../support/send-events');
const singleRun = require('../support/single-run');

const AFFILIATE_NAME = 'direct-partner';
const MERCHANT_NAME = 'snapdeal';

const CURRENCY = 'inr';

/**
 * Generic API for Snapdeal
 * @param {String} s_entity - name of the account (defaulted to ominto)
 */
const SnapdealGenericApi = function(s_entity) {

  if (!(this instanceof SnapdealGenericApi)) {
    debug("instantiating SnapdealGenericApi for : %s", s_entity);
    return new SnapdealGenericApi(s_entity);
  }

  var that = this;
  this.entity = s_entity ? s_entity.toLowerCase() : 'ominto';
  this.client = require('./api')(this.entity);
  this.eventName = (this.entity !== 'ominto' ? this.entity + '-' : '') + 'snapdeal';

  /**
   * Function to get commission(orders/transactions) details
   * @returns {Array} Array - json array of all the commissions fetched using api call
   */
  this.getCommissionDetails = singleRun(function* () {

    const start = moment().subtract(270, 'days').format('YYYY-MM-DD');
    const end = moment().format('YYYY-MM-DD');

    const response = yield that.client.orderReport(start, end);

    // converting all the 'approved/confirmed' transactions to 'initiated' state so that a
    // transaction is not converted to 'paid' state, as this will be later changed to points system
    // for each status
    const events = [].concat(
      // response.approved.map(prepareCommission.bind(null, 'confirmed')),
      response.approved.map(prepareCommission.bind(null, 'initiated')),
      response.cancelled.map(prepareCommission.bind(null, 'cancelled'))
    );

    return yield sendEvents.sendCommissions(that.eventName, events);
  });
};

/**
 * Function to map affiliate commission data to our transaction data
 * @param {String} status - status of the transaction (confirmed/cancelled)
 * @param {Object} o_obj - reponse object containing commission details from affilaite
 * @returns {Object} event - json object containing mapped transactions data
 */
function prepareCommission(status, o_obj) {

  const event = {
    affiliate_name: AFFILIATE_NAME,
    merchant_name: MERCHANT_NAME,
    merchant_id: '',
    //transaction_id: o_obj.orderCode + "-" + fetchAscii(o_obj.product),
    transaction_id: truncateMax(o_obj.orderCode + "-" + o_obj.product),
    order_id: o_obj.orderCode,
    outclick_id: o_obj.affiliateSubId1,
    commission_amount: o_obj.commissionEarned,
    purchase_amount: o_obj.sale,
    currency: CURRENCY,
    state: status,
    effective_date: new Date(o_obj.dateTime)
  };

  return event;
}

/**
 * Function to convert string to ascii cahr sequence
 * @param {String} product - string to convert
 * @returns {String} convertedAscii - convert ascii value
 */
function fetchAscii(product)
{
  var convertedAscii = '';
  for(var i = 0; i < product.length; i++)
  {
    convertedAscii += product.charCodeAt(i);
  }
  return convertedAscii;
}

/**
 * Function to limit string to max of 250 chars
 * @param {String} product - string to trucate
 * @returns {String} product - string with 250 max chars
 */
function truncateMax(product)
{
  return product.substring(0, 250);
}

module.exports = SnapdealGenericApi;
