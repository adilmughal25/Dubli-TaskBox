"use strict";

const _ = require('lodash');
const co = require('co');
const debug = require('debug')('tradetracker:processor');
const utils = require('ominto-utils');
const sendEvents = require('../support/send-events');
const clientPool = require('./api');
const XmlEntities = require('html-entities').XmlEntities;
const entities = new XmlEntities();
const singleRun = require('../support/single-run');
const taskCache = {};

const merge = require('../support/easy-merge')('ID', {
  links: 'campaign.ID',
  vouchers: 'campaign.ID',
  offers: 'campaign.ID'
});
const exists = x => !!x;
const dateFormat = d => d.toISOString().replace(/\..+$/, '-00:00');

const MATERIAL_ARGS = {materialOutputType: 'rss'};
const CONVERSIONTRANS_ARGS = {options:{
  //ID: '',
  //transactionType: '',    // click,lead,sale
  //transactionStatus: '',  // pending,accepted,rejected
  registrationDateFrom: '',
  registrationDateTo: '',
  //assessmentDateFrom: '',
  //assessmentDateTo: '',
  //reference: '',
  //limit: '',
  //offset: '',
  //sort: '',
  //sortDirection: ''
}};
const STATE_MAP = {
  'pending':    'initiated',
  'accepted':   'confirmed',
  'rejected':   'cancelled',

  'paid': 'completed' // when "paidOut=true"
};

const TradeTrackerGenericApi = function(s_region, s_entity) {
  if (!(this instanceof TradeTrackerGenericApi)) {
    debug("instantiating TradeTrackerGenericApi for: %s-%s", s_entity, s_region);
    return new TradeTrackerGenericApi(s_region, s_entity);
  }

  var that = this;

  this.entity = s_entity ? s_entity.toLowerCase() : 'ominto';
  this.region = s_region;
  this.eventName = (this.entity !== 'ominto' ? this.entity + '-' : '') + 'tradetracker-' + this.region;

  if (taskCache[this.eventName]) return taskCache[this.eventName];

  var tasks = {
    client: {},
    entity: this.entity,
    region: this.region,
    eventName: this.eventName
  };

  const getMerchantsOps = function*(){
    tasks.client = yield clientPool.getClient(tasks.entity, tasks.region);

    var results = yield {
      merchants: tasks.doApiMerchants(),
      links: tasks.doApi('getMaterialTextItems', MATERIAL_ARGS, 'materialItems.item').then(extractUrl),
      offers: tasks.doApi('getMaterialIncentiveOfferItems', MATERIAL_ARGS, 'materialItems.item').then(extractUrl),
      vouchers: tasks.doApi('getMaterialIncentiveVoucherItems', MATERIAL_ARGS, 'materialItems.item').then(extractUrl)
    };

    const merchants =  merge(results);
    return sendEvents.sendMerchants(tasks.eventName, merchants);
  }

  tasks.getMerchants = singleRun(function*(){
    try{
      return yield getMerchantsOps();
    } catch(e) {
      const errorBody = _.get(e, ['body'], '');
      if(errorBody.indexOf('Not yet authenticated') != -1) {
        clientPool.activeClients[tasks.entity + '-' + tasks.region] = undefined;
        return yield getMerchantsOps();
      }
      throw e;
    }
  });

  // get commission report
  tasks.getCommissionDetailsOps = function* () {
    tasks.client = yield clientPool
      .getClient(tasks.entity, tasks.region);
    const startDate = new Date(Date.now() - (90 * 86400 * 1000));
    const endDate = new Date(Date.now() - (60 * 1000));
    let args = _.merge(CONVERSIONTRANS_ARGS, {options:{
      registrationDateFrom: dateFormat(startDate),
      registrationDateTo: dateFormat(endDate),
    }});

    debug("fetching all transactions between %s and %s", startDate, endDate);

    let transactions = yield tasks.pagedApiCall('getConversionTransactions', 'conversionTransactions.item', args);
    const events = transactions.map(prepareCommission).filter(exists);

    return yield sendEvents.sendCommissions(tasks.eventName, events);
  }

  tasks.getCommissionDetails = singleRun(function* () {
    try{
      return yield getCommissionDetailsOps();
    } catch(e) {
      const errorBody = _.get(e, ['body'], '');
      if(errorBody.indexOf('Not yet authenticated') != -1) {
        clientPool.activeClients[tasks.entity + '-' + tasks.region] = undefined;
        return yield getCommissionDetailsOps();
      }
      throw e;
    }
  });

  /**
   * Perform paginated api requests to any specified method of api client.
   * @param {String} method - The method of the api to call
   * @param {String} bodyKey - Attribute name/path in response body object to deep select as results
   * @param {Object} params - The params to pass onto the api method
   * @returns {Array}
   */
  tasks.pagedApiCall = co.wrap(function* (method, bodyKey, params) {
    let results = [];
    let limit = 250;
    let offset = 0;
    let total = 0;
    let start = Date.now();

    // check that we call a method which actually is provided by the api client
    if (typeof tasks.client[method] !== 'function') {
      throw new Error("Method " + method + " is not available by our api client.");
    }

    // perform api calls with pagination until we reach total items to fetch
    while(true) {
      let arg = _.merge({}, params, {options:{offset:offset, limit:limit}});

      debug("%s : fetch %d items with offset %d (%s)", method, limit, offset, JSON.stringify({args:arg}));

      // perform actual api call
      let items = yield tasks.client[method](arg)
      .then(extractAry(bodyKey))
<<<<<<< HEAD
      .then(resp => rinse(resp));

=======
      .then(resp => rinse(resp))
      .catch((e) => {
        e.stack = e.body + ' (' +e.stack + ')'
        throw e;
      });
>>>>>>> ed2e4e4... Fixing tradetracker commissions
      results = results.concat(items);

      // response doesnt provide any totals, so we have to request until 0 items returned
      if (items.length > 0) {
        offset += limit;
      } else {
        break;
      }
    }

    let end = Date.now();
    debug("%s finished: %d items over %d requests (%dms)", method, results.length, Math.ceil(offset/limit), end-start);

    return results;
  });

  tasks.doApi = co.wrap(function* (method, args, key) {
    var results = yield tasks.client[method](args)
    .then(extractAry(key))
    .then(resp => rinse(resp))
    .catch((e) => {
      e.stack = e.body + ' (' +e.stack + ')'
      throw e;
    });

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

  taskCache[this.eventName] = tasks;
  return taskCache[this.eventName];
};

/**
 * Function to prepare a single commission transaction for our data event.
 * @param {Object} o_obj  The individual commission transaction
 * @returns {Object}
 */
function prepareCommission(o_obj) {
  let status = (o_obj.paidOut === true) ? 'paid' : o_obj.transactionStatus;
  let date = o_obj.assessmentDate || o_obj.registrationDate;

  var event = {
    affiliate_name: o_obj.campaign.name,
    transaction_id: o_obj.ID,
    order_id: o_obj.ID,
    outclick_id: o_obj.reference,
    currency: o_obj.currency.toLowerCase(),
    purchase_amount: o_obj.orderAmount,
    commission_amount: o_obj.commission,
    state: STATE_MAP[status],
    effective_date: date
  };

  return event;
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

module.exports = TradeTrackerGenericApi;
