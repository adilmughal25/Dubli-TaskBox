"use strict";

const _ = require('lodash');
const co = require('co');
const denodeify = require('denodeify');
const soap = require('soap');
const debug = require('debug')('belboon:api-client');
const request = require('request-promise');
require('tough-cookie'); // for request's benefit
const limiter = require('ominto-utils').promiseRateLimiter;

/*
 * API docs: https://www.belboon.com/en/belboon-webservices.html
 * 
 * !Note: API has a limitation in amount of requests per hour. Though it is no clear yet, what that limit exactly is.
 * A limit of 250req/hour is currently active - we expecting feedback from affiliate network with specific info. (as of 9/14/2015)
 */

const API_SERVICE_WSDL  = 'http://api.belboon.com/?wsdl';
const API_USER          = 'Ominto';
const API_PASSWORD      = 'iLukiDXmA33eJAdlSiLe';
const SITE_ID           = '598628'; // == PlatformId
// DubLi Legacy
//const API_USER          = 'DubLi';
//const API_PASSWORD      = 'aUDaTrZQtoaVFwTIMnVR';
//const SITE_ID           = '585191';

function BelboonClient() {
  if (!(this instanceof BelboonClient)) return new BelboonClient();
  this._initialized = false;

  this.siteId = SITE_ID;
  this._client = null;
  this.jar = request.jar();
}

BelboonClient.prototype.setup = co.wrap(function* () {
  if (!this.initialized) {
    debug("initializing SOAP client");

    let Client = this._client = yield init(this.jar);
    let methods = Object.keys(this._client.describe().BelboonHandler.BelboonHandler);
    methods.reduce( (self,method) => _.set(self, method, denodeify(Client[method].bind(Client))), this);

    this._client.setSecurity(new soap.BasicAuthSecurity(API_USER, API_PASSWORD));

    limiter.request(this._client, 250, 3600).debug(debug);
    
    this.initialized = true;
  }
});

function init(jar) {
  var rq = request.defaults({jar:jar});
  return new Promise( (resolve, reject) => {
    soap.createClient(API_SERVICE_WSDL, {request:rq}, function(error, client) {
      if (error) return reject(error);
      resolve(client);
    });
  });
}

module.exports = BelboonClient;
