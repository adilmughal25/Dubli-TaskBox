"use strict";

const _ = require('lodash');
const request = require("request-promise");
const co = require('co');
const moment = require('moment');
const querystring = require('querystring');
const sendEvents = require('../support/send-events');
const utils = require('ominto-utils');
const XmlEntities = require('html-entities').XmlEntities;
const entities = new XmlEntities();
const singleRun = require('../support/single-run');
const _check = utils.checkApiResponse;
const jsonify = require('../support/jsonify-xml-body');
const debug = require('debug')('linkshare:processor');
const converter = require("csvtojson").Converter;

const reportingURL = 'https://ran-reporting.rakutenmarketing.com/en/reports/individual-item-report-api-final/filters?';
const reportingToken = 'ZW5jcnlwdGVkYToyOntzOjU6IlRva2VuIjtzOjY0OiI2ODI4NTljZGIxYWU2ZjllZWQ1NDFhYjhlNjY1YTM2ODI4YTM3NmIxMjFmMWI1MTI4Y2Q2YzJhMjBkMTMzMjgzIjtzOjg6IlVzZXJUeXBlIjtzOjk6IlB1Ymxpc2hlciI7fQ%3D%3D';

const LinkShareGenericApi = function(s_region, s_entity) {
  if (!(this instanceof LinkShareGenericApi)) {
    debug("instantiating LinkShareGenericApi for: %s", s_entity);
    return new LinkShareGenericApi(s_region, s_entity);
  }

  var that = this;

  this.region = s_region || 'global';
  this.entity = s_entity ? s_entity.toLowerCase() : 'ominto';
  this.client = require('./api')(this.entity, this.region);
  this.eventName = (this.entity !== 'ominto' ? this.entity + '-' : '') + 'linkshare' + (this.region !== 'global' ? '-' + this.region : '');

  this.getMerchants = singleRun(function* (){
    var results = yield {
      merchants: that.doApiMerchants(),
      coupons: that.doApiCoupons(),
      textLinks: that.doApiTextLinks()
    };

    var merchants = mergeResults(results);

    that.client.cleanup();
    return yield sendEvents.sendMerchants(that.eventName, merchants);
  });

  this.doApiMerchants = co.wrap(function*() {
    var url = 'linklocator/1.0/getMerchByAppStatus/approved';
    var handleError = _check('merchant fetch error');
    var merchants = yield that.client
      .apiCall('linklocator', url)
      .then(handleError)
      .then(jsonify)
      .then(decode())
      .then(scrub(/^ns1:/))
      .then(extract('getMerchByAppStatusResponse.return'));

    return merchants;
  });

  this.doApiCoupons = co.wrap(function* () {
    var page = 1;
    var _url = page => 'coupon/1.0?resultsperpage=500&pagenumber=' + page;
    var handleError = _check('coupon fetch error');
    var url = _url(page);
    var results = [];
    var info, coupons, total;

    while (url) {
      info = yield that.client
        .apiCall('coupons', url)
        .then(handleError)
        .then(jsonify)
        .then(decode())
        .then(extract('couponfeed'));

      total = info.TotalPages;
      coupons = info.link || [];
      results = results.concat(coupons || []);
      url = (page < total) ? _url(++page) : null;
    }

    return results;
  });

  this.doApiTextLinks = co.wrap(function* () {
    var page = 1;
    var date = moment(Date.now() - 86400*3).format('MMDDYYYY');
    var _url = page => 'linklocator/1.0/getTextLinks/-1/-1//' + date + '/-1/' + page;
    var handleError = _check('text link fetch error');
    var url = _url(page);
    var results = [];

    while (url) {
      var links = yield that.client
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

  // old commission processing code
  this._getCommissionDetails = singleRun(function*(){
    let page = 1;
    let commissions = [];
    const startTime = moment().subtract(90, 'days').toDate();
    const endTime = new Date(Date.now() - (60 * 1000));

    while (true) {
      const client = yield that.client.getFreshClient();
      const url = '/events/1.0/transactions?' + querystring.stringify({
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
    that.client.cleanup();
    yield sendEvents.sendCommissions(that.eventName, events);
  });

  // https://ran-reporting.rakutenmarketing.com/en/reports/signature-orders-report/filters?
  //start_date=2016-11-01&end_date=2016-11-15&include_summary=Y&network=1&tz=GMT&date_type=transaction
  //&token=ZW5jcnlwdGVkYToyOntzOjU6IlRva2VuIjtzOjY0OiI2ODI4NTljZGIxYWU2ZjllZWQ1NDFhYjhlNjY1YTM2ODI4YTM3NmIxMjFmMWI1MTI4Y2Q2YzJhMjBkMTMzMjgzIjtzOjg6IlVzZXJUeXBlIjtzOjk6IlB1Ymxpc2hlciI7fQ%3D%3D
  this.getCommissionDetails = singleRun(function*(){

    const startDate = moment().subtract(270, 'days').format('YYYY-MM-DD');
    const endDate = moment().format('YYYY-MM-DD');

    var dataClient = request.defaults({});

    const url = reportingURL + querystring.stringify({
      start_date: startDate,
      end_date: endDate,
      include_summary: 'N',
      // network: 1, // dont do a network specific call
      tz: 'GMT',
      date_type: 'process', //using process instead of transaction as these transactions are confirmed onces
      token: reportingToken
    });

    let response = yield dataClient.get(url);

    // if summary is included in the response then clean it and proceed with only essential data
    // response = response.split('\n');
    // response.splice(0,4);
    // response = response.join('\n');

    var events = [];
    var csvConverter = new converter({});

    csvConverter.fromString(response, co.wrap(function*(err, commissions){
      events = commissions.map(prepareCommission).filter(x => !!x);
      yield sendEvents.sendCommissions(that.eventName, events);
    }));
  });
};

// old commission processing code
function _prepareCommission(o_obj) {

  const commission = {};
  // Only confirmed transaction from linkshare are included in the transactions table,
  // as we get different source_transaction_id for each transactions status change
  // (is_event = N - confirmed, is_event = Y = initiated), which causes a bug.
  if(o_obj.is_event === "N"){
    //const isEvent = o_obj.is_event === "Y"; // old code
    commission.outclick_id = o_obj.u1;
    commission.transaction_id = o_obj.etransaction_id;
    commission.order_id = o_obj.order_id;
    commission.purchase_amount = o_obj.sale_amount;
    commission.commission_amount = o_obj.commissions;
    commission.currency = o_obj.currency;
    //commission.state = isEvent ? 'initiated' : 'confirmed'; // old code
    commission.state = 'paid';
    commission.effective_date = o_obj.process_date;
    return commission;
  }
}

function prepareCommission(o_obj) {

  const commission = {};
  if(o_obj){
    commission.outclick_id = _.get(o_obj, 'Member ID (U1)');
    commission.transaction_id = _.get(o_obj, 'Transaction ID');
    commission.order_id = _.get(o_obj, 'Order ID');
    commission.purchase_amount = Number(_.get(o_obj, 'Sales'));
    commission.commission_amount = Number(_.get(o_obj, 'Total Commission'));
    commission.currency = _.get(o_obj, 'Currency');
    commission.effective_date = new Date(_.get(o_obj, 'Process Date') + " " + _.get(o_obj, 'Process Time'));

    if(commission.purchase_amount < 0 && commission.commission_amount < 0)
      commission.state = 'cancelled';
    else
      commission.state = 'confirmed';
  }

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

module.exports = LinkShareGenericApi;
