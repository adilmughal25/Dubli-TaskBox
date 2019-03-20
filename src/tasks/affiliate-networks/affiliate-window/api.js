"use strict";

const soap = require('soap');
const co = require('co');
const denodeify = require('denodeify');
const debug = require('debug')('affiliatewindow:api-client');
const request = require('request-promise');
const converter = require("csvtojson").Converter;
const _ = require('lodash');

const AFFILIATE_WSDL = 'http://api.affiliatewindow.com/v4/AffiliateService?wsdl';
const API_CFG = {
  ominto: {
    user: '238283',
    pass: 'f03fa2315b493b550dc70a8677e97692382d97cbb754bd80',
  },
  dubli: {
    user: '128635',
    pass: '439ac8c4ce3ad090fa3b22776fa9b6eaca9ccf95165da46c',
  }
};

function AWClient(s_entity) {
  if (!(this instanceof AWClient)) return new AWClient(s_entity); // `new` not required

  if (!s_entity) throw new Error("Missing required argument 's_entity'!");
  if (!API_CFG[s_entity]) throw new Error("Entity '"+s_entity+"' is not defined in API_CFG.");
  debug("Create new client for entity: %s", s_entity);

  this.cfg = API_CFG[s_entity];
  this._client = null;
  this.initialized = false;
}

AWClient.prototype.getDeals = function*() {
  var csvConverter = new converter({});

  const apiClient = request.defaults({
    baseUrl: 'https://ui.awin.com/',
    resolveWithFullResponse: true,
    json: true
  });
    // https://ui.awin.com/export-promotions/238283/e55af278629a6336549b016ba817299d?downloadType=json&membershipStatus=joined
    //const apiUrl = 'export-promotions/238283/e55af278629a6336549b016ba817299d?downloadType=json&promotionType=&categoryIds=&regionIds=11&advertiserIds=&membershipStatus=&promotionStatus=';
    const apiUrl = 'export-promotions/238283/e55af278629a6336549b016ba817299d?downloadType=json&membershipStatus=joined';
    debug('GET ' + apiUrl);

    const apiResponse = yield apiClient.get(apiUrl)
      .then(resp => {
        return resp.body && resp.body ? resp.body : []
      });

      return new Promise(function(resolve, reject) {
        var csvConverter = new converter({});
          csvConverter.fromString(apiResponse,function(err,result){

                if(err){
                    console.log(err);
                    reject();
                }

                resolve(result);
            });
      });
}


AWClient.prototype.setup = co.wrap(function* () {
  if (!this.initialized) {
    debug("initializing SOAP client");
    this._client = yield init();
    debug("setting up SOAP auth");
    this._client.setSecurity(security(this.cfg));
    var methods = Object.keys(this._client.describe().ApiService.ApiPort);
    for (var i = 0; i < methods.length; i++) {
      var method = methods[i];
      debug("registering api call %s", method);
      var func = this._client[method].bind(this._client);
      this[method] = denodeify(func);
    }
    this.initialized = true;
    debug("client setup complete");
  }
  return this._client;
});

function init() {
  return new Promise(function(resolve, reject) {
    soap.createClient(AFFILIATE_WSDL, function(error, client) {
      if (error) {
        return reject(error);
      }
      resolve(client);
    });
  });
}

function security(o_cfg) {
  return {
    toXML: function() {
      return (
        '<ns1:UserAuthentication '+
          'SOAP-ENV:mustUnderstand="1" ' +
          'SOAP-ENV:actor="http://api.affiliatewindow.com">' +
          '<ns1:iId>' + o_cfg.user + '</ns1:iId>' +
          '<ns1:sPassword>' + o_cfg.pass + '</ns1:sPassword>' +
          '<ns1:sType>affiliate</ns1:sType>' +
        '</ns1:UserAuthentication>'
      );
    }
  };
}

module.exports = AWClient;
