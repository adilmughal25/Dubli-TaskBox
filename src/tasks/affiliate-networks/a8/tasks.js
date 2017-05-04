"use strict";

const _ = require('lodash');
const co = require('co');
const debug = require('debug')('a8:api-client');
const moment = require('moment');
const sendEvents = require('../support/send-events');
const singleRun = require('../support/single-run');
const utils = require('ominto-utils');
const converter = require("csvtojson").Converter;

const AFFILIATE_NAME = 'a8';
const CURRENCY = 'JPY';
const NUMBEROFDAYS = 5; // change this to 30 days once there are several days worth reports

const STATUS_MAP = {
  'decide': 'confirmed',
  'unsealed': 'initiated',
  'unsealedadd':'initiated'
};

/**
 * Retrieve a generic A8 API client
 * @returns {A8GenericApi}
 * @constructor
 */
const A8GenericApi = function() {

  if (!(this instanceof A8GenericApi)) return new A8GenericApi();

  var that = this;
  this.client = require('./api')();
  this.eventName = 'a8';
  debug(this.eventName + ':processor');

  /**
   * Retrieve all commissions from A8 Directory
   * @type {Function}
   */
  this.getCommissionDetails = singleRun(function* () {

    var events = [];

    for(var i = 0; i < NUMBEROFDAYS; i++) {

      var currentDate = moment().subtract(i, 'days').format('YYYYMMDD');

      var decideReport = yield that.getDecideReport(currentDate);
      var unsealedReport = yield that.getUnsealedReport(currentDate);
      var unsealedAddReport = yield that.getUnsealedAddReport(currentDate);

      // according to A8, only reports from decide folder & unsealedadd folder should be processed
      // events = events.concat(merge3Reports(decideReport, unsealedReport, unsealedAddReport));
      events = events.concat(merge2Reports(decideReport, unsealedAddReport));
    }

    return yield sendEvents.sendCommissions(that.eventName, events);
  });

  /**
   * Retrieve all decide type commissions from A8 Directory
   * @type {Function}
   */
  this.getDecideReport = co.wrap(function* (currentDate) {

    const url = that.client.url('decide', currentDate);
    debug("fetch %s", url);
    return yield that.client.get(url);
  });

  /**
   * Retrieve all unsealed type commissions from A8 Directory
   * @type {Function}
   */
  this.getUnsealedReport = co.wrap(function* (currentDate) {

    const url = that.client.url('unsealed', currentDate);
    debug("fetch %s", url);
    return yield that.client.get(url);
  });

  /**
   * Retrieve all unsealedadd type commissions from A8 Directory
   * @type {Function}
   */
  this.getUnsealedAddReport = co.wrap(function* (currentDate) {

    const url = that.client.url('unsealedadd', currentDate);
    debug("fetch %s", url);
    return yield that.client.get(url);
  });
};

/**
 * Function to merge the commissions fetched from decideReport & unsealedAddReport methods
 * @param decideReport
 * @param unsealedAddReport
 * @returns {Object} json object with combined commissions from decideReport & unsealedAddReport
 */
function merge2Reports(decideReport, unsealedAddReport) {

  var events = [];

  decideReport = csvToJson(decideReport);
  unsealedAddReport = csvToJson(unsealedAddReport);

  var decideCommission = decideReport.map(prepareCommission.bind(null, 'decide')).filter(x => !!x);
  var unsealedAddCommission = unsealedAddReport.map(prepareCommission.bind(null, 'unsealedadd')).filter(x => !!x);

  events = events.concat(decideCommission, unsealedAddCommission);

  return events;
}

/**
 * Function to merge the commissions fetched from decideReport, unsealedReport & unsealedAddReport methods
 * @param decideReport
 * @param unsealedReport
 * @param unsealedAddReport
 * @returns {Object} json object with combined commissions from decideReport, unsealedReport & unsealedAddReport
 */
function merge3Reports(decideReport, unsealedReport, unsealedAddReport) {

  var events = [];

  decideReport = csvToJson(decideReport);
  unsealedReport = csvToJson(unsealedReport);
  unsealedAddReport = csvToJson(unsealedAddReport);

  var decideCommission = decideReport.map(prepareCommission.bind(null, 'decide')).filter(x => !!x);
  var unsealedCommission = unsealedReport.map(prepareCommission.bind(null, 'unsealed')).filter(x => !!x);
  var unsealedAddCommission = unsealedAddReport.map(prepareCommission.bind(null, 'unsealedadd')).filter(x => !!x);

  events = events.concat(decideCommission, unsealedCommission, unsealedAddCommission);

  return events;
}

/**
 * Convert csv data to json
 * @param csv commission data
 * @returns {Object}
 */
function csvToJson(csv) {

  csv = csv.replace(/['"]+/g, '');
  const content = csv.split('\n');
  const header = content[0].split(',');
  return _.tail(content).map((row) => {
    return _.zipObject(header, row.split(','));
  });
}

/**
 * Extract the commission data into the required data structure
 * @param o_obj raw commission data from api
 * @returns {Object} commission object
 */
function prepareCommission(state, o_obj) {

  // only if the obj exists and a valid order_id exist [eliminating headers]
  // multiplying by 100 for currency conversion for JPY
  if(o_obj && _.get(o_obj, 'ORDER_ID')){

    const commission = {};
    var isCancelled = false;

    if(Number(_.get(o_obj, '���V�Ώے������z')) < 0)
      isCancelled = true;

    commission.affiliate_name = AFFILIATE_NAME,
    commission.merchant_name = '',
    commission.merchant_id = '',
    commission.outclick_id = _.get(o_obj, 'POINT_ID1');
    commission.transaction_id = _.get(o_obj, 'ORDER_ID');
    commission.order_id = _.get(o_obj, 'ORDER_ID');
    commission.purchase_amount = Number(_.get(o_obj, '���V�Ώے������z'))*100 || 0;
    commission.commission_amount = Number(_.get(o_obj, '�������V�z'))*100 || 0;
    commission.currency = CURRENCY;
    commission.effective_date = new Date(_.get(o_obj, '������'));
    commission.state = STATUS_MAP[state];

    if(isCancelled)
      commission.state = 'cancelled';

    return commission;
  }
}

module.exports = A8GenericApi;
