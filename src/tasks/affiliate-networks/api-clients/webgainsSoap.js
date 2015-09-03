"use strict";

/*
 * Webgains API client for their webservices / SOAP API.
 * Used for commission details only. See "webgains.js" for RESTful API client to get merchant information.
 * 
 * API Documentation: 
 *    http://www.webgains.de/newsletter/images/Webgains%20Webservice%20f%C3%BCr%20Affiliates.pdf
 *    http://ws.webgains.com/aws.php
 *
 * This webservice does not use a common authentication, every request is passing username/password as part of request params.
 */

const SERVICE_WSDL = 'http://ws.webgains.com/aws.php?wsdl';
const API_USER = 'merchants@ominto.com';
const API_PASS = 'Minty789';
const SITE_ID = 177143;
// DubLi legacy
//const API_USER = 'mall@dubli.com';
//const API_PASS = 'cashback6750';
//const SITE_ID = 75700;

const _ = require('lodash');
const co = require('co');
const denodeify = require('denodeify');
const soap = require('soap');
const request = require('request-promise');
const debug = require('debug')('webgainsSoap:api-client');
require('tough-cookie'); // for request's benefit

function WebgainsClient() {
  if (!(this instanceof WebgainsClient)) return new WebgainsClient();
  debug("Create new client");

  this.client = null;
  this.initialized = false; // client initialized or not
  this.jar = request.jar();
  
  this.authcfg = {
    user: API_USER,
    pass: API_PASS,
    siteId: SITE_ID
  };

  this.dateFormat = d => d.toISOString().replace(/\..+$/, '-00:00');
}

WebgainsClient.prototype.setup = co.wrap(function* () {
  if (!this.initialized) {
    let Client = this.client = yield init(this.jar);
    let methods = Object.keys(this.client.describe().Webgains.WebgainsPort);
    methods.reduce( (self,method) => _.set(self, method, denodeify(Client[method].bind(Client))), this);

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

module.exports = WebgainsClient;
