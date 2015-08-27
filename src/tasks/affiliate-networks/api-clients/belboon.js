"use strict";

const WSDL_URL = 'http://smartfeeds.belboon.com/SmartFeedServices.php?wsdl';
const API_USERNAME = 'Ominto';
const API_PASSWORD = 'iLukiDXmA33eJAdlSiLe';
const DEAL_FEED_URL = 'http://ui.belboon.com/export/vouchercodes/?key=747109e8583d52fbaa39b3b98a3d4838&platformid=598628&status=partnership&format=xml';

const _ = require('lodash');
const co = require('co');
const denodeify = require('denodeify');
const soap = require('soap');
const request = require('request-promise');
const utils = require('ominto-utils');
const piggyback = utils.promisePiggyback;
const check = utils.checkApiResponse;
const jsonify = require('./jsonify-xml-body');

const ary = x => _.isArray(x) ? x : [x];

/*
 * API docs: https://ui.belboon.de/ShowWebservicesOverview,MID.88/DoHandleWebservicesOverview.en.html
 * Have to guess on these API calls because documentation is sparse. Deals don't
 * go through this API, they just have an xml download link (above).
 *
 * getPlatforms        : returns info about us
 *
 * getFeeds            : this looks like merchant data, but does not return the canonical ProgramID
 * getFeedUpdate       : this seems to just tell you the last time the feed was updated
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

  // for soap calls
  this._client = null;
  this._authKey = null;

  // for non-soap calls
  this._request = request.defaults({
    resolveWithFullResponse: true
  });
}

BelboonClient.prototype.args = function(o_obj) {
  return _.extend({}, o_obj, {sSessionHash:this._authKey});
};

BelboonClient.prototype.extractKeyVal = function(entry) {
  return ary(entry).reduce((memo, item) => _.set(memo, item.key.$value, item.value.$value), {});
};

BelboonClient.prototype.setup = piggyback(co.wrap(function* () {
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
}));

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

BelboonClient.prototype.getDeals = co.wrap(function*() {
  const _chk = check('2XX', 'Could not fetch deals');
  const result = yield this._request.get(DEAL_FEED_URL).then(_chk).then(jsonify);
  const deals = ary(result.Ads_Voucher_code.Ad_Voucher_code);
  return deals;
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
