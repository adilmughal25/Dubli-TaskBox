"use strict";

const _ = require('lodash');
const co = require('co');
const denodeify = require('denodeify');
const soap = require('soap');
const debug = require('debug')('belboon:api-client');
const request = require('request');
require('tough-cookie'); // for request's benefit
//const limiter = require('ominto-utils').promiseRateLimiter;

/*
 * API docs: https://www.belboon.com/en/belboon-webservices.html
 * 
 * !Note: API has a limitation in amount of requests per hour. Though it is no clear yet, what that limit exactly is.
 * As per 9/14 we have a limit if 2500req/hours - we have pending request to increase to 10.000/h.
 */
const API_SERVICE_WSDL  = 'http://api.belboon.com/?wsdl';
const API_CFG = {
  ominto: {
    user: 'Ominto',
    pass: 'iLukiDXmA33eJAdlSiLe',
    siteId: 598628, // == PlatformId
  },
  dubli: {
    user: 'DubLi',
    pass: 'aUDaTrZQtoaVFwTIMnVR',
    siteId: 585191,
  }
};

function BelboonClient(s_entity) {
  if (!(this instanceof BelboonClient)) return new BelboonClient(s_entity);
  if (!s_entity) throw new Error("Missing required argument 's_entity'!");
  if (!API_CFG[s_entity]) throw new Error("Entity '"+s_entity+"' is not defined in API_CFG.");
  debug("Create new client for entity: %s", s_entity);

  this._initialized = false;

  this.cfg = API_CFG[s_entity];
  this.siteId = this.cfg.siteId;
  this._client = null;
  this.jar = request.jar();
}

BelboonClient.prototype.setup = co.wrap(function* () {
  if (!this.initialized) {
    debug("initializing SOAP client");

    let Client = this._client = yield init(this.jar);
    let methods = Object.keys(this._client.describe().BelboonHandler.BelboonHandler);
    methods.reduce( (self,method) => _.set(self, method, denodeify(Client[method].bind(Client))), this);

    this._client.setSecurity(new soap.BasicAuthSecurity(this.cfg.user, this.cfg.pass));

    //limiter.request(this._client, 10000, 3600).debug(debug);

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
