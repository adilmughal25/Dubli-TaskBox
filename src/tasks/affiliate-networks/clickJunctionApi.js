"use strict";

const _ = require('lodash');
const moment = require('moment');
const request = require("request-promise");
const wait = require('co-waiter');
const sendEvents = require('./support/send-events');
const singleRun = require('./support/single-run');
const utils = require('ominto-utils');
const co = require('co');
const querystring = require('querystring');
const cjClient = require('./api-clients/click-junction');
const jsonify = require('./api-clients/jsonify-xml-body');

const merge = require('./support/easy-merge')('advertiser-id', {
  links: 'advertiser-id'
});

const _debug = require('debug');
const debug = {
  usa: _debug('clickjunction:usa:processor'),
  euro: _debug('clickjunction:euro:processor')
};

const ary = item => _.isArray(item) ? item : [item];

const CURRENCY_MAP = {
  usa: 'USD',
  euro: 'Euro'
};

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

  var merchants = merge(results).map(extractTrackingLinks);

  sendMerchantsToEventHub(merchants||[], s_regionId);
  // used during testing to give me a file full of example data
  // require('fs').writeFileSync("output-all.json", JSON.stringify(merchants,null,2));
});

function extractTrackingLinks(s_info) {
  const merchant = s_info.merchant;
  const allLinks = s_info.links;
  const textLinks = allLinks.filter(x => x['link-type'] === 'Text Link');
  s_info.links = textLinks; // replace this now

  const pickUrl = url => {
    s_info.merchant.main_tracking_url = url;
    return s_info;
  };

  for (let i = 0; i < textLinks.length; i++) {
    let cur = textLinks[i];
    if (merchant['program-url'] === cur.destination) {
      return pickUrl(cur.clickUrl);
    }
  }

  // not found in text links, try again:
  for (let i = 0; i < allLinks.length; i++) {
    let cur = allLinks[i];
    if (merchant['program-url'] === cur.destination) {
      return pickUrl(cur.clickUrl);
    }
  }

  return s_info;
}

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

function extract(key) {
  return item => _.get(item, key);
}

var getCommissionDetails = co.wrap(function* getCommissionDetails(s_regionId) {
  const client = cjClient("commissions", s_regionId);
  const currency = CURRENCY_MAP[s_regionId];
  const periods = commissionPeriods(31, 3); // three 31-day periods
  let all = [];
  for (let i = 0; i < periods.length; i++) {
    const p = periods[i];
    const url = commissionsUrl(p.start, p.end);
    const result = yield client.get(url)
      .then(jsonify)
      .then(extract('cj-api.commissions'));
    if (result.commission) {
      all = all.concat(ary(result.commission));
    }
  }
  const prep = prepareCommission.bind(null, currency);
  const exists = x => !!x;
  const events = all.map(prep).filter(exists);

  return yield sendCommissionsToEventHub(events, s_regionId);
});

function prepareCommission(currency, item) {
  const event = {
    transaction_id: item['commission-id'],
    outclick_id: item.sid,
    currency: currency,
    purchase_amount: item['sale-amount'],
    commission_amount: item['commission-amount']
  };

  switch (item['action-status']) {
  case 'new':
  case 'extended':
    event.state = 'initiated';
    event.effective_date = new Date(item['posting-date']);
    break;
  case 'locked':
    event.state = 'confirmed';
    event.effective_date = new Date(item['locking-date']);
    break;
  case 'closed':
    event.state = 'paid';
    event.effective_date = new Date(item['locking-date']); // they don't give us a better paid date than this :(
    break;
  default:
    return; // skip this.
  }

  return event;
}

function commissionPeriods(i_days, i_count) {
  let current = moment().startOf('day');
  let vals = [];
  for (let i = 0; i < i_count; i++) {
    let now = current.format('YYYY-MM-DD');
    current = current.subtract(i_days, 'days');
    let then = current.format('YYYY-MM-DD');
    vals.push({start:then, end:now});
  }
  return vals;
}

function linksUrl(page, perPage, s_regionId) {
  const websiteId = s_regionId === 'usa' ? '7811975' : '7845446';
  const url = "/link-search?" + querystring.stringify({
    'website-id': websiteId,
    'advertiser-ids': 'joined',
    // 'link-type': 'text', // now scanning all links and filtering the list down to just text links, so this is disabled
    'records-per-page': perPage,
    'page-number': page
  });
  return url;
}

function advertiserUrl(page, perPage) {
  const url = "/advertiser-lookup?" + querystring.stringify({
    'advertiser-ids': 'joined',
    'records-per-page': perPage,
    'page-number': page
  });
  return url;
}

function commissionsUrl(start, end) {
  const url = "/commissions?" + querystring.stringify({
    'date-type': 'posting',
    'start-date': start,
    'end-date': end
  });
  return url;
}

var ct = 0;
function sendMerchantsToEventHub(merchants, s_regionId) {
  if (! merchants) { merchants = []; }
  debug[s_regionId]("found %d merchants to process", merchants.length);
  return sendEvents.sendMerchants('clickjunction-'+s_regionId, merchants);
}

function sendCommissionsToEventHub(commissions, s_regionId) {
  if (! commissions) { commissions = []; }
  debug[s_regionId]("found %d commisions to process", commissions.length);
  return sendEvents.sendCommissions('clickjunction-'+s_regionId, commissions);
}

module.exports = {
  getCommissionDetailsEuro: getCommissionDetailsEuro,
  getCommissionDetailsUSA: getCommissionDetailsUSA,
  getMerchantsEuro: getMerchantsEuro,
  getMerchantsUSA: getMerchantsUSA
};
