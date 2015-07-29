"use strict";

const _ = require('lodash');
const debug = require('debug')('belboon:processor');
const sendEvents = require('./support/send-events');
const singleRun = require('./support/single-run');
const merge = require('./support/easy-merge')('id', {
  images: 'offer_id',
});

const client = require('./api-clients/belboon')();
const ary = x => _.isArray(x) ? x : [x];

// belboon's API sucks. We can get merchants, and there IS an api for deals,
// which uses different IDs for merchants than the merchants list ("feed id"
// vs "program id") and I can't find anything that relates a program id to a
// feed id. Commissions can't be done through the API at all. Importing merchants only.

const getMerchants = singleRun(function* () {
  const results = yield client.getMerchants();
  const merchants = results.map(merchant => ({merchant: merchant}));
  yield sendEvents.sendMerchants('belboon', merchants);
});

module.exports = {
  getMerchants: getMerchants
};
