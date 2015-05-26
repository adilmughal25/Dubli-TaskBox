"use strict";

var debug = require('debug')('clickjunction:api');
var parser = require('xml2json');
var moment = require('moment');
var request = require("request-promise");
var wait = require('co-waiter');

var advertiserClient = getClient("https://advertiser-lookup.api.cj.com");
var commissionClient = getClient("https://commission-detail.api.cj.com/v3");

var merchantsRunning = false;
function* getMerchants() {
  if (merchantsRunning) { throw 'already-running'; }
  merchantsRunning = true;

  var perPage = 25;
  var page = 1;
  var client = getClient("https://advertiser-lookup.api.cj.com/v3");
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
      if (merchants) { sendMerchantsToEventHub(merchants); }

      url = (info['total-matched'] >= perPage * info['page-number']) ?
        advertiserUrl(++page, perPage) : null;
      if (url) { yield wait.minutes(1); }
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

  var startTime = moment().subtract('1 day').startOf('day').format('YYYY-MM-DD');
  var endTime = moment().add('1 day').startOf('day').format('YYYY-MM-DD');

  var client = getClient("https://commission-detail.api.cj.com/v3");
  var url = commissionsUrl(startTime, endTime);

  // according to http://cjsupport.custhelp.com/app/answers/detail/a_id/1553,
  // this one doesn't seem to paginate, so we apparently don't need a fancy
  // async while loop here
  debug("commissions fetch start");
  try {
    debug("merchants fetch: %s", url);
    var response = yield client.get(url);
    var ret = parser.toJson(response.body, {
      object: true,
    });

    var info = ret['cj-api'].commissions;
    var commissions = info.commission;

    if(commissions) {
      sendCommissionsToEventHub(commissions);
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

function getClient(baseUrl) {
  var dataClient = request.defaults({
    baseUrl: baseUrl,
    json: true,
    simple: true,
    resolveWithFullResponse: true,
    headers: {
      authorization: "009c8796168d78c027c9b4f1d8ed3902172eefa59512b9f9647482240bcd99d00a70c6358dd2b855f30afeafe055e1c8d99e632a626b1fa073a4092f4dd915e26d/36d998315cefa43e0d0377fff0d89a2fef85907b556d8fc3b0c3edc7a90b2e07fc8455369f721cc69524653234978c36fd12c67646205bf969bfa34f8242de8d",
      accept: "application/xml"
    }
  });
  return dataClient;
}

function sendMerchantsToEventHub(merchants) {
  if (! merchants) { merchants = []; }
  debug("found %d merchants to process", merchants.length);
}

function sendCommissionsToEventHub(commissions) {
  if (! commissions) { commissions = []; }
  debug("found %d commisions to process", commissions.length);
}

module.exports = {
  getCommissionDetails: getCommissionDetails,
  getMerchants: getMerchants
};
