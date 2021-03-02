"use strict";

const _ = require('lodash');
const co = require('co');
const request = require('request-promise');
const debug = require('debug')('adtraction:api-client');
const moment = require('moment-timezone');

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
  commissions: 'https://api.adtraction.com/v1/affiliate/transactions/combined',
  commissionsV2: 'https://api.adtraction.com/v2/affiliate/transactions'
};

// helpers
const ary = x => x ? (_.isArray(x) ? x : [x]) : [];
const formatDate = d => moment(d).format('YYYY-MM-DDT00:00:00.000Z');

// client
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
    var transRequest = this.defaults({
      body : "{\"fromDate\": \"" + formatDate(start) + "\",  \"toDate\": \"" + formatDate(end) + "\", \"transactionStatus\": 0}"
    })

    let requestUrl = this.url('commissionsV2');
    requestUrl += '?token=' + API_CFG[s_entity].token;
    console.log("Invoking Commissions URL: %s, from %s, to %s", requestUrl, formatDate(start), formatDate(end));

    const promise = transRequest.post(requestUrl);
    return promise;
  };

  return client;
}

module.exports = createClient;
