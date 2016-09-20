"use strict";

const _ = require('lodash');
const co = require('co');
const denodeify = require('denodeify');
const soap = require('soap');
const request = require('request-promise');
const debug = require('debug')('shooglooSoap:api-client');
require('tough-cookie'); // for request's benefit

const REPORTS_WSDL = 'http://admin.shoogloo.media/affiliates/api/9/reports.asmx?wsdl';
const OFFERS_WSDL = 'http://admin.shoogloo.media/affiliates/api/2/offers.asmx?wsdl';
const apiKey = 'V42rYBXXoCjKbjMiZEELA';
const affiliateId = 360;

function ShooglooSoapClient() {
  if (!(this instanceof ShooglooSoapClient)) return new ShooglooSoapClient();

  this.cfg = {
    api_key: 'V42rYBXXoCjKbjMiZEELA',
    affiliate_id: 360
  };
  this.client = null;
  this.initialized = false; // client initialized or not
  this.jar = request.jar();
  this.dateFormat = d => d.toISOString().replace(/\..+$/, '-00:00');

}

ShooglooSoapClient.prototype.setup = co.wrap(function* (serviceType) {
  
  if (!this.initialized) {
    let Client = this.client = yield init(this.jar, serviceType);
    const keys = serviceType === 'offers' ? ['offers', 'offersSoap'] : ['reports', 'reportsSoap'];
    let methods = Object.keys(_.get(this.client.describe(), keys));
    methods.reduce( (self,method) => _.set(self, method, denodeify(Client[method].bind(Client))), this);

    this.initialized = true;
  }
});

function init(jar, serviceType) {
  const rq = request.defaults({jar:jar});
  const WSDL = serviceType === 'offers' ? OFFERS_WSDL : REPORTS_WSDL;
  return new Promise(function(resolve, reject) {
    soap.createClient(WSDL, {request:rq}, function(error, client) {
      if (error) return reject(error);
      resolve(client);
    });
  });
}

module.exports = ShooglooSoapClient;