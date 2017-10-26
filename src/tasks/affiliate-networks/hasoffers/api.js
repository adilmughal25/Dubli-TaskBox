"use strict";

const _ = require('lodash');
const request = require('request-promise');
const qs = require('querystring');
const limiter = require('ominto-utils').promiseRateLimiter;

const API_CFG = {
  url: 'https://api.hasoffers.com/',
  ominto: {
    vcommission: {
      api_key: '669ba8e6d46a319e67e21f529cd9f78bd27f99322c6c9c40e0f250588d1e2959',
      NetworkId: 'vcm',
      defaultCurrency: 'inr'
    },
    snapdeal: {
      api_key: 'a95b73344703625919998f1bc7c419185207e8566b682faf777e013caef1c438',
      NetworkId: 'jasper',
      defaultCurrency: 'inr'
    },
    shopstylers: {
      api_key: '5fae392de6f20a7199d2fe97f4b0e382acafc6d49e01eb84baccebacbc109ba6',
      NetworkId: 'sscpa',
      defaultCurrency: 'myr'
    },
    arabyads: {
      api_key: '2f4b194614629ed6fdb455104523d571b4d30f4b8df95eb89b8efbd12ce664c8',
      NetworkId: 'arabyads',
      defaultCurrency: 'usd'
    },
    levant: {
      api_key: 'b2ebc7bbc187fc46b66ee7bc4a7874bf9094c6c90673585c67502be15174e112',
      NetworkId: 'levantnetwork',
      defaultCurrency: 'usd'
    },    
    vcommissionmena: {
      api_key: 'b1966d15862f36e1bf5626e3b9062562ff01639208046fff7e69b8f5a03162c2',
      NetworkId: 'vcm',
      defaultCurrency: 'usd'
    }
  },
  dubli: {
    vcommission: {
      api_key: 'e487d197537331bdb175649fee124b0e4d6bbde1a2389ecd9ed2bf045192e604',
      NetworkId: 'vcm',
      defaultCurrency: 'inr'
    }
  }
};

const HasOfferClient = function(s_entity, s_networkName) {
  if (!(this instanceof HasOfferClient)) return new HasOfferClient(s_entity, s_networkName);
  if (!s_entity) throw new Error("Missing required argument 's_entity'!");
  if (!s_networkName) throw new Error("Missing required argument 's_networkName'!");
  if (!API_CFG[s_entity]) throw new Error("Unknown HasOffer entity `"+s_entity+"`!");
  if (!API_CFG[s_entity][s_networkName]) throw new Error("Unknown HasOffer network `"+s_networkName+"` for entity `"+s_entity+"`! Available accounts: "+Object.keys(API_CFG[s_entity]).join(', '));

  const debug = require('debug')('hasoffer:'+s_entity+':'+s_networkName+':api-client');
  const that = this;

  this._credentials = _.omit(API_CFG[s_entity][s_networkName], 'defaultCurrency');
  this._defaultCurrency = API_CFG[s_entity][s_networkName].defaultCurrency;
  this.client = request.defaults({
    baseUrl: API_CFG.url,
    json: true,
    qs: this._credentials
  });

  // API usage exceeded rate limit.  Configured: 50/10s window; Your usage: 51.  See http://support.hasoffers.com/hc/en-us/articles/203306816-Rate-Limit-Error for guidance.
  limiter.request(this.client, 5, 1).debug(debug);
  _.extend(this.client, this._credentials);

  this.url = function urlMaker(s_target, s_method, params) {
    let args = _.extend({
      Target: s_target,
      Method: s_method
    }, this._credentials, params);

    return 'Apiv3/json?' + qs.stringify(args);
  };

  this.addCurrencies = function(a_entries) {
    return a_entries.map(entry => {
      if (!entry.currency) {
        return _.set(entry, 'currency', that._defaultCurrency);
      }
      return entry;
    });
  };

  // expose
  this.get = this.client.get;
};

module.exports = HasOfferClient;
