"use strict";

const _ = require('lodash');
const co = require('co');
const debug = require('debug')('tradetracker:processor');
const utils = require('ominto-utils');
const sendEvents = require('./support/send-events');
const clientPool = require('./api-clients/tradetracker');
const XmlEntities = require('html-entities').XmlEntities;
const entities = new XmlEntities();
const singleRun = require('./support/single-run');
const taskCache = {};

const merge = require('./support/easy-merge')('ID', {
  links: 'campaign.ID',
  vouchers: 'campaign.ID',
  offers: 'campaign.ID'
});

const MATERIAL_ARGS = {materialOutputType: 'rss'};

function setup(s_region) {
  if (taskCache[s_region]) return taskCache[s_region];

  var tasks = {
    client: {},
  };

  tasks.getMerchants = singleRun(function*(){
    tasks.client = yield clientPool.getClient(s_region);

    var results = yield {
      merchants: tasks.doApiMerchants(),
      links: tasks.doApi('getMaterialTextItems', MATERIAL_ARGS, 'materialItems.item').then(extractUrl),
      offers: tasks.doApi('getMaterialIncentiveOfferItems', MATERIAL_ARGS, 'materialItems.item').then(extractUrl),
      vouchers: tasks.doApi('getMaterialIncentiveVoucherItems', MATERIAL_ARGS, 'materialItems.item').then(extractUrl)
    };

    var merchants = merge(results);

    yield sendEvents.sendMerchants('tradetracker-'+s_region, merchants);
  });

  // get commission report
/*
    task.getCommissionDetails = singleRun(function* () {
    this.client = yield clientPool.getClient(s_region);
    const startDate = new Date(Date.now() - (30 * 86400 * 1000));
    const endDate = new Date(Date.now() - (60 * 1000));

    debug("fetching all transactions between %s and %s", startDate, endDate);

    const results = yield client.GetSalesData();

    let transactions = _.get(results, 'Transactions', []);
    let errors = _.get(results, 'Errors', []);

    if (errors.Error && errors.Error.length > 0) {
      throw new Error(errors.Error[0].attributes.code + " - " + errors.Error[0].$value);
    }

    const events = transactions.map(prepareCommission.bind(null, s_region));

    yield sendEvents.sendCommissions('tradetracker-'+s_region, events);
  });
*/

  tasks.doApi = co.wrap(function* (method, args, key) {
    var results = yield tasks.client[method](args)
    .then(extractAry(key))
    .then(resp => rinse(resp));

    return results || [];
  });

  tasks.doApiMerchants = function() {
    return tasks.doApi('getCampaigns', {options: {assignmentStatus:'accepted'}}, 'campaigns.item')
      .then(function(res) {
      return res.map(function(item) { // make the object a little cleaner
        _.extend(item, item.info);
        delete item.info;
        return item;
      });
    });
  };

  taskCache[s_region] = tasks;

  return taskCache[s_region];
}

function extractUrl(a_items) {
  a_items.forEach(function(item) {
    var url = item.code.replace(/(\n|\t)+/g, ' ').replace(/^.*<link>(.+)<\/link>.*$/, '$1');
    item.url = entities.decode(url);
  });
  return a_items;
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

module.exports = setup;
