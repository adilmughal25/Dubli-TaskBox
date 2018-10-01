"use strict";

const _ = require('lodash');
const co = require('co');
const debug = require('debug')('publicideas:processor');
const utils = require('ominto-utils');
const moment = require('moment');
const sendEvents = require('../support/send-events');
const singleRun = require('../support/single-run');
const uuid = require('node-uuid'); // not used

const client = require('./api')();

// 0 confirmed
// if returned quantity is 1 then it is refunded

//@TODO: We're currently waiting on amazon.in -- Samantha is processing a purchase
// with a pending return so we can see what those look like in the data (because
// amazon has no documentation for this stuff)
//
// Once this is done and we can figure out those fields the process for this will be:
//   scan back in the "API" 75 days (perhaps only processing things that have been
//   marked 'modified' since the last time we ran -- this is tricky though because
//   the "api" is just an html table listing a bunch of .xml/.tgz files that can
//   be downloaded, with a created date and a modified date)
//
//   we get paid by amazon on a monthly schedule, and that payment should include
//   all purchases from a previous block of time based on their existence in these
//   files (this is documented in a secondary sheet in the ominto affiliate networks
//   spreadsheet)
const AFFILIATE_NAME = 'direct-partner';
const MERCHANT_NAME = 'amazon';

const AmazonIndiaGenericApi = function(s_entity) {
  if (!(this instanceof AmazonIndiaGenericApi)) return new AmazonIndiaGenericApi(s_entity);
  var that = this;

  this.entity = s_entity ? s_entity.toLowerCase() : 'ominto';
  this.eventName = (this.entity !== 'ominto' ? this.entity + '-' : '') + 'amazon-india';


  this.getCommissionDetails = co.wrap(function* () {
    const clientC = client(that.entity, that.region, 'commissions');
    const items = yield client.getCommissionReport('earnings');
    const events = items.map(prepareCommission.bind(this)).filter(x => !!x);

    return yield sendEvents.sendCommissions(that.eventName, events);

  });
}

// var getCommissionDetails = singleRun(function* () {
//   const items = yield client.getCommissionReport('earnings');
//   const events = items.map(prepareCommission.bind(this)).filter(x => !!x);
//   console.log(items);
// });

function prepareCommission(o_obj) {

  if (!o_obj) {
    this.logger({commissionData:o_obj}, "AMAZON.IN RESULT WITH NO SUBTAG. SKIPPING.");
    return null;
  }
  const event = {

    transaction_id: uuid.v4(),  //o_obj.SubTag, // so far amazon.in is the only company not to give us a transaction_id of any kind, whee
    affiliate_name: AFFILIATE_NAME,
    merchant_name: MERCHANT_NAME,
    merchant_id: '11551',
    outclick_id: o_obj.SubTag,
    commission_amount: o_obj.Earnings,
    purchase_amount: o_obj.Price,
    currency: 'INR', // amazon.in is INR only
    state: parseInt(o_obj.Qty) < 0 && parseInt(o_obj.Earnings) > -1 ? 'cancelled' : 'initiated', // the status is initiated as we are manually paying it off
    date: new Date(Number(o_obj.EDate) * 1000)
  };
  return event;
}

module.exports = AmazonIndiaGenericApi;
