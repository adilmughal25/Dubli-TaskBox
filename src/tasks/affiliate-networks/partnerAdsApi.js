"use strict";

/*
 * for getCommissionDetails:
 * - Note that cancellations (sales transactions) do not provide same/full set of details as regular sales transactions.
 * - The commissions processor must have a way of matching the possibly privious imported "initiated" transaction with a later "cancelled" one.
 * - They do not provide a unique transaction id. We concatenate "programid"+""-"+"ordrenr"
 */

const _ = require('lodash');
const co = require('co');
const debug = require('debug')('partnerads:processor');
const sendEvents = require('./support/send-events');
const singleRun = require('./support/single-run');
const client = require('./api-clients/partnerAds')();

/**
 * Retrieve all merchant/program information from PartnerAds.
 * @returns {undefined}
 */
var getMerchants = singleRun(function* () {
  const programs = (yield client.call('programs', 'partnerprogrammer.program')).map(m => ({merchant:m}));

  yield sendEvents.sendMerchants('partnerads', programs);
});

/**
 * Retrieve all sales/lead transactions (newly and cancelled) from PartnerAds.
 * @returns {undefined}
 */
const getCommissionDetails = singleRun(function* () {
  let startDate = new Date(Date.now() - (30 * 86400 * 1000)),
      endDate = new Date(Date.now() - (60 * 1000));

  // get all sales/leads
	const sales = (yield client.call('commissions', 'salgspec.salg', {fra: startDate, til:endDate})).map(prepareCommission);

  // get all cancelled sales/leads
  const cancellations = (yield client.call('cancellations', 'annulleredeordrer.annullering', {fra: startDate, til:endDate})).map(prepareCancellations);

  // merge it
  const transactions = sales.concat(cancellations);

  yield sendEvents.sendCommissions('partnerads', transactions);
});

/**
 * Function to prepare a single commission transaction for our data event.
 * *Note: They do not provide a unique transaction id. We concatenate "programid"+""-"+"ordrenr"
 * @param {Object} o_obj  The individual commission transaction straight from PartnerAds
 * @returns {Object}
 */
function prepareCommission(o_obj) {
  let transactionId = o_obj.programid + '-' + o_obj.ordrenr;

  var sale = {
    affiliate_name: o_obj.program,
    transaction_id: transactionId,
    outclick_id: o_obj.uid,
    currency: 'dkk',
    purchase_amount: o_obj.omsaetning,
    commission_amount: o_obj.provision,
    state: 'initiated',
    effective_date: o_obj.dato + ' ' + o_obj.tidspunkt
  };

  return sale;
}

/**
 * Function to prepare a single cancellation transaction for our data event.
 * *Note: They do not provide a unique transaction id. We concatenate "programid"+""-"+"ordrenr"
 * @param {Object} o_obj  The individual commission transaction straight from PartnerAds
 * @returns {Object}
 */
function prepareCancellations(o_obj) {
  let transactionId = o_obj.programid + '-' + o_obj.ordrenr;

  var sale = {
    affiliate_name: o_obj.program,
    transaction_id: transactionId,
    //outclick_id: null,    // not provided on cancellations
    currency: 'dkk',
    //purchase_amount: null,  // not provided on cancellations
    commission_amount: o_obj.provision,
    state: 'cancelled',
    effective_date: o_obj.dato
  };

  return sale;
}

module.exports = {
  getMerchants: getMerchants,
  getCommissionDetails: getCommissionDetails
};
