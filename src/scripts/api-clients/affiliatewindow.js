"use strict";

const AFFILIATE_WSDL = 'http://api.affiliatewindow.com/v4/AffiliateService?wsdl';
const ACCOUNT_ID = '238283';
const ACCOUNT_PASSWORD = 'f03fa2315b493b550dc70a8677e97692382d97cbb754bd80';

var soap = require('soap');
var co = require('co');
var denodeify = require('denodeify');
var debug = require('debug')('utils:remoteapi:affiliatewindow');

function AWClient() {
  if (!(this instanceof AWClient)) return new AWClient(); // `new` not required
  this._client = null;
  this.initialized = false;
}

AWClient.prototype.setup = co.wrap(function* () {
  if (!this.initialized) {
    debug("initializing SOAP client");
    this._client = yield init();
    debug("setting up SOAP auth");
    this._client.setSecurity(security());
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

function security() {
  return {
    toXML: function() {
      return (
        '<ns1:UserAuthentication '+
          'SOAP-ENV:mustUnderstand="1" ' +
          'SOAP-ENV:actor="http://api.affiliatewindow.com">' +
          '<ns1:iId>' + ACCOUNT_ID + '</ns1:iId>' +
          '<ns1:sPassword>' + ACCOUNT_PASSWORD + '</ns1:sPassword>' +
          '<ns1:sType>affiliate</ns1:sType>' +
        '</ns1:UserAuthentication>'
      );
    }
  };
}

module.exports = AWClient;
