"use strict";

const _ = require('lodash');
const co = require('co');
const debug = require('debug')('tradedoubler:processor');
const sendEvents = require('../support/send-events');
const singleRun = require('../support/single-run');
const client = require('./api')();

/**
 * Retrieve all merchant/program information from tradedoubler including there commissions.
 * @returns {undefined}
 */
const getMerchants = singleRun(function*() {
  const results = yield client.getMerchants();
  const events = _.values(results.reduce(merchantReduce, {})).map(hasPercentage);

  return yield sendEvents.sendMerchants('tradedoubler', events);
});

// Elements to filter out from events and keep in merchant
const mFilter = ['siteName','affiliateId','programName','currentStatusExcel','programId','applicationDate','status'];

/**
 * Reduces our xml2js response from tradedoubler to the most necessary data.
 * @param {Object} merchants  The resulting filtered merchants object
 * @param {Object} item The individual object to iterate through
 * @returns {Object}
 */
var merchantReduce = function(merchants, item) {
  const cleanedMerchant = _.omit(item, (val, key) => { return _.indexOf(mFilter, key)  === -1;});
  const cleanedItem = _.pick(item, (val, key) => { return _.indexOf(mFilter, key)  === -1;});

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
 * Filter out any commissions without a percentage structure.
 * (No fixed commissions supported yet)
 * @param {Object} merchants  The individual merchant object
 * @returns {Object}  Filtered merchant
 */
function hasPercentage(merchant) {
  merchant.events = merchant.events.filter(e =>  Number(e.programTariffPercentage) > 0);
  return merchant;
}

module.exports = {
  getMerchants: getMerchants
};
