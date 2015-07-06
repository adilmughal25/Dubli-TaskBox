"use strict";

var _ = require('lodash');
var co = require('co');
var debug = require('debug')('tradetracker:api');
var utils = require('ominto-utils');
var sendEvents = require('./send-events');
var client = utils.remoteApis.tradetrackerClient();

var merge = require('./support/easy-merge')('ID', {
  links: 'campaign.ID',
  vouchers: 'campaign.ID',
  offers: 'campaign.ID'
});

const CAMPAIGN_ARGS = {
  affiliateSiteID: client.siteId,
  options: {assignmentStatus:'accepted'}
};

const MATERIAL_ARGS = {
  affiliateSiteID: client.siteId,
  materialOutputType: 'html'
};

var merchantsRunning = false;
function* getMerchants() {
  if (merchantsRunning) { throw 'already-running'; }
  merchantsRunning = true;

  try {
    yield client.setup(); // this gets soap info and does the auth login

    var results = yield {
      merchants: doApiMerchants(),
      links: doApi('getMaterialTextItems', MATERIAL_ARGS, 'materialItems.item'),
      offers: doApi('getMaterialIncentiveOfferItems', MATERIAL_ARGS, 'materialItems.item'),
      vouchers: doApi('getMaterialIncentiveVoucherItems', MATERIAL_ARGS, 'materialItems.item')
    };

    var merchants = merge(results);

    yield sendEvents.sendMerchants('tradetracker', merchants);
  } finally {
    merchantsRunning = false;
  }
}

var doApi = co.wrap(function* (method, args, key) {
  var results = yield client[method](args)
    // .then(h => {
    //   console.log(method, JSON.stringify(h, null, 2));
    //   return h;
    // })
    .then(extractAry(key))
    .then(resp => rinse(resp));

  return results || [];
});

function doApiMerchants() {
  return doApi('getCampaigns', CAMPAIGN_ARGS, 'campaigns.item').then(function(res) {
    return res.map(function(item) { // make the object a little cleaner
      _.extend(item, item.info);
      delete item.info;
      return item;
    });
  });
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

module.exports = {
  getMerchants: getMerchants
};
