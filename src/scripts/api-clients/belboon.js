"use strict";

const WSDL_URL = 'http://smartfeeds.belboon.com/SmartFeedServices.php?wsdl';
const API_USERNAME = 'Ominto';
const API_PASSWORD = 'iLukiDXmA33eJAdlSiLe';

const _ = require('lodash');
const co = require('co');
const denodeify = require('denodeify');
const soap = require('soap');

const ary = x => _.isArray(x) ? x : [x];

/*
 * API docs: https://ui.belboon.de/ShowWebservicesOverview,MID.88/DoHandleWebservicesOverview.en.html
 * Have to guess on these API calls. doesn't look like we have offers/cashbacks in this api, for now
 * all we can implement are merchants (and getting the list of categories).
 *
 * getPlatforms        : returns info about us
 *
 * getFeeds            : this looks like merchant data, YAY!
 * getFeedUpdate       : no effing clue what this is yet
 *
 * getProductData      : product feed for later
 * searchProducts
 * getProductById
 * searchProductsByEan
 *
 * getCategory
 * getCategories
 * getCategoryPath
 */

function BelboonClient() {
  if (!(this instanceof BelboonClient)) return new BelboonClient();
  this._initialized = false;
}

BelboonClient.prototype.args = function(o_obj) {
  return _.extend({}, o_obj, {sSessionHash:this._authKey});
};

BelboonClient.prototype.extractKeyVal = function(entry) {
  return ary(entry).reduce((memo, item) => _.set(memo, item.key.$value, item.value.$value), {});
};

BelboonClient.prototype.setup = co.wrap(function* () {
  if (this._authKey) return;
  const self = this;

  this._client = yield init();
  const defs = this._client.describe().SmartFeedServices.SmartFeedServicesPort;
  const keys = Object.keys(defs);
  keys.forEach(key => self['_'+key] = denodeify(self._client[key].bind(self._client)));
  const creds = {sUsername: API_USERNAME, sPassword: API_PASSWORD};
  const loginResponseRaw = yield this._login(creds);
  const loginResponse = this.extractKeyVal(loginResponseRaw.login.Records.item);
  this._authKey = loginResponse.sessionHash;
});

BelboonClient.prototype.getMerchants = co.wrap(function* () {
  yield this.setup();
  const self = this;
  const args = this.args();
  const feedsResponseRaw = yield this._getFeeds(args);
  const feedsResponse = ary(feedsResponseRaw.getFeeds.Records.item);
  const merchants = feedsResponse.map(entry => self.extractKeyVal(entry.item));
  return merchants;
});

BelboonClient.prototype.getCategories = co.wrap(function* () {
  yield this.setup();
  const self = this;
  const args = this.args();
  const catsResponseRaw = yield this._getCategories(args);
  const catsResponse = ary(catsResponseRaw.getCategories.Records.item);
  const cats = catsResponse.map(entry => self.extractKeyVal(entry.item));
  return cats;
});

function init() {
  return new Promise( (resolve, reject) => {
    soap.createClient(WSDL_URL, function(err, client) {
      if (err) return reject(err);
      resolve(client);
    });
  });
}

module.exports = BelboonClient;
