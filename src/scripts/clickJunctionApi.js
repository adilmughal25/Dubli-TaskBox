"use strict";

var _ = require('lodash');
var moment = require('moment');
var request = require("request-promise");
var wait = require('co-waiter');
var sendEvents = require('./support/send-events');
var singleRun = require('./support/single-run');
var utils = require('ominto-utils');
var co = require('co');
var cjClient = require('./api-clients').clickJunctionClient;
var jsonify = require('./api-clients/jsonify-xml-body');

var merge = require('./support/easy-merge')('advertiser-id', {
  links: 'advertiser-id'
});

var _debug = require('debug');
var debug = {
  usa: _debug('clickjunction:usa:processor'),
  euro: _debug('clickjunction:euro:processor')
};

var merchantsRunningUSA = false;
var getMerchantsUSA = singleRun(function*(){
  return yield getMerchants('usa');
});

var getMerchantsEuro = singleRun(function*(){
  return yield getMerchants('euro');
});

var getMerchants = co.wrap(function* getMerchants(s_regionId) {
  var results = yield {
    merchants: doApiMerchants(s_regionId),
    links: doApiLinks(s_regionId)
  };

  var merchants = merge(results);

  sendMerchantsToEventHub(merchants||[], s_regionId);
  // used during testing to give me a file full of example data
  // require('fs').writeFileSync("output-all.json", JSON.stringify(merchants,null,2));
});

var doApiLinks = co.wrap(function* (s_regionId) {
  var client = cjClient("links", s_regionId);
  var perPage = 100;
  var page = 1;
  var url = linksUrl(page, perPage, s_regionId);
  var links = [];

  debug[s_regionId]("links fetch started");
  while (url) {
    debug[s_regionId]("links fetch: %s", url);
    var ret = yield client.get(url).then(jsonify);
    var info = _.get(ret, 'cj-api.links'); // ret['cj-api'].advertisers;
    var meta = info.$;
    links = links.concat(info.link || []);
    url = (meta['total-matched'] >= perPage * meta['page-number']) ?
      linksUrl(++page, perPage, s_regionId) : null;
  }
  debug[s_regionId]("links fetch complete");
  return links;
});

var doApiMerchants = co.wrap(function* (s_regionId) {
  var client = cjClient("advertisers", s_regionId);
  var perPage = 100;
  var page = 1;
  var url = advertiserUrl(page, perPage);
  var merchants = [];

  debug[s_regionId]("merchants fetch started");
  while (url) {
    debug[s_regionId]("merchants fetch: %s", url);
    var ret = yield client.get(url).then(jsonify);
    var info = _.get(ret, 'cj-api.advertisers'); // ret['cj-api'].advertisers;
    var meta = info.$;
    merchants = merchants.concat(info.advertiser || []);
    url = (meta['total-matched'] >= perPage * meta['page-number']) ?
      advertiserUrl(++page, perPage) : null;
  }
  debug[s_regionId]("merchants fetch complete");
  return merchants;
});

var getCommissionDetailsUSA = singleRun(function*(){
  return yield getCommissionDetails('usa');
});

var getCommissionDetailsEuro = singleRun(function*(){
  return yield getCommissionDetails('euro');
});

var getCommissionDetails = co.wrap(function* getCommissionDetails(s_regionId) {
  var startTime = moment().subtract(1, 'days').startOf('day').format('YYYY-MM-DD');
  var endTime = moment().add(1, 'days').startOf('day').format('YYYY-MM-DD');

  var client = cjClient("commissions", s_regionId);
  var url = commissionsUrl(startTime, endTime);

  // according to http://cjsupport.custhelp.com/app/answers/detail/a_id/1553,
  // this one doesn't seem to paginate, so we apparently don't need a fancy
  // async while loop here
  debug[s_regionId]("commissions fetch: %s", url);
  var ret = yield client.get(url).then(jsonify);
  var info = ret['cj-api'].commissions;
  var commissions = info.commission;

  if(commissions) {
    yield sendCommissionsToEventHub(commissions, s_regionId);
  }
  debug[s_regionId]("commissions fetch complete");
});

function linksUrl(page, perPage, s_regionId) {
  var websiteId = s_regionId === 'usa' ? '7811975' : '7845446';
  return "/link-search?website-id="+websiteId+"&advertiser-ids=joined" +
         "&link-type=Text Link&records-per-page=" + perPage +
         "&page-number="+page;
}

function advertiserUrl(page, perPage) {
  return "/advertiser-lookup?advertiser-ids=joined&records-per-page="+perPage+"&page-number="+page;
}

function commissionsUrl(start, end) {
  return "/commissions?date-type=posting&start-date="+start+"&end-date="+end;
}

var ct = 0;
function sendMerchantsToEventHub(merchants, s_regionId) {
  if (! merchants) { merchants = []; }
  debug[s_regionId]("found %d merchants to process", merchants.length);
  return sendEvents.sendMerchants('clickjunction', merchants);
}

function sendCommissionsToEventHub(commissions, s_regionId) {
  if (! commissions) { commissions = []; }
  debug[s_regionId]("found %d commisions to process", commissions.length);
  return sendEvents.sendCommissions('clickjunction', commissions);
}

module.exports = {
  getCommissionDetailsEuro: getCommissionDetailsEuro,
  getCommissionDetailsUSA: getCommissionDetailsUSA,
  getMerchantsEuro: getMerchantsEuro,
  getMerchantsUSA: getMerchantsUSA
};
