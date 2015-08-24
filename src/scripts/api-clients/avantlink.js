"use strict";

const _ = require('lodash');
const debug = require('debug')('avantlink:api-client');
const denodeify = require('denodeify');
const querystring = require('querystring');
const request = require('request-promise');
const jsonify = require('./jsonify-xml-body');
const limiter = require('ominto-utils').promiseRateLimiter;
// debugging the requests || TODO: remove after finishing implementation
//require('request-promise').debug = true; 

const API_CREDENTIALS = {
  us: {
    baseUrl: 'https://classic.avantlink.com/api.php',
    authKey: '401dc5ad219d787ee5ff88d38872c8d5',
    affiliateId: 147618,
    websiteId: 183130
  },
  ca: {
    baseUrl: 'https://classic.avantlink.ca/api.php',
    authKey: '486155f4cb679938e970330b6a620df8',
    affiliateId: 150082,
    websiteId: 186354
  }
};

const API_TYPES = {
  merchants: {
    module: 'AssociationFeed',
    limit: [500, 84600], // 500 requests per day max
    defParams: {
      output: 'json',
      association_status: 'active'
    }
  },
  promos: {
    module: 'AdSearch',
    limit: [6000, 3600], // 7200 request(s) per hour. 150000 request(s) per day.
    defParams: {
      output: 'xml',
      search_results_sort_order: 'Merchant Id',
      show_contextual_analysis: 0,
      show_ad_relevance: 0,
      ad_type: '',  //  "dotd-html" (Deal of the Day-DynHTML), "dotd-text" (DotD-DynText), flash, html, image, text, and video. Default is to return all.
    }
  }
};

function avantLinkClient(s_region) {
  if (!s_region) s_region = 'us';
  if (!API_CREDENTIALS[s_region]) throw new Error("Unknown AvantLink region: "+s_region);

  var creds = API_CREDENTIALS[s_region];

  // default request options
  var client = request.defaults({
    uri: creds.baseUrl,
    json: true,
    simple: true,
    resolveWithFullResponse: false,
    qs: {
      affiliate_id: creds.affiliateId,
      auth_key: creds.authKey,
      website_id: creds.websiteId
    }
  });

  client.getMerchants = function() {
    let arg = {
      json: (API_TYPES.merchants.defParams.output == 'json' ? true : false),
      qs: _.merge({}, API_TYPES.merchants.defParams, {
        module: API_TYPES.merchants.module,
    })};

    return client.get(arg);
  };

  client.getPromotions = function() {
    let arg = {
      json: (API_TYPES.promos.defParams.output == 'json' ? true : false),
      qs: _.merge({}, API_TYPES.promos.defParams, {
        module: API_TYPES.promos.module
    })};

    let result = client.get(arg)
      .then(jsonify)
      .then(data => data.NewDataSet.Table1)
    ;

    return result;
  };

  return client;
}

module.exports = avantLinkClient;
