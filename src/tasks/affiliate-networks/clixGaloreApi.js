"use strict";

const _ = require('lodash');
const co = require('co');
const debug = require('debug')('clixgalore:processor');
const sendEvents = require('./support/send-events');
const singleRun = require('./support/single-run');
const client = require('./api-clients/clixGalore')();

var getMerchants = singleRun(function* () {
  console.log("get merchants");

  const merchants = yield client.getFeed('affiliateJoinRequests');
  const linkcodes = yield client.getFeed('affiliateLinkCode');
  
  console.log(merchants);
  console.log(linkcodes);

process.exit();
//  yield sendEvents.sendMerchants('clixgalore', merchants);
});

var getCommissionDetails = singleRun(function* () {
  console.log("get commission details...");
  //yield sendEvents.sendCommissions('clixgalore', events);
});

module.exports = {
  getMerchants: getMerchants,
  getCommissionDetails: getCommissionDetails
};
