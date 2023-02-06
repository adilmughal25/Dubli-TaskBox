"use strict";

const _ = require('lodash');
const co = require('co');
const request = require('axios');
const debug = require('debug')('pepperjam:api-client');

const API_CFG = {
  url: 'https://api.pepperjamnetwork.com/',
  version: '20120402',
  ominto: {
    key: 'ecb45b324146cfba7de250119552a84c41d5eb84a6c6703013a892951cbb4e8e',
  },
  dubli: {
    key: 'f0aeadbe7a8f877e5636cb8f4d62c766eb1720702a52911598395d22d4078f90',
  }
};

function PapperJamClient(s_entity) {
  if (!(this instanceof PapperJamClient)) return new PapperJamClient(s_entity);
  if (!s_entity) throw new Error("Missing required argument 's_entity'!");
  if (!API_CFG[s_entity]) throw new Error("Entity '"+s_entity+"' is not defined in API_CFG.");
  debug("Create new client for entity: %s", s_entity);

  this.cfg = API_CFG[s_entity];
  this.rqCount = 0;

  // default request options
  this.client = request.default({
    baseUrl: API_CFG.url + API_CFG.version,
    json: true,
    simple: true,
    resolveWithFullResponse: false,
    qs: {
      apiKey: this.cfg.key,
      format: 'json'
    }
  });
}

PapperJamClient.prototype.getPaginated = co.wrap(function* (url, query) {
  var reqid = "request#" + (++this.rqCount) + "@" + url;
  if (!query) query = {};
  debug("[%s] got paginated get request: %s %o", reqid, url, query||{});

  let page = 1;
  let results = [];
  let body, arg;

  while (true) {
    arg = {
      url: url,
      qs: _.extend({}, query, {page:page})
    };
    debug("[%s] sending paginated request to %o", reqid, arg);

    body = yield this.client.get(arg);
    debug("[%s] result count for page %d: %d", reqid, page, body.data.length);

    results = results.concat(body.data);

    if (++page > body.meta.pagination.total_pages) {
      debug("[%s] done! total items returned: %d", reqid, results.length);
      break;
    }

    debug("[%s] more to go! on page %d of %d", reqid, page, body.meta.pagination.total_pages);
  }

  return results;
});

module.exports = PapperJamClient;
