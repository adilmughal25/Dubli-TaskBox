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
// const validator = require('validator');
const deasync = require('deasync');

const AFFILIATE_NAME = 'linkshare';
const dealsLimit = 10;

const reportingURL = 'https://ran-reporting.rakutenmarketing.com/en/reports/individual-item-report-api-final/filters?';
const reportingToken = 'ZW5jcnlwdGVkYToyOntzOjU6IlRva2VuIjtzOjY0OiI2ODI4NTljZGIxYWU2ZjllZWQ1NDFhYjhlNjY1YTM2ODI4YTM3NmIxMjFmMWI1MTI4Y2Q2YzJhMjBkMTMzMjgzIjtzOjg6IlVzZXJUeXBlIjtzOjk6IlB1Ymxpc2hlciI7fQ%3D%3D';
const configs = require('../../../../configs.json');
const utilsDataClient = utils.restClient(configs.data_api);

const networksList = {
    us: 1,
    gb: 3,
    ca: 5,
    fr: 7,
    br: 8,
    de: 9,
    au: 41,
}

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

    merchants.forEach(function(merObj) {
      if(merObj.coupons.length > dealsLimit) {
        merchants = merchants.concat(divideMerchants(merObj.merchant, merObj.coupons, 'coupons'));
        merObj.coupons = [];
      }
      if(merObj.links.length > dealsLimit) {
        merchants = merchants.concat(divideMerchants(merObj.merchant, merObj.links, 'links'));
        merObj.links = [];
      }
    });

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
  this._getCommissionDetails = singleRun(function*() {

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

  this.getPayments = co.wrap(function* () {
    const startDate = moment().subtract(90, 'days').format('YYYYMMDD');
    const endDate = moment().format('YYYYMMDD');
    const paidStatuses = new Set();
    const delay = function(time) {
      return function(f) {
        setTimeout(f, time)
      }
    }

    const client = yield that.client.getFreshClient();
    const paymentHistoryurl = '/advancedreports/1.0?' + querystring.stringify({
      bdate: startDate,
      edate: endDate,
      token: '682859cdb1ae6f9eed541ab8e665a36828a376b121f1b5128cd6c2a20d133283',
      reportid: 1,
      nid: networksList[s_region] ? networksList[s_region] : networksList['us']
    });


    const paymentHistoryResponse = yield client.get(paymentHistoryurl).then(_check('payment history not found'));
    const paymentHistory = yield getCommissionsFromCSV(paymentHistoryResponse.body);

    for (let i = 0; i < paymentHistory.length; i++) {
      yield delay(15000);

      const advertiserPaymentHistoryurl = '/advancedreports/1.0?' + querystring.stringify({
        bdate: startDate,
        edate: endDate,
        token: '682859cdb1ae6f9eed541ab8e665a36828a376b121f1b5128cd6c2a20d133283',
        reportid: 2,
        payid: paymentHistory[i]['Payment ID'],
      });

      const advertiserPaymentHistoryResponse = yield client.get(advertiserPaymentHistoryurl).then(_check('Advertiser payment history not found'));
      let advertiserPaymentHistory = yield getCommissionsFromCSV(advertiserPaymentHistoryResponse.body);

      for (let j = 0; j < advertiserPaymentHistory.length; j++) {
        yield delay(15000);
        const paymentDetailsurl = '/advancedreports/1.0?' + querystring.stringify({
          token: '682859cdb1ae6f9eed541ab8e665a36828a376b121f1b5128cd6c2a20d133283',
          reportid: 3,
          invoiceid: advertiserPaymentHistory[j]['Invoice Number'],
        });

        const paymentDetailsResponse = yield client.get(paymentDetailsurl).then(_check('Advertiser payment history not found'));
        let paymentDetails = yield getCommissionsFromCSV(paymentDetailsResponse.body);
        for (let k = 0; k < paymentDetails.length; k++) {
          console.log('Paid ' + paymentDetails[k]['Order ID']);
          paidStatuses.add(paymentDetails[k]['Order ID']);
        }
      }
    }

    return paidStatuses;
  });

  // https://ran-reporting.rakutenmarketing.com/en/reports/signature-orders-report/filters?
  //start_date=2016-11-01&end_date=2016-11-15&include_summary=Y&network=1&tz=GMT&date_type=transaction
  //&token=ZW5jcnlwdGVkYToyOntzOjU6IlRva2VuIjtzOjY0OiI2ODI4NTljZGIxYWU2ZjllZWQ1NDFhYjhlNjY1YTM2ODI4YTM3NmIxMjFmMWI1MTI4Y2Q2YzJhMjBkMTMzMjgzIjtzOjg6IlVzZXJUeXBlIjtzOjk6IlB1Ymxpc2hlciI7fQ%3D%3D
  this.getCommissionDetails = singleRun(function*(){
    const startDate = moment().subtract(90, 'days').format('YYYY-MM-DD');
    const endDate = moment().format('YYYY-MM-DD');

    let allCommissions = [];

    let taskDate = yield utilsDataClient.get('/getTaskDateByAffiliate/linkshare-' + (s_region || 'us'), true, this);

    if (taskDate.body && taskDate.body !== "Not Found") {
      let startCount = moment().diff(moment(taskDate.body.start_date), "days")
      let endCount = moment().diff(moment(taskDate.body.end_date), "days");
      allCommissions = yield getCommissionsByDate(startCount, endCount, s_region, that);
      yield utilsDataClient.patch('/inactivateTask/linkshare-' + (s_region || 'us'), true, this);
    }

    let dataClient = request.defaults({});
    const payments = yield that.getPayments();

    console.log(networksList[s_region] ? networksList[s_region] : networksList['us']);
    const url = reportingURL + querystring.stringify({
      start_date: startDate,
      end_date: endDate,
      include_summary: 'N',
      // network: 1, // dont do a network specific call
      network: networksList[s_region] ? networksList[s_region] : networksList['us'], // dont do a network specific call
      tz: 'GMT',
      date_type: 'process', //using process instead of transaction as these transactions are confirmed onces
      token: reportingToken
    });

    // Network: 3 is uk
    // Network: 5 is Canada
    // Network: 7 is france
    // Network: 8 is brazil
    // Network: 9 is germany

    /*
    //let response = yield dataClient.get(url);

    // if using "csvtojson" library
    // if summary is included in the response then clean it and proceed with only essential data
    // response = response.split('\n');
    // response.splice(0,4);
    // response = response.join('\n');

    // if using "csvtojson" library
    // var csvConverter = new converter({});

    // using custom function "csvToJson" instead of library, as using the external library doesnt
    // write the report in the flat db file - this is super weird
    //var commissions = csvToJson(response);
    */

    let commissions = yield getCommissionsFromCSV(yield dataClient.get(url));
    allCommissions = allCommissions.concat(commissions);
    var events = allCommissions.map((val) => prepareCommission(val, payments)).filter(x => !!x);
    return yield sendEvents.sendCommissions(that.eventName, events);
  });
};

function * getCommissionsByDate(fromCount, toCount, s_region) {
  let startDate;
  let endDate;
  let allCommissions = [];
  try {

    let startCount = fromCount;
    let endCount = (fromCount - toCount > 90) ? fromCount - 90 : toCount;

    debug('start');

    while (true) {
      debug('inside while');
      if (startCount <= toCount) {
        break;
      }

      debug('start date --> ' + moment().subtract(startCount, 'days').toDate() + ' start count --> ' +startCount);
      debug('end date --> ' + moment().subtract(endCount, 'days').toDate() + ' end count --> ' +endCount);
      startDate = moment().subtract(startCount, 'days').format('YYYY-MM-DD');
      endDate = moment().subtract(endCount, 'days').format('YYYY-MM-DD');

      var dataClient = request.defaults({});

      console.log(networksList[s_region] ? networksList[s_region] : networksList['us']);
      const url = reportingURL + querystring.stringify({
        start_date: startDate,
        end_date: endDate,
        include_summary: 'N',
        // network: 1, // dont do a network specific call
        network: networksList[s_region] ? networksList[s_region] : networksList['us'], // dont do a network specific call
        tz: 'GMT',
        date_type: 'process', //using process instead of transaction as these transactions are confirmed onces
        token: reportingToken
      });

      let commissions = yield getCommissionsFromCSV(yield dataClient.get(url));
      allCommissions = allCommissions.concat(commissions);

      endCount = (startCount - endCount >= 90) ? endCount - 90 : toCount;
      startCount = startCount - 90;
    }

    debug('finish');
  } catch (e) {
    console.log(e);
  }
  return allCommissions;
}

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
    commission.state = 'confirmed'; // changing from paid to confirmed as this is handeled in DB
    commission.effective_date = o_obj.process_date;
    return commission;
  }
}

