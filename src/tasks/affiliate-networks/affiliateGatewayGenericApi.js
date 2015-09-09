"use strict";

/*
 * - no sample transactions available yet
 * - double check response format of Transactions Object/Array?
 * - reporting currency unclear
 * - attributes possible values such as for "TransactionType" and status is unknown
 */

const _ = require('lodash');
const co = require('co');
const debug = require('debug')('affiliategateway:processor');
const utils = require('ominto-utils');
const sendEvents = require('./support/send-events');
const singleRun = require('./support/single-run');
const clientPool = require('./api-clients/affiliategatewaySoap');
const moment = require('moment');

const taskCache = {};

function setup(s_region) {
  if (taskCache[s_region]) return taskCache[s_region];

  var tasks = {};

  // get commission report
  tasks.getCommissionDetails = singleRun(function* () {
    const client = yield clientPool.getClient(s_region);
    const startDate = new Date(Date.now() - (30 * 86400 * 1000));
    const endDate = new Date(Date.now() - (60 * 1000));

    debug("fetching all transactions between %s and %s", startDate, endDate);

    const results = yield client.GetSalesData({
      Criteria:{
        StartDateTime:  moment(startDate).format('YYYY-MM-DD 00:00:00'),
        EndDateTime:    moment(endDate).format('YYYY-MM-DD 23:59:59')
      }
    });

    let transactions = _.get(results, 'Transactions', []);
    let errors = _.get(results, 'Errors', []);

    if (errors.Error && errors.Error.length > 0) {
      throw new Error(errors.Error[0].attributes.code + " - " + errors.Error[0].$value);
    }

    const events = transactions.map(prepareCommission.bind(null, s_region));

    yield sendEvents.sendCommissions('affiliategateway-'+s_region, events);
  });

  taskCache[s_region] = tasks;

  return tasks;
}

const STATE_MAP = {
  1: 'initiated',
  2: 'confirmed',
  3: 'cancelled',
};

// TODO : figure out the reporting currency
const CURRENCY_MAP = {
  asia: 'n/a',
  sg: 'n/a',
  uk: 'n/a',
  au: 'n/a'
};

/**
 * Function to prepare a commission transaction for our data event.
 * @param {String} region
 * @param {Object} o_obj  The individual commission transaction straight from TAG
 * @returns {Object}
 */
function prepareCommission(region, o_obj) {
  var event = {
    affiliate_name: o_obj.MerchantName,
    transaction_id: o_obj.TransactionId,
    outclick_id: (o_obj.AffiliateSubId || ''),  // is an optional element
    currency: CURRENCY_MAP[region],
    purchase_amount: o_obj.OrderAmount,
    commission_amount: o_obj.AffiliateCommissionAmount,
    state: STATE_MAP[o_obj.ApprovalStatusId],   // .. or string representation from "ApprovalStatus"
    effective_date: 'auto'
  };

  return event;
}

module.exports = setup;