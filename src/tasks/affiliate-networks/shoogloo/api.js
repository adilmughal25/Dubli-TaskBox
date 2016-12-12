"use strict";

const _ = require('lodash');
const co = require('co');
const denodeify = require('denodeify');
const soap = require('soap');
const request = require('request-promise');
const debug = require('debug')('shooglooSoap:api-client');
require('tough-cookie'); // for request's benefit

const API_CFG = {
  /*
  fan: {
    api_key: 'pzJiaNQjBU1aRv1lQrS0Q',
    affiliate_id: 4,
    baseUrl: 'http://login.fastaffiliatenetwork.com'
  },
  */
  shoogloo: {
    api_key: 'V42rYBXXoCjKbjMiZEELA',
    affiliate_id: 360,
    baseUrl: 'http://admin.shoogloo.media'
  }
};

const REPORTS_WSDL = '/affiliates/api/9/reports.asmx?wsdl';
const OFFERS_WSDL = '/affiliates/api/2/offers.asmx?wsdl';

function ShooglooSoapClient(s_entity) {
  if (!(this instanceof ShooglooSoapClient)) return new ShooglooSoapClient(s_entity);
  if (!s_entity) throw new Error("Missing required argument 's_entity'!");
  if (!API_CFG[s_entity]) throw new Error("Entity '" + s_entity + "' is not defined in API_CFG.");
  debug("Create new client for entity: %s", s_entity);

  this.cfg = API_CFG[s_entity];
  this.client = null;
  this.initialized = false; // client initialized or not
  this.jar = request.jar();
  this.dateFormat = d => d.toISOString().replace(/\..+$/, '-00:00');
}

ShooglooSoapClient.prototype.setup = co.wrap(function* (entity, serviceType) {
  if (!this.initialized) {
    let Client = this.client = yield init(this.jar, entity, serviceType);
    const keys = serviceType === 'offers' ? ['offers', 'offersSoap'] : ['reports', 'reportsSoap'];
    let methods = Object.keys(_.get(this.client.describe(), keys));
    methods.reduce( (self,method) => _.set(self, method, denodeify(Client[method].bind(Client))), this);
    this.initialized = true;
  }
});

function init(jar, entity, serviceType) {
  const rq = request.defaults({jar:jar});
  const WSDL = serviceType === 'offers' ? API_CFG[entity].baseUrl + OFFERS_WSDL : API_CFG[entity].baseUrl + REPORTS_WSDL;
  return new Promise(function(resolve, reject) {
    soap.createClient(WSDL, {request:rq}, function(error, client) {
      if (error) return reject(error);
      resolve(client);
    });
  });
}

module.exports = ShooglooSoapClient;