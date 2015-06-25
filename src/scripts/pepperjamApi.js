"use strict";

var _ = require('lodash');
var co = require('co');
var debug = require('debug')('pepperjam:api');
var utils = require('ominto-utils');
var sendEvents = require('./send-events');

var client = utils.remoteApis.pepperjamClient();

var merchantsRunning = false;
function* getMerchants() {
  if (merchantsRunning) { throw 'already-running'; }
  merchantsRunning = true;

  var results = yield {
    merchants: client.getPaginated('/publisher/advertiser', {status:'joined'}),
    coupons: client.getPaginated('/publisher/creative/coupon'),
    links: client.getPaginated('/publisher/creative/text'),
    generic: client.getPaginated('/publisher/creative/generic')
  };

  var merchants = merge(results);

  yield sendMerchantsToEventHub(merchants);

  merchantsRunning = false;
}




function merge(o_obj) {
  var results = {};

  var _push = function push(key, idField) {
    return function(item) {
      var id = _.get(item, idField);
      if (!results[id]) return;
      results[id][key].push(item);
    };
  };

  o_obj.merchants.forEach(function(merchant) {
    var id = merchant.id;
    results[id] = {
      merchant: merchant,
      coupons: [],
      links: [],
      generic: []
    };
  });
  delete o_obj.merchants;


  o_obj.coupons.forEach(_push('coupons', 'program_id'));
  delete o_obj.coupons;

  o_obj.links.forEach(_push('links', 'program_id'));
  delete o_obj.links;

  o_obj.generic.forEach(_push('generic', 'program_id'));
  delete o_obj.generic;

  return _.values(results);
}

var _fields = 'coupons links generic'.split(' ');

function bare(merchant) {
  var r = {merchant:merchant};
  _fields.forEach(x => r[x] = []);
  return r;
}

function merge(o_obj) {
  var results = {};
  var push = type => function(item) {
    if (results[item.program_id]) {
      results[item.program_id][type].push(item);
    }
  };
  o_obj.merchants.forEach(x => results[x.id] = bare(x));
  delete o_obj.merchants;

  _fields.forEach(function (field) {
    o_obj[field].forEach(push(field));
    delete o_obj[field];
  });

  return _.values(results);
}

function sendMerchantsToEventHub(merchants) {
  if (! merchants) { merchants = []; }
  debug("found %d merchants to process", merchants.length);
  return sendEvents.sendMerchants('pepperjam', merchants);
}


module.exports = {
  getMerchants: getMerchants
};
