"use strict";

/*
 * getCommissions() with SOAP client not 100% finished. Stopped during implementation, as we prefer to use the webhooks instead.
 * Remove obsolete code as soon thats final...
 */

const _ = require('lodash');
const co = require('co');
const debug = require('debug')('webgains:processor');
const utils = require('ominto-utils');
const sendEvents = require('./support/send-events');
const singleRun = require('./support/single-run');

const exists = x => !!x;

var client = require('./api-clients/webgains')();
var clientSoap = require('./api-clients/webgainsSoap')();
var XmlEntities = require('html-entities').XmlEntities;
var entities = new XmlEntities();

var merge = require('./support/easy-merge')('id', {
  links: 'programId',
  coupons: 'programId'
});

//combination of "status"+"paymentStatus"
const STATE_MAP = {
  confirmed_: 'initiated',
  confirmed_notcleared: 'initiated',
  confirmed_cleared: 'confirmed',
  confirmed_paid: 'paid',
  
  delayed_: 'initiated',
  delayed_notcleared: 'initiated',
  delayed_cleared: 'confirmed',
  delayed_paid: 'confirmed',
  
  cancelled_: 'cancelled',
  cancelled_cleared: 'cancelled',
  cancelled_notcleared: 'cancelled',
  cancelled_paid: 'cancelled',
};

/**
 * Retrieve all merchant/program information from webgains including there commissions and coupons.
 * @returns {undefined}
 */
const getMerchants = singleRun(function*() {
  let results = yield {
    merchants: client.getMerchants(),
    links: client.getTextLinks(),
    coupons: client.getCoupons()
  };

  let merged = merge(results);
  yield sendEvents.sendMerchants('webgains', merged);
});

/**
 * Retrieve all commission details (sales/transactions) from webgains within given period of time.
 * @returns {undefined}
 */
const getCommissionDetails = singleRun(function* () {
  yield clientSoap.setup(); // setup our soap client
  
  let results = [],
      transactions = [],
      startDate = new Date(Date.now() - (14 * 86400 * 1000)),
      endDate = new Date(Date.now() - (60 * 1000));

  results = yield doApi('getFullEarningsWithCurrency', {
      startdate: clientSoap.dateFormat(startDate),
      enddate: clientSoap.dateFormat(endDate),
      campaignid: clientSoap.authcfg.siteId,
      username: clientSoap.authcfg.user,
      password: clientSoap.authcfg.pass,
    }, 'return.item');

  transactions = results.map(prepareCommission).filter(exists);

  yield sendEvents.sendCommissions('webgains', transactions);
});

/**
 * Function to prepare a single commission transaction for our data event.
 * @param {Object} o_obj  The individual commission transaction straight from webgains
 * @returns {Object}
 */
function prepareCommission(o_obj) {
  let status = o_obj.status + '_' + o_obj.paymentStatus;
  let event = {
    affiliate_name: o_obj.programName,
    transaction_id: o_obj.transactionID,
    outclick_id: o_obj.clickRef,
    currency: o_obj.currency,
    purchase_amount: o_obj.saleValue,
    commission_amount: o_obj.commission,
    state: STATE_MAP[status],
    effective_date: 'auto'
  };
  return event;
}

var doApi = co.wrap(function* (method, args, key) {
  var results = yield clientSoap[method](args)
    .then(extractAry(key))
    .then(resp => rinse(resp))
  ;

  return results || [];
});

var ary = x => _.isArray(x) ? x : [x];
function extractAry(key) {
  return resp => ary(_.get(resp, key) || []);
}

// rinse: removes SOAP-y residue
function rinse(any) {
  if (_.isString(any)) return any;
  if (_.isArray(any)) return any.map(rinse);
  if (_.isObject(any)) {
    delete any.attributes;
    if (any.$value) {
      return any.$value;
    }
    return _.mapValues(any, rinse);
  }
  return any;
}


module.exports = {
  getMerchants: getMerchants,
  //getCommissionDetails: getCommissionDetails
};
