"use strict";

/*
 * This is actually "Commission Junction"
 */

const _ = require('lodash');
const co = require('co');
const moment = require('moment');
const sendEvents = require('../support/send-events');
const singleRun = require('../support/single-run');
const querystring = require('querystring');
const jsonify = require('../support/jsonify-xml-body');
const cjClient = require('./api');
const url = require('url');

//const utils = require('ominto-utils');
const configs = require('../../../../configs.json');
//const utilsDataClient = utils.restClient(configs.data_api);

const transactions = require('../support/transactions');

const AFFILIATE_NAME = 'commissionjunction';

const merge = require('../support/easy-merge')('advertiser-id', {
  links: 'advertiser-id'
});

const CURRENCY_MAP = {
  us: 'usd',
  eu: 'eur',
  de: 'eur',
  es: 'eur',
  uk: 'gbp',
  dk: 'eur',
  it: 'eur',
};

const CommissionJunctionGenericApi = function(s_region, s_entity) {
  if (!s_region) throw new Error("CommissionJunction Generic API needs region!");
  if (!(this instanceof CommissionJunctionGenericApi)) return new CommissionJunctionGenericApi(s_region, s_entity);

  var that = this;

  this.entity = s_entity ? s_entity.toLowerCase() : 'ominto';
  this.region = s_region;

  this.eventName = (this.entity !== 'ominto' ? this.entity + '-' : '') + 'commissionjunction-' + s_region;

  const debug = require('debug')(this.eventName + ':processor');


  this.getMerchants = co.wrap(function* () {
    const clientM = cjClient(that.entity, that.region, 'advertisers');
    const clientL = cjClient(that.entity, that.region, 'links');

    const apiConfig = clientM.getConfig();
    const results = yield {
      merchants: clientM.getMerchants(),
      links: clientL.getLinks()
    };

    const merchants = merge(results).map(extractTrackingLinks.bind(null, that.region, apiConfig));

    return yield sendEvents.sendMerchants(that.eventName, merchants);
  });

  this.getCommissionDetails = co.wrap(function* () {
    const clientC = cjClient(that.entity, that.region, 'commissions');
    const currency = CURRENCY_MAP[that.region];
    const periods = commissionPeriods(31, 3); // three 31-day periods
    let all = [];

    let allCommissions = [];

    //let taskDate = yield utilsDataClient.get('/getTaskDateByAffiliate/' + AFFILIATE_NAME + '-' + that.region, true, this);

    let isCheckUpdates = false;

    if (taskDate.body && taskDate.body !== "Not Found") {
      allCommissions = yield that.getCommissionsByDate(taskDate.body.start_date, taskDate.body.end_date);
      //yield utilsDataClient.patch('/inactivateTask/' + AFFILIATE_NAME + '-' + that.region, true, this);

      isCheckUpdates = true;
    }

    for (let i = 0; i < periods.length; i++) {
      const p = periods[i];
      let results = yield clientC.getCommission(p.start, p.end);
      all = all.concat(results);
    }
    allCommissions = allCommissions.concat(all);
    allCommissions = allCommissions.filter(commission => commission['website-id'] !== '100430624');
    const prep = prepareCommission.bind(null, currency);
    const exists = x => !!x;
    let events = allCommissions.map(prep).filter(exists);

    if(isCheckUpdates)
      events = yield transactions.removeAlreadyUpdatedCommissions(events, AFFILIATE_NAME + '-' + that.region);

    return yield sendEvents.sendCommissions(that.eventName, events);
  });

  this.getCommissionsByDate = co.wrap(function* (startDate, endDate) {
    const clientC = cjClient(that.entity, that.region, 'commissions');
    let allCommissions = [];
    try {
      const periods = getExtraCommissionPeriods(startDate, endDate);

      for (let i = 0; i < periods.length; i++) {
        const p = periods[i];

        debug('start date --> ' + p.start);
        debug('end date --> ' + p.end);

        let results = yield clientC.getCommission(p.start, p.end);
        allCommissions = allCommissions.concat(results);
      }

      debug('finish');
    } catch (e) {
      console.log(e);
    }
    return allCommissions;
  });
};

