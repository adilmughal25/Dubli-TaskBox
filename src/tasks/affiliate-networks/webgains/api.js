"use strict";

/*
 * Webgains API client for their RESTful API.
 * Used for merchant information only. See "webgainsSoap.js" for SOAP API client to get commission information.
 * 
 * API Documentation: 
 *    Voucher code API  : http://www.webgains.fr/newsletter/images/VoucherCode_API_v2.pdf
 *    Offers API  : http://www.webgains.fr/newsletter/images/Offers_API_Publisher.pdf
 *    Banners API : http://www.webgains.fr/newsletter/images/ADS_API-en.pdf
 *    Program API : http://www.webgains.fr/newsletter/images/Programs_API-en.pdf
 *
 * TODO: Instead of usign transaction API, you can use the call back script : http://www.webgains.fr/newsletter/images/Callback_script.pdf
 */

const co = require('co');
const request = require('request-promise');
const debug = require('debug')('webgains:api-client');

const API_CFG = {
  url: 'http://api.webgains.com/2.0',
  ominto: {
    key: '96069aeda4817545eb3ad17641e68899',
    campaignId: 177143,
  }
};

function WebgainsClient(s_entity) {
  if (!(this instanceof WebgainsClient)) return new WebgainsClient(s_entity);
  if (!s_entity) throw new Error("Missing required argument 's_entity'!");
  if (!API_CFG[s_entity]) throw new Error("Entity '"+s_entity+"' is not defined in API_CFG.");
  debug("Create new client for entity: %s", s_entity);

  this.cfg = API_CFG[s_entity];

  // default request options
  this.client = request.defaults({
    baseUrl: API_CFG.url,
    qs: {
      key: this.cfg.key
    },
    json: true,
    resolveWithFullResponse: false
  });
}

// http://api.webgains.com/2.0/programs?key=96069aeda4817545eb3ad17641e68899&programsjoined=1
WebgainsClient.prototype.getMerchants = co.wrap(function* () {
  let that = this;
  let body = yield this.client.get({
    url: 'programs',
    qs: {
      key: that.cfg.key,
      programsjoined: 1
    }
  });

  return body || [];
});

// http://api.webgains.com/2.0/vouchers?key=96069aeda4817545eb3ad17641e68899&joined=1
WebgainsClient.prototype.getCoupons = co.wrap(function* () {
  let that = this;
  let body = yield this.client.get({
    url: 'vouchers',
    qs: {
      key: that.cfg.key,
      joined: 1
    }
  });

  return body || [];
});

// http://api.webgains.com/2.0/offers?key=96069aeda4817545eb3ad17641e68899&campaignId=177143&filters={"showexpired":"false", "filterby":"PROGRAMS_JOINED"}
WebgainsClient.prototype.getOffers = co.wrap(function* () {
  let that = this;
  let body = yield this.client.get({
    url: 'offers',
    qs: {
      key: that.cfg.key,
      campaignId: that.cfg.campaignId,
      // TODO@ append qith querystring - bad required value format => filters: '{"showexpired":"false", "filterby":"PROGRAMS_JOINED"}',
    }
  });

  return body || [];
});

// http://api.webgains.com/2.0/publisher/ads?key=96069aeda4817545eb3ad17641e68899&campaignId=177143&joined=joined&filters={"media_type":["text"]}
// *is currently returning empty page
WebgainsClient.prototype.getAds = co.wrap(function* () {
  let that = this;
  let body = yield this.client.get({
    url: 'publisher/ads',
    qs: {
      key: that.cfg.key,
      campaignId: that.cfg.campaignId,
      joined: 'joined',
      filters: '{"media_type":["text"]}'
    }
  });

  return body || [];
});

module.exports = WebgainsClient;
