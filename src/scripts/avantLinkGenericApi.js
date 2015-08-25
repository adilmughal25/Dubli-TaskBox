"use strict";

const _ = require('lodash');
const co = require('co');
const debug = require('debug')('avantlink:processor');
const utils = require('ominto-utils');
const sendEvents = require('./support/send-events');
const singleRun = require('./support/single-run');
const clientPool = require('./api-clients/avantlink');

const merge = require('./support/easy-merge')('lngMerchantId', {
  promos: 'Merchant_Id' // includes all type of promotions such as text, coupons, ...
});

const taskCache = {};

function setup(s_region) {
  if (taskCache[s_region]) return taskCache[s_region];

  var tasks = {};

  // get all merchant information
  tasks.getMerchants = singleRun(function* () {
    let clientM = clientPool.getClient(s_region, 'merchants'),
        clientP = clientPool.getClient(s_region, 'promos');

    let results = yield {
      merchants: clientM.getData().then(hasPercentage),
      promos: clientP.getData().then(preparePromos)
    };
    let merchants = merge(results);

    yield sendEvents.sendMerchants('avantlink-'+s_region, merchants);
  });

  taskCache[s_region] = tasks;

  return tasks;
}

/**
 * Filter out any merchant without a percentage commission structure.
 * (No fixed commissions supported yet)
 * @param {Object} o_merchants  The individual merchant object from AvantLink API response
 * @returns {Object}
 */
function hasPercentage(o_merchants) {
  return o_merchants.filter(m => m.strActionCommissionType === 'percent');
}

/**
 * Little filter for to many Promos - excludes defined promot types from api response.
 * Note: its either get all and filter here or fetch individually from api type by type and then merge.
 *
 * @param {Object} o_promo  The individual promotion/ad object from AvantLink AdSearch API response
 * @returns {Object}
 */
const promoTypesFilter = ['video', 'image', 'flash', 'html', 'dotd-html']; // type to be removed/ignored
function preparePromos(o_promo) {
  return o_promo.filter(p => _.indexOf(promoTypesFilter, p.Ad_Type)  === -1);
}

module.exports = setup;
