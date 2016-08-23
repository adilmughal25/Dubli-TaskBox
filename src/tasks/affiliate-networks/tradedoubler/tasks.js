'use strict';

const _ = require('lodash');
const co = require('co');
const debug = require('debug')('tradedoubler:processor');
const sendEvents = require('../support/send-events');
const singleRun = require('../support/single-run');
const merge = require('../support/easy-merge')('programId', {
  coupons: 'programId'
});

/**
 * Retrieve a generic Tradedoubler API client by setting region and entity dynamically
 * @param s_region country code
 * @param s_entity customer name, default 'ominto'
 * @returns {TradedoublerGenericApi}
 * @constructor
 */
const TradedoublerGenericApi = function(s_region, s_entity) {
  if (!(this instanceof TradedoublerGenericApi)) {
    debug('instantiating TradedoublerGenericApi for: %s', s_entity);
    return new TradedoublerGenericApi(s_region, s_entity);
  }

  var that = this;

  this.region = s_region || 'global';
  this.entity = s_entity ? s_entity.toLowerCase() : 'ominto';
  this.client = require('./api')(this.region, this.entity);
  this.eventName = (this.entity !== 'ominto' ? this.entity + '-' : '') + 'tradedoubler' +
      (this.region !== 'global' ? '-' + this.region : '');

  /**
   * Retrieve all merchant + voucher information from tradedoubler. This does not include commissions
   * @returns {undefined}
   */
  this.getMerchants = singleRun(function * () {
    debug('running get merchants with %s', that.region);
    const results = yield {
      merchants: that.client.apiCall('merchants'),
      coupons: that.client.apiCall('coupons')
    };
    const merged = merge(results);
    return yield sendEvents.sendMerchants(that.eventName, merged);
  });

  /**
   * Retrieve all commissions / claims information from tradedoubler
   * @type {Function}
     */
  this.getCommissionDetails = singleRun(function* () {
    const response = yield that.client.apiCall('commissions');
    return yield sendEvents.sendCommissions(that.eventName, response);
  });

};

// Elements to filter out from events and keep in merchant
// const mFilter = ['siteName', 'affiliateId', 'programName', 'currentStatusExcel', 'programId', 'applicationDate', 'status', 'coupons'];


module.exports = TradedoublerGenericApi;
