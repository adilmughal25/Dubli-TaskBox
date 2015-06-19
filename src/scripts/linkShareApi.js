"use strict";

var _ = require('lodash');
var request = require("request-promise");
var co = require('co');
var moment = require('moment');
var debug = require('debug')('linkshare:api');
var sendEvents = require('./send-events');
var utils = require('ominto-utils');
var XmlEntities = require('html-entities').XmlEntities;
var entities = new XmlEntities();

var linkShare = utils.remoteApis.linkShareClient();
var _check = utils.checkApiResponse;
var jsonify = utils.jsonifyXmlBody;
var limiter = utils.promiseRateLimiter;

var merchantsRunning = false;
function* getMerchants() {
  if (merchantsRunning) { throw "already-running"; }
  merchantsRunning = true;

  try {
    var results = yield {
      merchants: doApiMerchants(),
      coupons: doApiCoupons(),
      textLinks: doApiTextLinks()
    };
    var merchants = mergeResults(results);
    yield sendMerchantsToEventHub(merchants);
  } finally {
    merchantsRunning = false;
    linkShare.releaseClient();
  }
}


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

var commissionsRunning = false;
function* getCommissionDetails() {
  if (commissionsRunning) { throw "already-running"; }
  commissionsRunning = true;

  var currentPage = 1;
  var startTime = moment().subtract(1, 'days').startOf('day').toISOString().replace(/\..+$/, '-00:00');
  var endTime = moment().add(1, 'days').startOf('day').toISOString().replace(/\..+$/, '-00:00');

  var url;
  debug("commissions fetch started");
  try {
    var client = yield linkShare.getFreshClient();
    while (true) {
      url = "/events/1.0/transactions?limit=1000&page="+currentPage;
      debug('commisions fetch: %s', url);
      var response = yield client.get(url).then(_check('commissions fetch error'));
      var commissions = response.body;
      if (!commissions) { break; }
      yield sendCommissionsToEventHub(commissions || []);
      if (commissions.length < 1000) { break; }
      currentPage += 1;
    }
  } finally {
    commissionsRunning = false;
  }
  debug("commissions fetch complete");
  linkShare.releaseClient();
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
  return _.values(res);
}

module.exports = {
  getCommissionDetails: getCommissionDetails,
  getMerchants: getMerchants
};
