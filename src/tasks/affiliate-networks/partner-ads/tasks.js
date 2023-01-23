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
const sendEvents = require('../support/send-events');
const singleRun = require('../support/single-run');

const moment = require('moment');
//const utils = require('ominto-utils');
const configs = require('../../../../configs.json');
//const utilsDataClient = utils.restClient(configs.data_api);

const AFFILIATE_NAME = 'partnerads';

const PartnerAdsGenericApi = function(s_entity) {
  if (!(this instanceof PartnerAdsGenericApi)) {
    debug("instantiating PartnerAdsGenericApi for: %s", s_entity);
    return new PartnerAdsGenericApi(s_entity);
  }

  var that = this;

  this.entity = s_entity ? s_entity.toLowerCase() : 'ominto';
  this.client = require('./api')(this.entity);
  this.eventName = (this.entity !== 'ominto' ? this.entity + '-' : '') + 'partnerads';

  /**
   * Retrieve all merchant/program information from PartnerAds.
   * @returns {undefined}
   */
  this.getMerchants = singleRun(function* () {
    const programs = (yield that.client.call('programs', 'partnerprogrammer.program')).map(m => ({merchant:m}));

    return yield sendEvents.sendMerchants(that.eventName, programs);
  });

  /**
   * Retrieve all sales/lead transactions (newly and cancelled) from PartnerAds.
   * @returns {undefined}
   */
  this.getCommissionDetails = singleRun(function* () {
    // const startDate = new Date(Date.now() - (90 * 86400 * 1000));
    // const endDate = new Date(Date.now() - (60 * 1000));

    let allCommissions = [];

    //let taskDate = yield utilsDataClient.get('/getTaskDateByAffiliate/' + AFFILIATE_NAME, true, this);

    if (taskDate.body && taskDate.body !== "Not Found") {
      let startCount = moment().diff(moment(taskDate.body.start_date), "days")
      let endCount = moment().diff(moment(taskDate.body.end_date), "days");
      allCommissions = yield that.getCommissionsByDate(startCount, endCount);
      //yield utilsDataClient.patch('/inactivateTask/' + AFFILIATE_NAME, true, this);
    }

    const startDate = new Date(Date.now() - (270 * 86400 * 1000));
    const endDate = new Date(Date.now());

    // get all sales/leads
    const sales = (yield that.client.call('commissions', 'salgspec.salg', {fra: startDate, til:endDate})).map(prepareCommission);

    // get all cancelled sales/leads
    const cancellations = (yield that.client.call('cancellations', 'annulleredeordrer.annullering', {fra: startDate, til:endDate})).map(prepareCancellations);

    // merge it
    const transactions = sales.concat(cancellations);
    allCommissions = allCommissions.concat(transactions);
    return yield sendEvents.sendCommissions(that.eventName, allCommissions);
  });

  this.getCommissionsByDate = co.wrap(function* (fromCount, toCount) {
    let startDate;
    let endDate;
    let allCommissions = [];
    try {

      let startCount = fromCount;
      let endCount = (fromCount - toCount > 90) ? fromCount - 90 : toCount;

      debug('start');

      while (true) {
        debug('inside while');
        if (startCount <= toCount) {
          break;
        }

        debug('start date --> ' + moment().subtract(startCount, 'days').toDate() + ' start count --> ' +startCount);
        debug('end date --> ' + moment().subtract(endCount, 'days').toDate() + ' end count --> ' +endCount);
        startDate = new Date(Date.now() - (startCount * 86400 * 1000));
        endDate = new Date(Date.now() - (endCount * 86400 * 1000));

        // get all sales/leads
        const sales = (yield that.client.call('commissions', 'salgspec.salg', {fra: startDate, til:endDate})).map(prepareCommission);

        // get all cancelled sales/leads
        const cancellations = (yield that.client.call('cancellations', 'annulleredeordrer.annullering', {fra: startDate, til:endDate})).map(prepareCancellations);

        // merge it
        const transactions = sales.concat(cancellations);
        allCommissions = allCommissions.concat(transactions);

        endCount = (startCount - endCount >= 90) ? endCount - 90 : toCount;
        startCount = startCount - 90;
      }

      debug('finish');
    } catch (e) {
      console.log(e);
    }
    return allCommissions;
  });

};

/**
 * Function to prepare a single commission transaction for our data event.
 * *Note: They do not provide a unique transaction id. We concatenate "programid"+""-"+"ordrenr".
 * By default the status of these transactions are confirmed and not initiated. This
 * was confrimed with PartnerAds
 * @param {Object} o_obj  The individual commission transaction straight from PartnerAds
 * @returns {Object}
 */
function prepareCommission(o_obj) {

  //let transactionId = o_obj.programid + '-' + o_obj.ordrenr;
  let transactionId = o_obj.ordrenr;

  var sale = {
    affiliate_name: AFFILIATE_NAME,
    merchant_name: o_obj.program || '',
    merchant_id: o_obj.programid || '',
    transaction_id: transactionId,
    order_id: o_obj.ordrenr,
    outclick_id: o_obj.uid,
    currency: 'dkk',
    purchase_amount: o_obj.omsaetning,
    commission_amount: o_obj.provision,
    state: 'confirmed',
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

  //let transactionId = o_obj.programid + '-' + o_obj.ordrenr;
  let transactionId = o_obj.ordrenr;

  var sale = {
    affiliate_name: o_obj.program,
    transaction_id: transactionId,
    order_id: o_obj.ordrenr,
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
