"use strict";

const request = require('axios');
const querystring = require('querystring');
const debug = require('debug')('performancehorizon:api-client');

const API_CFG = {
  ominto: {
    hostname: 'api.performancehorizon.com',
    apiKey: 'p3tew145y3tag41n',
    userKey: 'xElyiP16',
    publisherId: '1101l317',
  },
  dubli_apple: {
    hostname: 'api.performancehorizon.com',
    apiKey: 'idj0NgJhMQ',
    userKey: 'TyJQtS0J',
    publisherId: '305368'
  },
  dubli_itunes: {
    hostname: 'itunes-api.performancehorizon.com',
    apiKey: 'yyit5mqdd1',
    userKey: 'l1n3cpqj',
    publisherId: '10l9362'
  },
  // BritishAirways
  dubli_ba: {
    hostname: 'api.performancehorizon.com',
    apiKey: 'gb3KsZwx2p',
    userKey: '8zEBlCr7',
    publisherId: '100l1328'
  },
  // WoolWorth
  dubli_ww: {
    hostname: 'api.performancehorizon.com',
    apiKey: 'SOEABGW9XY',
    userKey: 'oJT95Guj',
    publisherId: '1100l183'
  }
};

function PerformanceHorizonApiClient(s_entity) {
  if (!(this instanceof PerformanceHorizonApiClient)) return new PerformanceHorizonApiClient(s_entity);
  if (!s_entity) throw new Error("Missing required argument 's_entity'!");
  if (!API_CFG[s_entity]) throw new Error("Entity '"+s_entity+"' is not defined in API_CFG.");
  debug("Create new client for entity: %s", s_entity);

  this.cfg = API_CFG[s_entity];
  let baseUrl = 'https://' + this.cfg.apiKey + ':' + this.cfg.userKey + '@' + this.cfg.hostname + '/';

  // default request options
  this.client = request.default({
    baseUrl: baseUrl,
    json: true,
    simple: true,
    resolveWithFullResponse: false
  });
  
  this.get = this.client.get; // propagate method public
}

PerformanceHorizonApiClient.prototype.getUrl = function (type, params) {
  if (!params) params = {};
  let url = [];

  if (type === 'merchants') {
    url = [
      'user', 'publisher', this.cfg.publisherId, 'campaign', 'a', 'tracking.json'
    ].join('/');

    return url;
  }

  if (type === 'transactions') {
    let page = params.page ? params.page - 1 : 0;
    let perpage = 300;
    let offset = page * perpage;
    url = [
      'reporting', 'report_publisher', 'publisher', this.cfg.publisherId, 'conversion.json'
    ].join('/') + '?' + querystring.stringify({
      start_date: params.start,
      end_date: params.end,
      'statuses[]': ((!params.status) || params.status === 'all') ? 'approved mixed pending rejected'.split(' ') : params.status,
      limit: perpage,
      offset: offset
    });

    return url;
  }

  throw new Error("Can't build "+type+", "+JSON.stringify(params));
};

module.exports = PerformanceHorizonApiClient;