function prepareCommission(o_obj, payments) {
  const commission = {};

  // converting the string
  o_obj = JSON.parse(JSON.stringify(o_obj).replace('Member ID (U1)','Sub_ID'));
  let merchant_name = _.get(o_obj, 'Advertiser Name') ? _.get(o_obj, 'Advertiser Name').replace('\\','') : '';

  const currency = _.get(o_obj, 'Currency') ? _.get(o_obj, 'Currency').toLowerCase() : '';
  const orderId = _.get(o_obj, 'Order ID');
  const commisionState = payments.has(orderId) ? 'paid' : 'confirmed'


  // remove special chars [','] from amount
  // TODO: for eur currency - check the format('.' instead of ',' for digit separation),
  // currently its the same as usd, hence no currency check
  var purchase_amount;
  if(typeof _.get(o_obj, 'Sales') === 'string'){
    purchase_amount = _.get(o_obj, 'Sales').replace(/\,/g, '');
  } else {
    purchase_amount = _.get(o_obj, 'Sales');
  }

  // remove special chars [','] from amount
  // TODO: for eur currency - check the format('.' instead of ',' for digit separation),
  // currently its the same as usd, hence no currency check
  var commission_amount;
  if(typeof _.get(o_obj, 'Total Commission') === 'string'){
    commission_amount = _.get(o_obj, 'Total Commission').replace(/\,/g, '');
  } else {
    commission_amount = _.get(o_obj, 'Total Commission');
  }

  // adding extra validations before parsing
  if(o_obj){
    commission.affiliate_name = AFFILIATE_NAME,
    commission.merchant_name = merchant_name,
    commission.merchant_id = o_obj.MID || '',
    //commission.outclick_id = _.get(o_obj, '﻿Member ID \(U1\)');
    commission.outclick_id = o_obj.Sub_ID;
    commission.transaction_id = _.get(o_obj, 'Transaction ID');
    commission.order_id = _.get(o_obj, 'Order ID');
    // commission.purchase_amount = _.toNumber(_.get(o_obj, 'Sales'));
    // commission.commission_amount = _.toNumber(_.get(o_obj, 'Total Commission'));
    commission.purchase_amount = Number(purchase_amount);
    commission.commission_amount = Number(commission_amount);
    commission.currency = currency;
    commission.effective_date = new Date(_.get(o_obj, 'Process Date') + " " + _.get(o_obj, 'Process Time'));

    // OM-1846 - By default all the transactions with negative amounts are marked as confirmed
    /*
    if(commission.purchase_amount < 0 && commission.commission_amount < 0)
      commission.state = 'cancelled';
    else
      commission.state = 'confirmed';
    */
    commission.state = commisionState;

    return commission;
  }
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

  if(Array.isArray(o_obj.merchants)) {
    o_obj.merchants.forEach(m => set(m.mid, 'merchant', m));
  }
  else
    set(o_obj.merchants.mid, 'merchant', o_obj.merchants);

  o_obj.textLinks.forEach(l => add(l.mid, 'links', l));
  o_obj.coupons.forEach(c => add(c.advertiserid, 'coupons', c));
  return _.values(res).filter(x => 'merchant' in x);
}

