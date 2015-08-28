"use strict";

const _ = require('lodash');
const co = require('co');
const debug = require('debug')('tradedoubler:processor');
const sendEvents = require('./support/send-events');
const singleRun = require('./support/single-run');

var client = require('./api-clients/tradedoubler')();

/**
 * Retrieve all merchant/program information from webgains including there commissions and coupons.
 * @returns {undefined}
 */
const getMerchants = singleRun(function*() {
  let results = yield client.getMerchants();

  let events = _.values(results.reduce(merchantReduce, {}));

  yield sendEvents.sendMerchants('tradedoubler', events);
});

const mFilter = ['siteName','affiliateId','programName','currentStatusExcel','programId','applicationDate','status'];
var merchantReduce = function(merchants, item) {
  let cleanedMerchant = _.omit(item, (val, key) => { return _.indexOf(mFilter, key)  === -1;});
  let cleanedItem = _.pick(item, (val, key) => { return _.indexOf(mFilter, key)  === -1;});

  if (merchants[item.programId] === undefined) {
    merchants[item.programId] = _.extend({}, {
      merchant: cleanedMerchant,
      events:[]
    });
  }

  merchants[item.programId].events.push(cleanedItem);

  return merchants;
};

/**
 * Filter out any merchant without a percentage commission structure.
 * (No fixed commissions supported yet)
 * @param {Object} o_merchants  The individual merchant object from AvantLink API response
 * @returns {Object}
 */
function hasPercentage(o_merchants) {
  return o_merchants.events.filter(e => Number(e.programTariffPercentage) > 0);
}

module.exports = {
  getMerchants: getMerchants
};
