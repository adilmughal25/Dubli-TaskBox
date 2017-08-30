"use strict";

const _ = require('lodash');
const co = require('co');
const denodeify = require('denodeify');
const soap = require('soap');
const request = require('request-promise');
const debug = require('debug')('fan:api-client');
//require('tough-cookie'); // for request's benefit

const API_CFG = {
  jumia: {
    api_key: 'tdYiAJ71MnE4Vzfn5RkKZg',
    affiliate_id: 36387,
    baseUrl: 'http://affiliate.jumia.com'
  }  
};

const REPORTS_WSDL = '/affiliates/api/5/reports.asmx?wsdl';
const OFFERS_WSDL = '/affiliates/api/2/offers.asmx?wsdl';

function JumiaClient(s_entity) {

  if (!(this instanceof JumiaClient)) return new JumiaClient(s_entity);
  if (!s_entity) throw new Error("Missing required argument 's_entity'!");
  if (!API_CFG[s_entity]) throw new Error("Entity '" + s_entity + "' is not defined in API_CFG.");
  debug("Create new client for entity: %s", s_entity);

  this.cfg = API_CFG[s_entity];
  this.client = null;
  // using a flag to initialize the jar
  this.initializedOffers = false;
  this.initializedReports = false;
  this.jar = request.jar();
  this.dateFormat = d => d.toISOString().replace(/\..+$/, '-00:00');
}

JumiaClient.prototype.setupOffers = co.wrap(function* (entity, serviceType) {
  if (!this.initializedOffers) {
    let Client = this.client = yield init(this.jar, entity, serviceType);
    const keys = ['offers', 'offersSoap'];
    let methods = Object.keys(_.get(this.client.describe(), keys));
    methods.reduce( (self,method) => _.set(self, method, denodeify(Client[method].bind(Client))), this);
    this.initializedOffers = true;
  }
});

JumiaClient.prototype.setupReports = co.wrap(function* (entity, serviceType) {
  if (!this.initializedReports) {
    let Client = this.client = yield init(this.jar, entity, serviceType);
    const keys = ['reports', 'reportsSoap'];
    let methods = Object.keys(_.get(this.client.describe(), keys));
    methods.reduce( (self,method) => _.set(self, method, denodeify(Client[method].bind(Client))), this);
    this.initializedReports = true;
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

module.exports = JumiaClient;