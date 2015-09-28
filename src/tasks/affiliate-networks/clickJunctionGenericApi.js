"use strict";

/*
 * This is actually "Commission Junction"
 */

const _ = require('lodash');
const co = require('co');
const moment = require('moment');
const sendEvents = require('./support/send-events');
const singleRun = require('./support/single-run');
const querystring = require('querystring');
const jsonify = require('./api-clients/jsonify-xml-body');
const cjClient = require('./api-clients/click-junction');

const merge = require('./support/easy-merge')('advertiser-id', {
  links: 'advertiser-id'
});

const CURRENCY_MAP = {
  us: 'usd',
  eu: 'eur',

  de: 'eur',
  es: 'eur',
  gb: 'gbp',
  dk: 'eur',
  it: 'eur',
};

const ClickJunctionGenericApi = function(s_region, s_entity) {
  if (!s_region) throw new Error("ClickJunction Generic API needs region!");
  if (!(this instanceof ClickJunctionGenericApi)) return new ClickJunctionGenericApi(s_region, s_entity);

  var that = this;

  this.entity = s_entity ? s_entity.toLowerCase() : 'ominto';
  this.region = s_region;
  this.eventName = (this.entity !== 'ominto' ? this.entity + '-' : '') + 'clickjunction-' + s_region;

  const debug = require('debug')(this.eventName + ':processor');

  this.getMerchants = co.wrap(function* () {
    const clientM = cjClient(that.entity, that.region, 'advertisers');
    const clientL = cjClient(that.entity, that.region, 'links');
    const results = yield {
      merchants: clientM.getMerchants(),
      links: clientL.getLinks()
    };

    const merchants = merge(results).map(extractTrackingLinks);

    return yield sendEvents.sendMerchants(that.eventName, merchants);
  });

  this.getCommissionDetails = co.wrap(function* () {
    const clientC = cjClient(that.entity, that.region, 'commissions');
    const currency = CURRENCY_MAP[that.region];
    const periods = commissionPeriods(31, 3); // three 31-day periods
    let all = [];

    for (let i = 0; i < periods.length; i++) {
      const p = periods[i];
      let results = yield clientC.getCommission(p.start, p.end);
      all = all.concat(results);
    }

    const prep = prepareCommission.bind(null, currency);
    const exists = x => !!x;
    const events = all.map(prep).filter(exists);

    return yield sendEvents.sendCommissions(that.eventName, events);
  });
};

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

  // just give up now
  return pickUrl("");
}

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

module.exports = ClickJunctionGenericApi;
