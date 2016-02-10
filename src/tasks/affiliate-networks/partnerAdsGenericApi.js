"use strict";

/*
 * for getCommissionDetails:
 * - Note that cancellations (sales transactions) do not provide same/full set of details as regular sales transactions.
 * - The commissions processor must have a way of matching the possibly previous imported "initiated" transaction with a later "cancelled" one.
 * - They do not provide a unique transaction id. We concatenate "programid"+""-"+"ordrenr"
 */

const _ = require('lodash');
const co = require('co');
const debug = require('debug')('partnerads:processor');
const sendEvents = require('./support/send-events');
const singleRun = require('./support/single-run');

const PartnerAdsGenericApi = function(s_entity) {
  if (!(this instanceof PartnerAdsGenericApi)) {
    debug("instantiating PartnerAdsGenericApi for: %s", s_entity);
    return new PartnerAdsGenericApi(s_entity);
  }

  var that = this;

  this.entity = s_entity ? s_entity.toLowerCase() : 'ominto';
  this.client = require('./api-clients/partnerAds')(this.entity);
  this.eventName = (this.entity !== 'ominto' ? this.entity + '-' : '') + 'partnerads';

  /**
   * Retrieve all merchant/program information from PartnerAds.
   * @returns {undefined}
   */
  this.getMerchants = singleRun(function* () {
    const programs = (yield that.client.call('programs', 'partnerprogrammer.program')).map(m => ({merchant:m}));

    yield sendEvents.sendMerchants(that.eventName, programs);
  });

  /**
   * Retrieve all sales/lead transactions (newly and cancelled) from PartnerAds.
   * @returns {undefined}
   */
  this.getCommissionDetails = singleRun(function* () {
    const startDate = new Date(Date.now() - (30 * 86400 * 1000));
    const endDate = new Date(Date.now() - (60 * 1000));

    // get all sales/leads
    const sales = (yield that.client.call('commissions', 'salgspec.salg', {fra: startDate, til:endDate})).map(prepareCommission);

    // get all cancelled sales/leads
    const cancellations = (yield that.client.call('cancellations', 'annulleredeordrer.annullering', {fra: startDate, til:endDate})).map(prepareCancellations);

    // merge it
    const transactions = sales.concat(cancellations);

    yield sendEvents.sendCommissions(that.eventName, transactions);
  });

};

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
    effective_date: reformatDate(o_obj.dato, o_obj.tidspunkt)
  };

  return sale;
}

// future-proofing since this changes in a more recent lodash
var padLeft = typeof _.padStart === 'function' ? _.padStart : _.padLeft;

// partnerads has a .dato field that looks like '22-1-2016' and a .tidspunkt field that looks like hh:mm:ss. make a date
function reformatDate (date, time) {

  var dateParts = date.split(/\s*-\s*/);
  var dateString = [
    dateParts[2],
    padLeft(dateParts[1], 2, 0),
    padLeft(dateParts[0], 2, 0),
  ].join('-') + ' ' + time;
  return new Date(dateString);
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

module.exports = PartnerAdsGenericApi;
