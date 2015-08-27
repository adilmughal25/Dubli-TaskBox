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
const moment = require('moment');

const API_CREDENTIALS = {
  us: {
    baseUrl: 'https://classic.avantlink.com/api.php',
    authKey: '401dc5ad219d787ee5ff88d38872c8d5',
    affiliateId: 147618,
    websiteId: 183130
    // DubLi Legacy
    //authKey: '22981e932ff2a495d7f688418444cdc1',
    //affiliateId: 118181,
    //websiteId: 141173
  },
  ca: {
    baseUrl: 'https://classic.avantlink.ca/api.php',
    authKey: '486155f4cb679938e970330b6a620df8',
    affiliateId: 150082,
    websiteId: 186354
  }
};

const API_TYPES = {
  // all our merchant info
  merchants: {
    module: 'AssociationFeed',
    limit: [500, 84600], // 500 requests per day max
    defParams: {
      output: 'json',
      association_status: 'active'
    }
  },
  // any kind of promotions per merchant
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
  },
  // commissions/transactions/sales
  commissions: {
    module: 'AffiliateReport',
    limit: [41, 3600], // 41 per hours <= 1000 request(s) per day.
    defParams: {
      output: 'xml',
      report_id: 8, // Sales/Commissions (Detail)
	    date_begin: getDateFormatted(-14),
      date_end: getDateFormatted(0),
	    include_inactive_merchants:1,
      search_results_include_cpc:0
    }
  }
};

/**
 * Wrapper Class to provide a Pool of clients exposed to our api client.
 * As each API type has its own limitations and URI to get data from, we can leverage higher async performance when
 * instantiating multiple clients per Region and Method, each with its own request limits.
 */
const avantLinkClientPool = {
  activeClients: {},

  /**
   * Getting/Creating a new client for specified region and type. Creates new client, if no active client available.
   * @param {String} s_region   The region to fetch data for. "us" or "ca" as defined in API_CREDENTIALS[<region>]
   * @param {String} s_type     What type of api request to get a client for - mapping to the API methods as defined in API_TYPES[<type>]
   * @returns {Object} avantLinkClient.client
   */
  getClient: function(s_region, s_type) {
    if (!s_region) s_region = 'us';
    if (!API_CREDENTIALS[s_region]) throw new Error("Unknown AvantLink region: " + s_region);
    if (!API_TYPES[s_type]) throw new Error("Unknown AvantLink api type: " + s_type);

    let _tag = s_region + '-' + s_type;
    if (this.activeClients[_tag]) {
      debug("Using active client with tag [%s]", _tag);
      return this.activeClients[_tag];
    }

    this.activeClients[_tag] = avantLinkClient(s_region, s_type);

    return this.activeClients[_tag];
  }
};

/**
 * The actual client setup.
 * @param {String} s_region   The region to fetch data for. "us" or "ca" as defined in API_CREDENTIALS[<region>]
 * @param {String} s_type     What type of api request to get a client for - mapping to the API methods as defined in API_TYPES[<type>]
 * @returns {Object} client
 */
function avantLinkClient(s_region, s_type) {
  let _prefix = s_region + '-' + s_type;
  debug("Create new client for region [%s] and method [%s]", s_region, s_type);

  var creds = API_CREDENTIALS[s_region];
  var cfg = API_TYPES[s_type];

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

  client.getData = function(o_params) {
    debug("getting data from api module [%s]", cfg.module);
    o_params = o_params || {};
    let result, arg = {
      json: (cfg.defParams.output == 'json' ? true : false),
      qs: _.merge({}, cfg.defParams, {
        module: cfg.module,
    }, o_params)};

    switch(cfg.module) {
      default:
      case 'AssociationFeed':
        result = client.get(arg);
        break;
      case 'AdSearch':
      case 'AffiliateReport':
        result = client.get(arg)
          .then(jsonify)
          .then(data => data.NewDataSet.Table1)
        ;
        break;
    }

    return result;
  };

  if (cfg.limit) {
    limiter.request(client, cfg.limit[0], cfg.limit[1]).debug(debug, _prefix);
  }

  return client;
}

/**
 * Function getDateFormatted
 * Returns a formatted date as string while optionally add {addDays} number of days to todays date.
 * Little helper for API Request with dates in specific format.
 * @param {Number} addDays  Optional number of days to add/substract from today/now.
 * @param {String} format  The format to return the date - use node-moment formatting syntax. Default: YYYY-MM-DD HH:mm:ss
 * @returns {String}
 */
function getDateFormatted(addDays, format) {
  addDays = addDays || 0;
  format = format || 'YYYY-MM-DD HH:mm:ss';

  let _date = new Date();
  _date.setDate(_date.getDate() + addDays);

  return moment(_date).format(format);
}

module.exports = avantLinkClientPool;
