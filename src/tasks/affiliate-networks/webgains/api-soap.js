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

const _ = require('lodash');
const co = require('co');
const denodeify = require('denodeify');
const soap = require('soap');
const request = require('request-promise');
const debug = require('debug')('webgainsSoap:api-client');
require('tough-cookie'); // for request's benefit

const API_SERVICE_WSDL = 'http://ws.webgains.com/aws.php?wsdl';
const API_CFG = {
  ominto: {
    user: 'merchants@ominto.com',
    pass: 'DubLi2017',
    siteId: 177143
  },
};

function WebgainsSoapClient(s_entity) {
  if (!(this instanceof WebgainsSoapClient)) return new WebgainsSoapClient(s_entity);
  if (!s_entity) throw new Error("Missing required argument 's_entity'!");

  s_entity = s_entity.replace('-', '_');
  if (!API_CFG[s_entity]) throw new Error("Entity '"+s_entity+"' is not defined in API_CFG.");

  debug("Create new client for entity: %s", s_entity);

  this.cfg = API_CFG[s_entity];
  this.client = null;
  this.initialized = false; // client initialized or not
  this.jar = request.jar();

  this.dateFormat = d => d.toISOString().replace(/\..+$/, '-00:00');
}

WebgainsSoapClient.prototype.setup = co.wrap(function* () {
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
    soap.createClient(API_SERVICE_WSDL, {request:rq}, function(error, client) {
      if (error) return reject(error);
      resolve(client);
    });
  });
}

module.exports = WebgainsSoapClient;
