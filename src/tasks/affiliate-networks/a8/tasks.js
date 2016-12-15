"use strict";

const _ = require('lodash');
const co = require('co');
const debug = require('debug')('a8:api-client');
const moment = require('moment');
const sendEvents = require('../support/send-events');
const singleRun = require('../support/single-run');
const utils = require('ominto-utils');
const converter = require("csvtojson").Converter;

// TODO : confirm this
const CURRENCY = 'JPY';

// TODO : not sure if decide is initiated or confirmed, also confirm for unsealed & unsealedadd
const STATUS_MAP = {
  // 'decide': 'initiated',
  'decide': 'confirmed',
  'unsealed': 'cancelled',
  'unsealedadd':'cancelled'
};

const A8GenericApi = function() {

  if (!(this instanceof A8GenericApi)) return new A8GenericApi();

  var that = this;
  this.client = require('./api')();
  this.eventName = 'a8';
  debug(this.eventName + ':processor');

  this.getCommissionDetails = singleRun(function* () {

    const currentDate = moment().format('YYYYMMDD');

    var decideReport = yield that.getDecideReport(currentDate);
    var unsealedReport = yield that.getUnsealedReport(currentDate);
    var unsealedAddReport = yield that.getUnsealedAddReport(currentDate);

    var events = mergeReports(decideReport, unsealedReport, unsealedAddReport);
    return yield sendEvents.sendCommissions(that.eventName, events);
  });

  this.getDecideReport = co.wrap(function* (currentDate) {

    const url = that.client.url('decide', currentDate);
    debug("fetch %s", url);
    return yield that.client.get(url);
  });

  this.getUnsealedReport = co.wrap(function* (currentDate) {

    const url = that.client.url('unsealed', currentDate);
    debug("fetch %s", url);
    return yield that.client.get(url);
  });

  this.getUnsealedAddReport = co.wrap(function* (currentDate) {

    const url = that.client.url('unsealedadd', currentDate);
    debug("fetch %s", url);
    return yield that.client.get(url);
  });
};

function mergeReports(decideReport, unsealedReport, unsealedAddReport) {

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

function csvToJson(csv) {

  csv = csv.replace(/['"]+/g, '');
  const content = csv.split('\n');
  const header = content[0].split(',');
  return _.tail(content).map((row) => {
    return _.zipObject(header, row.split(','));
  });
}

function prepareCommission(state, o_obj) {

  // only if the obj exists and a valid order_id exist [eliminating headers]
  if(o_obj && _.get(o_obj, 'ORDER_ID')){

    const commission = {};

    commission.outclick_id = _.get(o_obj, 'POINT_ID1');
    commission.transaction_id = _.get(o_obj, 'ORDER_ID');
    commission.order_id = _.get(o_obj, 'ORDER_ID');
    commission.purchase_amount = Number(_.get(o_obj, '���V�Ώے������z'));
    commission.commission_amount = Number(_.get(o_obj, '�������V�z'));
    commission.currency = CURRENCY;
    commission.effective_date = new Date(_.get(o_obj, '������'));
    commission.state = STATUS_MAP[state];

    return commission;
  }
}

module.exports = A8GenericApi;
