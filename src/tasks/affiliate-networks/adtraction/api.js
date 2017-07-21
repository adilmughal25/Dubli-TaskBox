"use strict";

const _ = require('lodash');
const co = require('co');
const request = require('request-promise');
const debug = require('debug')('adtraction:api-client');

const API_CFG = {
  ominto: {
    token: '1A9ADF4703D3248EE30F903D1C421665E63970CF',
    approvalStatus: '1',
    channelId: '1186125221'
  },
};

const API_URLS = {
  programs: 'https://api.adtraction.com/v1/affiliate/programs',
  coupons: 'https://api.adtraction.com/v1/affiliate/couponcodes',
  commissions: 'https://api.adtraction.com/v1/affiliate/TODO-ADD' //TODO fix the url
};

// helpers
const ary = x => x ? (_.isArray(x) ? x : [x]) : [];
const formatDate = d => moment(d).format('YYYY-MM-DD');
const isStringDate = d => _.isString(d) && /^\d{4}(-\d{2}){2}$/.test(d);
const getDate = d => {
  if (_.isDate(d)) return formatDate(d);
  if (isStringDate(d)) return d;
  throw new Error("Not a date: ", d);
};

function createClient(s_entity) {
  if (!s_entity) s_entity = 'ominto';

  const client = request.defaults({
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Token': API_CFG[s_entity].token
    },

    body: "{\"approvalStatus\": \"" + API_CFG[s_entity].approvalStatus + "\", \"channelId\": \"" + API_CFG[s_entity].channelId + "\"}"
  });

  const url = client.url = function url(type) {
    return API_URLS[type];
  };

  client.getMerchants = function () {
    const requestUrl = this.url('programs');
    console.log("Invoking Merchant URL", requestUrl);
    const promise = this.post(requestUrl);
    return promise;
  };

  client.getCoupons = function () {
    const requestUrl = this.url('coupons');
    console.log("Invoking Coupons URL", requestUrl);
    const promise = this.post(requestUrl);
    return promise;
  };

  client.getCommissions = function (start, end) {
    const requestUrl = this.url('commissions');
    console.log("URL", requestUrl);
    //TODO add start and end dates to the request
    const promise = this.post(requestUrl);
    return promise;
  };

  return client;
}

module.exports = createClient;
