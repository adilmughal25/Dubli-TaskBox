"use strict";

const SERVICE_WSDL = 'http://ws.tradetracker.com/soap/affiliate?wsdl';
const CUSTOMER_ID  = 120335;
const PASSPHRASE   = 'cb7c439c5c11f70590b9ae6b8b8032a7ebed624e';
const SITE_ID      = 219065;

var _ = require('lodash');
var co = require('co');
var denodeify = require('denodeify');
var soap = require('soap');
var request = require('request-promise');

function TradeTrackerClient() {
  if (!(this instanceof TradeTrackerClient)) return new TradeTrackerClient();
  this._client = null;
  this.initialized = false;
  this.jar = request.jar();
  this.customerId = CUSTOMER_ID;
  this.siteId = SITE_ID;
}

var TTC = TradeTrackerClient.prototype;

TTC.setup = co.wrap(function* () {
  if (!this.initialized) {
    var C = this._client = yield init(this.jar);
    var methods = Object.keys(this._client.describe().AffiliateService.AffiliateBinding);
    methods.reduce( (self,X) => _.set(self, X, denodeify(C[X].bind(C))), this);

    yield this.authenticate({
      customerID: CUSTOMER_ID,
      passphrase: PASSPHRASE,
      demo: false,
      sandbox: false,
      locale: 'en_GB',
    });
    this.initialized = true;
  }
});

function init(jar) {
  var rq = request.defaults({jar:jar});
  return new Promise(function(resolve, reject) {
    soap.createClient(SERVICE_WSDL, {request:rq}, function(error, client) {
      if (error) return reject(error);
      resolve(client);
    });
  });
}

module.exports = TradeTrackerClient;
