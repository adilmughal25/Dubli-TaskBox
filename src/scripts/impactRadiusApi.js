"use strict";

var _ = require('lodash');
var parser = require('xml2json');
var request = require("request-promise");
var co = require('co');
var wait = require('co-waiter');
var moment = require('moment');
var debug = require('debug')('impactradius:api');
var sendEvents = require('./send-events');
var utils = require('ominto-utils');
var dataService = utils.getDataClient(require('../../configs').data_api.url);
var irClient = utils.remoteApis.impactRadiusClient();

var merchantsRunning = false;
function* getMerchants() {
  if (merchantsRunning) { throw "already-running"; }
  merchantsRunning = true;

  var perPage = 1000;
  var url = "Mediapartners/IRDHLqHpQY79155520ngJ28D9dMGTVZJA1/Campaigns.json?PageSize="+perPage+"&Page=1";

  var merchants;
  debug("merchants fetch started");
  try {
    merchants = yield irClient.getPaginated(url, 'Campaigns', 60);
    yield sendMerchantsToEventHub(merchants);
  } catch(e) {
    // clean up the Request error a bit
    throw reformatRequestError(e);
  } finally {
    merchantsRunning = false;
  }
  debug("merchants fetch complete");
}

var commissionsRunning = false;
function* getCommissionDetails() {
  if (commissionsRunning) { throw "already-running"; }
  commissionsRunning = true;

  var perPage = 1000;
  var startTime = moment().subtract(1, 'days').startOf('day').toISOString().replace(/\..+$/, '-00:00');
  var endTime = moment().add(1, 'days').startOf('day').toISOString().replace(/\..+$/, '-00:00');

  var client = getClient();
  var url = "Mediapartners/IRDHLqHpQY79155520ngJ28D9dMGTVZJA1/Actions.json?PageSize=" +
    perPage + "&Page=1&StartDate=" + startTime + "&EndDate=" + endTime;

  debug("commissions fetch started");
  var commissions;
  try {
    commissions = yield irClient.getPaginated(url, 'Actions', 60);
    yield sendMerchantsToEventHub(commissions);
  } catch(e) {
    throw reformatRequestError(e);
  } finally {
    commissionsRunning = false;
  }
  debug("commissions fetch complete");
}

function reformatRequestError(error) {
  if (!error.options || !_.isObject(error.options) || !('method' in error.options)) {
    // isn't a request error!
    return error;
  }

  var errString = error.message.replace(/^Error: /, ''); // otherwise we'll get a duplicate in the msg
  var o = error.options || {};
  var url = o.url || o.uri;
  var base = o.baseUrl || "";
  var fullUrl = base ? [base.replace(/\/+$/, ''), url.replace(/^\/+/, '')].join('/') : url;

  errString += " (" + o.method + " " + fullUrl + ")";
  var newError = new Error(errString);
  _.extend(newError, _.pick(error, 'cause', 'options', 'error'));
  newError.stack = [newError.stack, "---", error.stack].join("\n"); // keep old stack
  return newError;
}

function sendMerchantsToEventHub(merchants) {
  if (! merchants) { merchants = []; }
  debug("found %d merchants to process", merchants.length);
  return sendEvents.sendMerchants('impactradius', merchants);
}

function sendCommissionsToEventHub(commissions) {
  if (! commissions) { commissions = []; }
  debug("found %d commisions to process", commissions.length);
  return sendEvents.sendCommissions('impactradius', commissions);
}

module.exports = {
  getCommissionDetails: getCommissionDetails,
  getMerchants: getMerchants
};