/*
// old cvs to json
function _csvToJson(csv) {
  // remove excess quotes
  csv = csv.replace(/["']+/g, '');
  // remove excess '\r' at the end of each line
  csv = csv.replace(/\r+/g, '');
  const content = csv.split('\n');
  const header = content[0].split(',');
  return _.tail(content).map((row) => {
    return _.zipObject(header, row.split(','));
  });
}

function csvToJson(csv) {

  // remove excess quotes
  csv = csv.replace(/["']+/g, '');
  // remove excess '\r' at the end of each line
  csv = csv.replace(/\r+/g, '');

  const content = csv.split('\n');
  const header = content[0].split(',');
  return _.tail(content).map((row) => {
    var data = row.split(',');
    if(data.length > 1){
      if(header.length != data.length){
        // console.log("before : " + row);
        row = additionalProcessing(row);
        // console.log("after  : " + row);
        if(validateProcessing(row)){
          return _.zipObject(header, row.split(','));
          // console.log();
        } else {
          // console.log("error : " + row);
          // console.log();
        }
      }
      else{
        return _.zipObject(header, row.split(','));
      }
    }
  });
}

function additionalProcessing(row){

  var rowData = row.split(',');
  var newRowData = [];

  if(validator.isAlphanumeric(String(rowData[0])))
    newRowData[0] = rowData[0];

  if(/^[a-zA-Z0-9-.]*$/.test(rowData[1]))
    newRowData[1] = rowData[1];

  if(validator.isDate(String(rowData[2])))
    newRowData[2] = rowData[2];

  if(/^([0-1]?[0-9]|2[0-4]):([0-5][0-9])(:[0-5][0-9])?$/.test(rowData[3]))
     newRowData[3] = rowData[3];

  if(rowData.length === 9){
    if(validator.isFloat(String(rowData[4])) && validator.isFloat(String(rowData[5])))
      newRowData[4] = Number(rowData[4]+''+rowData[5]);

    if(validator.isFloat(String(rowData[6])))
      newRowData[5] = rowData[6];

    if(validator.isAlpha(String(rowData[7])) && rowData[7].length === 3)
      newRowData[6] = rowData[7];

    if(validator.isAlphanumeric(String(rowData[8])))
      newRowData[7] = rowData[8];
  }

  if(rowData.length === 10){
    console.log("THIS SHOULD NOT BE PRINTED!!!");
    if(validator.isFloat(String(rowData[4])) && validator.isFloat(String(rowData[5])))
      newRowData[4] = Number(rowData[4]+''+rowData[5]);

    if(validator.isFloat(String(rowData[6])) && validator.isFloat(String(rowData[7])))
      newRowData[5] = Number(rowData[6]+''+rowData[7]);

    if(validator.isAlpha(String(rowData[8])) && rowData[8].length === 3)
      newRowData[6] = rowData[8];

    if(validator.isAlphanumeric(String(rowData[9])))
      newRowData[7] = rowData[9];
  }

  return newRowData.join();
}

function validateProcessing(row){

  var rowData = row.split(',');

  return validator.isAlphanumeric(String(rowData[0])) &&
  /^[a-zA-Z0-9-.]*$/.test(rowData[1]) &&
  validator.isDate(String(rowData[2])) &&
  /^([0-1]?[0-9]|2[0-4]):([0-5][0-9])(:[0-5][0-9])?$/.test(rowData[3]) &&
  validator.isFloat(String(rowData[4])) &&
  validator.isFloat(String(rowData[5])) &&
  validator.isAlpha(String(rowData[6])) && rowData[6].length === 3 &&
  validator.isAlphanumeric(String(rowData[7]));
}
*/

function parseCommissions(response) {

  var sync = true;
  var commissions = null;
  var csvConverter = new converter({});
  csvConverter.fromString(response, function(err, data){
    commissions = data;
  });

  // while(sync) {
  //   deasync.sleep(1000);
  //   if(commissions.length > 0)
  //     sync = false;
  // }
  return getCommissionsFromCSV(response);
}

function * getCommissionsFromCSV(response) {
  return new Promise((resolve, reject) => {
    var csvConverter = new converter({});
    csvConverter.fromString(response, function(err, data){
      if(err)
        reject(err);
      resolve(data);
    });
  });
}

function divideMerchants(merchant, ads, type) {

  return _.chunk(ads, dealsLimit).map(function (chunk) {
    return {
      merchant: merchant,
      coupons: type === 'coupons' ? chunk : [],
      links: type === 'links' ? chunk : []
    }
  });
}

module.exports = LinkShareGenericApi;