function prepareMerchant(merchant) {
  if(!merchant) return;

  return {
    "advertiser-id" : merchant.affiliate_id,
    "account-status": "Active",
    "advertiser-name": merchant.name,
    "program-url": merchant.display_url,
    "primary-category": {},
    "actions": {"action": []},
    "main_tracking_url": merchant.affiliate_tracking_url
  }
}

const endsWithUrl = /url$/i;
const startsWithHttp = /^http/;

function extractEmbeddedUrl(s_url) {
  if (!/url=/i.test(s_url)) return;
  const parsed = url.parse(s_url);
  if (!parsed.query) return;
  const query = querystring.parse(parsed.query);
  const picked = Object.keys(query).filter(key => endsWithUrl.test(key) && startsWithHttp.test(query[key]))[0];
  return picked ? query[picked] : null;
}

function extractTrackingLinks(region, apiConfig, s_info) {
  const merchant = s_info.merchant;
  const allLinks = s_info.links;
  const textLinks = allLinks.filter(x => x['link-type'] === 'Text Link');
  s_info.links = textLinks; // replace this now

  const pickUrl = _url => {
    s_info.merchant.main_tracking_url = _url;
    return s_info;
  };

  for (let i = 0; i < textLinks.length; i++) {
    let cur = textLinks[i];
    if (merchant['program-url'] === cur.destination) {
      return pickUrl(cur.clickUrl);
    }
    let _url = extractEmbeddedUrl(cur.destination);
    if (_url && merchant['program-url'] === _url) {
      return pickUrl(cur.clickUrl);
    }
  }

  // not found in text links, try again:
  for (let i = 0; i < allLinks.length; i++) {
    let cur = allLinks[i];
    if (merchant['program-url'] === cur.destination) {
      return pickUrl(cur.clickUrl);
    }
    let _url = extractEmbeddedUrl(cur.destination);
    if (_url && merchant['program-url'] === _url) {
      return pickUrl(cur.clickUrl);
    }
  }

  // if still nothing, try the first textLink that has a tracking url
  for (let i = 0; i < textLinks.length; i++) {
    let cur = textLinks[i];
    if (cur.clickUrl) return pickUrl(cur.clickUrl);
  }

  // fine just take any link
  for (let i = 0; i < allLinks.length; i++) {
    let cur = allLinks[i];
    if (cur.clickUrl) return pickUrl(cur.clickUrl);
  }

  // create deep link generator before giving up
  if (merchant['program-url']) {
    // Cj is generating different id for different accounts. We have 2 accounts currently.
    // In case we will have a third account which is very unlikely then update the condition accordingly
    const linkId = apiConfig.siteId;
    return pickUrl('www.anrdoezrs.net/links/'+linkId+'/type/dlg/' + merchant['program-url']);
  }

  // just give up now
  return pickUrl("");
}

function prepareCommission(currency, item) {
  const event = {
    affiliate_name: AFFILIATE_NAME,
    merchant_name: item['advertiser-name'] || '',
    merchant_id: item.cid || '',
    transaction_id: item['commission-id'],
    order_id: item['order-id'],
    outclick_id: item.sid,
    currency: currency,
    purchase_amount: item['sale-amount'],
    commission_amount: item['commission-amount'],
    cashback_id: item['action-tracker-id'] || ''
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
      event.effective_date = new Date(); // they don't give us a better paid date than this :(
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

function getExtraCommissionPeriods(startDate, endDate) {
  let startMonth = moment().diff(moment(startDate), "months");
  let endMonth = moment().diff(moment(endDate), "months");
  let vals = [];
  const noOfMonths = startMonth - endMonth;

  for (let i = 0; i < noOfMonths; i++) {
    let from = moment(startDate).add(i, 'M').format('YYYY-MM-DD');
    let to = moment(startDate).add(i + 1, 'M').format('YYYY-MM-DD');
    vals.push({start: from, end: to});
  }

  return vals;
}

module.exports = CommissionJunctionGenericApi;
