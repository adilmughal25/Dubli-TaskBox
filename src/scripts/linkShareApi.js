"use strict";

const _ = require('lodash');
const request = require("request-promise");
const co = require('co');
const moment = require('moment');
const querystring = require('querystring');
const debug = require('debug')('linkshare:processor');
const sendEvents = require('./support/send-events');
const utils = require('ominto-utils');
const XmlEntities = require('html-entities').XmlEntities;
const entities = new XmlEntities();
const singleRun = require('./support/single-run');
const cutoffDate = require('./support/cutoff-date');

const linkShare = require('./api-clients/linkshare')();
const _check = utils.checkApiResponse;
const jsonify = require('./api-clients/jsonify-xml-body');
const limiter = utils.promiseRateLimiter;

const CUTOFF_KEY = 'linkshare';

var getMerchants = singleRun(function* (){
  var results = yield {
    merchants: doApiMerchants(),
    coupons: doApiCoupons(),
    textLinks: doApiTextLinks()
  };
  var merchants = mergeResults(results);
  return yield sendEvents.sendMerchants('linkshare', merchants);
});


var doApiMerchants = co.wrap(function*() {
  var url = "linklocator/1.0/getMerchByAppStatus/approved";
  var handleError = _check('merchant fetch error');
  var merchants = yield linkShare
    .apiCall('linklocator', url)
    .then(handleError)
    .then(jsonify)
    .then(decode())
    .then(scrub(/^ns1:/))
    .then(extract('getMerchByAppStatusResponse.return'));
  return merchants;
});

var doApiCoupons = co.wrap(function* () {
  var page = 1;
  var _url = page => "coupon/1.0?resultsperpage=500&pagenumber="+page;
  var handleError = _check('coupon fetch error');
  var url = _url(page);
  var results = [];
  var info, coupons, total;
  while (url) {
    info = yield linkShare
      .apiCall('coupons', url)
      .then(handleError)
      .then(jsonify)
      .then(decode())
      .then(extract('couponfeed'));
    // console.log("my info", info);
    total = info.TotalPages;
    coupons = info.link || [];
    results = results.concat(coupons || []);
    url = (page < total) ? _url(++page) : null;
  }
  return results;
});

var doApiTextLinks = co.wrap(function* () {
  var page = 1;
  var date = moment(Date.now() - 86400*3).format('MMDDYYYY');
  var _url = page => "linklocator/1.0/getTextLinks/-1/-1//"+date+"/-1/"+page;
  var handleError = _check('text link fetch error');
  var url = _url(page);
  var results = [];
  while (url) {
    var links = yield linkShare
      .apiCall('linklocator', url)
      .then(handleError)
      .then(jsonify)
      .then(decode())
      .then(scrub(/^ns1:/))
      .then(extract('getTextLinksResponse.return'));
    if (!links) links = [];

    results = results.concat(links);
    url = links.length < 10000 ? null : _url(++page);
  }
  return results;
});

var getCommissionDetails = singleRun(function*(){
  let page = 1;
  let commissions = [];
  const startTime = yield cutoffDate.get(CUTOFF_KEY);
  const endTime = new Date(Date.now() - (60 * 1000));
  while (true) {
    const client = yield linkShare.getFreshClient();
    const url = "/events/1.0/transactions?" + querystring.stringify({
      limit: 1000,
      page: page,
      process_date_start: startTime,
      process_date_end: endTime
    });
    const response = yield client.get(url).then(_check('commissions fetch error'));
    const commissionSet = response.body;
    commissions = commissions.concat(commissionSet);
    if (commissionSet.length < 1000) break;
    page += 1;
  }
  const events = commissions.map(prepareCommission).filter(x => !!x);
  yield sendEvents.sendCommissions('linkshare', commissions);
  yield cutoffDate.set(CUTOFF_KEY, endTime);
  linkShare.releaseClient();
});

function prepareCommission(o_obj) {
  const commission = {};
  const isEvent = o_obj.is_event === "Y";
  commission.outclick_id = o_obj.u1;
  commission.transaction_id = o_obj.etransaction_id;
  commission.purchase_amount = o_obj.sale_amount;
  commission.commission_amount = o_obj.commissions;
  commission.currency = o_obj.currency;
  commission.state = isEvent ? 'initiated' : 'confirmed';
  commission.effective_date = o_obj.process_date;
  return commission;
}

function sendMerchantsToEventHub(merchants) {
  debug("found %d merchants to process", merchants.length);
  return sendEvents.sendMerchants('linkshare', merchants);
}

function sendCommissionsToEventHub(commissions) {
  debug("found %d commisions to process", commissions.length);
  return sendEvents.sendCommissions('linkshare', commissions);
}

function decode() {
  function worker(item, count) {
    if (!count) count = 0;
    if (count > 5) return item;
    var d = entities.decode(item);
    if (d===item) return item;
    return worker(item, count + 1);
  }
  function _decode(item) {
    if (_.isArray(item)) return _.map(item, _decode);
    if (_.isObject(item)) return _.mapValues(item, _decode);
    if (_.isString(item)) return worker(item);
    return item;
  }
  return _decode;
}

function scrub(pattern) {
  if (!pattern) pattern = /^\w+:/;
  var worker = o_obj => _.mapKeys(o_obj, (v,k) => k.replace(pattern, ''));
  function _scrub(item) {
    if (_.isArray(item)) return _.map(item, _scrub);
    if (_.isObject(item)) return _.mapValues(worker(item), _scrub);
    return item;
  }
  return _scrub;
}

function extract(key) {
  return o_obj => _.get(o_obj, key);
}

function mergeResults(o_obj) {
  var res = {};
  var make = k => res[k] || (res[k] = {links:[], coupons:[]});
  var set = (i,k,v) => make(i)[k] = v;
  var add = (i,k,v) => make(i)[k].push(v);
  o_obj.merchants.forEach(m => set(m.mid, 'merchant', m));
  o_obj.textLinks.forEach(l => add(l.mid, 'links', l));
  o_obj.coupons.forEach(c => add(c.advertiserid, 'coupons', c));
  return _.values(res).filter(x => 'merchant' in x);
}

module.exports = {
  getCommissionDetails: getCommissionDetails,
  getMerchants: getMerchants
};
