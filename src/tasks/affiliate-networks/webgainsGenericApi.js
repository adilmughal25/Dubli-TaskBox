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
const XmlEntities = require('html-entities').XmlEntities;
const entities = new XmlEntities();

const merge = require('./support/easy-merge')('id', {
  links: 'programId',
  coupons: 'programId',
  deals: 'program.id',
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

const WebgainsGenericApi = function(s_entity) {
  if (!(this instanceof WebgainsGenericApi)) {
    debug("instantiating WebgainsGenericApi for: %s", s_entity);
    return new WebgainsGenericApi(s_entity);
  }

  var that = this;

  this.entity = s_entity ? s_entity.toLowerCase() : 'ominto';
  this.eventName = (this.entity !== 'ominto' ? this.entity + '-' : '') + 'webgains';

  /**
   * Retrieve all merchant/program information from webgains including there commissions and coupons.
   * @returns {undefined}
   */
  this.getMerchants = singleRun(function*() {
    that.client = require('./api-clients/webgains')(that.entity);
    let results = yield {
      merchants: that.client.getMerchants(),
      deals: that.client.getOffers(),
      links: that.client.getAds(),
      coupons: that.client.getCoupons()
    };

    let merged = merge(results).filter(approvedAffiliate);
    yield sendEvents.sendMerchants(that.eventName, merged);
  });

  /**
   * Retrieve all commission details (sales/transactions) from webgains within given period of time.
   * @returns {undefined}
   */
  this.getCommissionDetails = singleRun(function* () {
    that.clientSoap = require('./api-clients/webgainsSoap')(that.entity);
    yield that.clientSoap.setup(); // setup our soap client

    let results = [];
    let transactions = [];
    const startDate = new Date(Date.now() - (14 * 86400 * 1000));
    const endDate = new Date(Date.now() - (60 * 1000));

    results = yield that.doApi('getFullEarningsWithCurrency', {
      startdate: that.clientSoap.dateFormat(startDate),
      enddate: that.clientSoap.dateFormat(endDate),
      campaignid: that.clientSoap.cfg.siteId,
      username: that.clientSoap.cfg.user,
      password: that.clientSoap.cfg.pass,
    }, 'return.item');

    transactions = results.map(prepareCommission).filter(exists);

    yield sendEvents.sendCommissions(that.eventName, transactions);
  });

  this.doApi = co.wrap(function* (method, args, key) {
    let results = yield that.clientSoap[method](args)
      .then(extractAry(key))
      .then(resp => rinse(resp))
    ;

    return results || [];
  });
};

/**
 * Filter out merchants we are not yet approved for.
 */
function approvedAffiliate(item) {
  var status = Number(item.merchant.affiliateApprovalStatus);
  if (status === 1) return true;
  if (status === 2) return true;
  return false;
}

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


module.exports = WebgainsGenericApi;
