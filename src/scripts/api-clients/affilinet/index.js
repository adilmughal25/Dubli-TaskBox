"use strict";

const _ = require('lodash');
const co = require('co');
const templates = require('./templates');
const request = require('request-promise');
const jsonify = require('../jsonify-xml-body');
const transformKeys = require('transform-keys');
const deep = require('deep');
const deepFreeze = require('deep-freeze');

const CREDENTIALS = deepFreeze({
  uk: { username: '733351', password: 'jXMPR3e4tW7KhOB7LfA4' },
  fr: { username: '740021', password: '' },
  nl: { username: '740024', password: '' },
  de: { username: '', password: '' },
  es: { username: '', password: '' },
  ch: { username: '', password: '' }
});

const CALL_DEFS = {
  login$: {
    url: 'https://api.affili.net/V2.0/Logon.svc',
    action: 'http://affilinet.framework.webservices/Svc/ServiceContract1/Logon',
    template: templates.login
  },
  check$: {
    url: 'https://api.affili.net/V2.0/Logon.svc',
    action: 'http://affilinet.framework.webservices/Svc/AuthenticationContract/GetIdentifierExpiration',
    template: templates.check
  },
  getPrograms: {
    url: 'https://api.affili.net/V2.0/PublisherProgram.svc',
    action: 'http://affilinet.framework.webservices/Svc/PublisherProgramContract/GetMyPrograms',
    template: templates.programs,
    extract: 'ProgramList.Programs.ProgramSummary',
    toArray: true
  },
  _getCreatives_Page: {
    url: 'https://api.affili.net/V2.0/PublisherCreative.svc',
    action: 'http://affilinet.framework.webservices/Svc/PublisherCreativeServiceContract/SearchCreatives',
    template: templates.creatives,
    defaults: {
      page: 1,
      perPage: 100,
      creativeType: 'Text'
    }
  },
  _getVouchers_Page: {
    url: 'https://api.affili.net/V2.0/PublisherInbox.svc',
    action: 'http://affilinet.framework.webservices/Svc/PublisherInboxContract/SearchVoucherCodes',
    template: templates.vouchers,
    defaults: {
      page: 1,
      perPage: 1000,
      status: 'Accepted'
    }
  }
};

const ary = x => _.isArray(x) ? x : [x];

const _cache = {};
function AffiliNet(s_accountId) {
  if (_cache[s_accountId]) return _cache[s_accountId];
  if (!(this instanceof AffiliNet)) return new AffiliNet(s_accountId);
  if (!s_accountId) s_accountId = 'uk';
  if (!CREDENTIALS[s_accountId]) throw new Error("Unknown affili.net account `"+s_accountId+"`! Available accounts: "+Object.keys(CREDENTIALS).join(', '));
  this._client = request.defaults({});
  this._token = undefined;
  this._expires = new Date(0);
  this._credentials = CREDENTIALS[s_accountId];
  this.debug = require('debug')('affilinet:'+s_accountId+':api-client');
  if (!this._credentials.username) throw new Error("Affili.net account `"+s_accountId+"` is missing `username`");
  if (!this._credentials.password) throw new Error("Affili.net account `"+s_accountId+"` is missing `password`");
  _cache[s_accountId] = this;
}

AffiliNet.prototype.ensureLoggedIn = co.wrap(function*() {
  var now = new Date();
  if (this._expires < now) {
    this.debug("Login required! token expired at %s!", this._expires);
    var loginResp = yield this.login$(this._credentials);
    this._token = loginResp.CredentialToken;
    this.debug("Login success: token is %s", this._token);
    var checkResp = yield this.check$({token:this._token});
    this._expires = new Date(Date.parse(checkResp.ExpirationDate));
    this.debug("New token expires at %s", this._expires);
  }
});

AffiliNet.prototype.getCreatives = co.wrap(function* (args) {
  var currentPage = 1;
  var perPage = 100;
  var results = [];
  var totalPages = 'unknown';
  var callArgs, response, collection, total;
  while (true) {
    callArgs = _.extend({}, args, {page:currentPage, perPage:perPage});
    this.debug("fetching creatives page %d of %s", currentPage, totalPages);
    response = yield this._getCreatives_Page(callArgs);
    collection = _.get(response, 'SearchCreativesResponse.CreativeCollection');
    total = _.get(response, 'SearchCreativesResponse.TotalResults') || 0;
    if (totalPages === 'unknown') totalPages = Math.ceil(total/perPage);
    results = results.concat(ary(_.get(collection, 'Creative')));
    if (total < currentPage * perPage) break;
    currentPage += 1;
  }
  this.debug("got %d results, expected %d results", results.length, total);
  return results;
});

AffiliNet.prototype.getVouchers = co.wrap(function* (args) {
  var currentPage = 1;
  var perPage = 1000;
  var results = [];
  var totalPages = 'unknown';
  var callArgs, response, collection, total;
  while (true) {
    callArgs = _.extend({}, args, {page:currentPage, perPage:perPage});
    this.debug("fetching vouchers page %d of %s", currentPage, totalPages);
    response = yield this._getVouchers_Page(callArgs);
    collection = _.get(response, 'SearchVoucherCodesResponse.VoucherCodeCollection');
    total = _.get(response, 'SearchVoucherCodesResponse.TotalResults') || 0;
    if (totalPages === 'unknown') totalPages = Math.ceil(total/perPage);
    results = results.concat(ary(_.get(collection, 'VoucherCodeItem')));
    if (total < currentPage * perPage) break;
    currentPage += 1;
  }
  this.debug("got %d results, expected %d results", results.length, total);
  return results;
});

_.pairs(CALL_DEFS).forEach(function(item) {
  var name = item[0];
  var defs = item[1];
  var special = /\$$/.test(name);
  var template = defs.template;
  AffiliNet.prototype[name] = co.wrap(function*(args) {
    if (!special) {
      yield this.ensureLoggedIn();
      args = _.extend({}, defs.defaults, args, {token:this._token});
    }
    var body = template(args);
    var postArgs = {
      url: defs.url,
      body: body,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': defs.action
      },
      resolveWithFullResponse: true
    };
    this.debug("[%s] POST\n    url    : %s\n    action : %s\n    args   : %j", name, defs.url, defs.action, args);
    var promise = this._client.post(postArgs).then(jsonify).then(rinse);
    if (defs.extract) promise = promise.then(x => _.get(x, defs.extract));
    if (defs.toArray) promise = promise.then(x => ary(x));
    return yield promise;
  });
});

// de-soap the response
var has = key => item => item.hasOwnProperty(key);
function rinse(o_obj) {
  var show = x => console.log(x+" : ", JSON.stringify(o_obj,null,2));
  o_obj = deep.transform(o_obj, has('_'), x => x._);
  o_obj = deep.transform(o_obj, has('$'), x => _.omit(x, '$'));
  o_obj = transformKeys(o_obj, k => k.replace(/^.*:/, ''));
  o_obj = _.get(o_obj, 'Envelope.Body');
  return o_obj;
}

module.exports = AffiliNet;
