"use strict";

var _ = require('lodash');
var co = require('co');
var request = require('request-promise');
var debug = require('debug')('pepperjam:api-client');

const API_URL     = 'https://api.pepperjamnetwork.com/';
const API_VERSION = '20120402';
const API_KEY     = 'ecb45b324146cfba7de250119552a84c41d5eb84a6c6703013a892951cbb4e8e';
//const API_KEY     = 'f0aeadbe7a8f877e5636cb8f4d62c766eb1720702a52911598395d22d4078f90'; // DubLi-Legacy

function createClient() {
  var baseUrl = API_URL + API_VERSION;
  var baseQuery = {
    apiKey: API_KEY,
    format: 'json'
  };
  var client = request.defaults({
    baseUrl: baseUrl,
    json: true,
    simple: true,
    resolveWithFullResponse: false,
    qs: baseQuery
  });
  var _id = 0;
  client.getPaginated = co.wrap(function* (url, query) {
    var reqid = "request#" + (++_id) + "@" + url;
    if (!query) query = {};
    debug("[%s] got paginated get request: %s %o", reqid, url, query||{});
    var page = 1;
    var results = [];
    var body, arg;
    while (true) {
      arg = {
        url: url,
        qs: _.extend({}, baseQuery, query, {page:page})
      };
      debug("[%s] sending paginated request to %o", reqid, arg);
      body = yield client.get(arg);
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
  return client;
}

module.exports = createClient;
