"use strict";

var debug = require('debug')('clickjunction:api');
var parser = require('xml2json');
var moment = require('moment');
var request = require("request-promise");
var wait = require('co-waiter');
var sendEvents = require('./send-events');
var cjClient = require('ominto-utils').remoteApis.clickJunctionClient;

var merchantsRunning = false;
function* getMerchants() {
  if (merchantsRunning) { throw 'already-running'; }
  merchantsRunning = true;

  var perPage = 100;
  var page = 1;
  var client = cjClient("advertisers");
  var url = advertiserUrl(page, perPage);

  debug("merchants fetch started");
  try {
    while (url) {
      debug("merchants fetch: %s", url);
      var response = yield client.get(url);
      var ret = parser.toJson(response.body, {
        object: true,
      });
      var info = ret['cj-api'].advertisers;
      var merchants = info.advertiser;
      if (merchants) { yield sendMerchantsToEventHub(merchants); }

      url = (info['total-matched'] >= perPage * info['page-number']) ?
        advertiserUrl(++page, perPage) : null;
    }
  } finally {
    merchantsRunning = false;
  }
  debug("merchants fetch complete");
}

var commissionsRunning = false;
function* getCommissionDetails() {
  if (commissionsRunning) { throw 'already-running'; }
  commissionsRunning = true;

  var startTime = moment().subtract(1, 'days').startOf('day').format('YYYY-MM-DD');
  var endTime = moment().add(1, 'days').startOf('day').format('YYYY-MM-DD');

  var client = cjClient("commissions");
  var url = commissionsUrl(startTime, endTime);

  // according to http://cjsupport.custhelp.com/app/answers/detail/a_id/1553,
  // this one doesn't seem to paginate, so we apparently don't need a fancy
  // async while loop here
  debug("commissions fetch start");
  try {
    debug("commissions fetch: %s", url);
    var response = yield client.get(url);
    var ret = parser.toJson(response.body, {
      object: true,
    });

    var info = ret['cj-api'].commissions;
    var commissions = info.commission;

    if(commissions) {
      yield sendCommissionsToEventHub(commissions);
    }
  } finally {
    commissionsRunning = false;
  }
  debug("commissions fetch complete");
}

function advertiserUrl(page, perPage) {
  return "/advertiser-lookup?advertiser-ids=joined&records-per-page="+perPage+"&page-number="+page;
}

function commissionsUrl(start, end) {
  return "/commissions?date-type=posting&start-date="+start+"&end-date="+end;
}

function sendMerchantsToEventHub(merchants) {
  if (! merchants) { merchants = []; }
  debug("found %d merchants to process", merchants.length);
  return sendEvents.sendMerchants('clickjunction', merchants);
}

function sendCommissionsToEventHub(commissions) {
  if (! commissions) { commissions = []; }
  debug("found %d commisions to process", commissions.length);
  return sendEvents.sendCommissions('clickjunction', commissions);
}

module.exports = {
  getCommissionDetails: getCommissionDetails,
  getMerchants: getMerchants
};
