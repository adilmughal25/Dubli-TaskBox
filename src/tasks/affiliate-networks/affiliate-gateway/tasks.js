"use strict";

const _ = require('lodash');
const co = require('co');
const debug = require('debug')('affiliategateway:processor');
const utils = require('ominto-utils');
const sendEvents = require('../support/send-events');
const singleRun = require('../support/single-run');
const clientPool = require('./api');
const moment = require('moment');

const taskCache = {};

function setup(s_region) {
  if (taskCache[s_region]) return taskCache[s_region];

  var tasks = {};

  // get commission report
  tasks.getCommissionDetails = singleRun(function* () {
    const client = yield clientPool.getClient(s_region);
    const startDate = new Date(Date.now() - (90 * 86400 * 1000));
    const endDate = new Date(Date.now() - (60 * 1000));

    debug("fetching all transactions between %s and %s", startDate, endDate);

    const results = yield client.GetSalesData({
      Criteria:{
        StartDateTime:  moment(startDate).format('YYYY-MM-DD 00:00:00'),
        EndDateTime:    moment(endDate).format('YYYY-MM-DD 23:59:59')
      }
    });

    let transactions = _.get(results, 'Transactions.Transaction', []);
    let errors = _.get(results, 'Errors', []);

    if (errors.Error && errors.Error.length > 0) {
      throw new Error(errors.Error[0].attributes.code + " - " + errors.Error[0].$value);
    }

    const events = transactions.map(prepareCommission.bind(null, s_region));

    return yield sendEvents.sendCommissions('affiliategateway-'+s_region, events);
  });

  taskCache[s_region] = tasks;

  return tasks;
}

const STATE_MAP = {
  1: 'initiated',
  2: 'confirmed',
  3: 'cancelled',
};

const CURRENCY_MAP = {
  asia: 'usd',
  sg: 'sgd',
  uk: 'gbp',
  au: 'aud'
};

/**
 * Function to prepare a commission transaction for our data event.
 * @param {String} region
 * @param {Object} o_obj  The individual commission transaction straight from TAG
 * @returns {Object}
 */
function prepareCommission(region, o_obj) {

  // https://www.tagadmin.asia/ws/AffiliateSOAP.wsdl
  // https://www.tagadmin.sg/ws/AffiliateSOAP.wsdl
  // using auto as date for a transactions added a bug. hence using "o_obj.TransactionDateTime"
  // for all transactions instead. (check STATUS_MAP for statuses)

  var event = {
    affiliate_name: o_obj.ProgramName, // MerchantName or ProgramName
    transaction_id: o_obj.TransactionId,
    order_id: o_obj.TransactionId,
    outclick_id: (o_obj.AffiliateSubId || ''),  // is an optional element
    currency: CURRENCY_MAP[region],
    purchase_amount: Number(o_obj.OrderAmount),
    commission_amount: Number(o_obj.AffiliateCommissionAmount),
    state: STATE_MAP[o_obj.ApprovalStatusId],   // .. or string representation from "ApprovalStatus"
    //effective_date: 'auto'
    effective_date: new Date(o_obj.TransactionDateTime)
  };

  return event;
}

module.exports = setup;
