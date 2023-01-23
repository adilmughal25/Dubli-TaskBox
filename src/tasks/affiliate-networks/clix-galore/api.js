"use strict";

const _ = require('lodash');
const co = require('co');
let request = import('got');
const debug = require('debug')('clixgalore:api-client');
//const limiter = require('ominto-utils').promiseRateLimiter;
const jsonify = require('../support/jsonify-xml-body');
const spawn = require('child_process').spawn;
const querystring = require('querystring');
const moment = require('moment');

const API_URL = 'http://www.clixgalore.com/';
//const SITE_ID = 278221;
//const API_CID = 232646; // not sure what that param means
// DubLi Legacy
const SITE_ID = 204920;
const API_CID = 163476;

const API_TYPES = {
  affiliateJoinRequests: {
    // AffiliateViewJoinRequests_Export.aspx?AfID=0&CID=232646&RS=1&BT=0&MS=0&EF=xml
    action: 'AffiliateViewJoinRequests_Export.aspx',
    qs: {
      CID: API_CID,
      RS: 1,  // Request Type; 2=Pending Requests, 1=Approved Requests, 0=Declined Requests, 10=All Requests
      BT: 0,  // Banner type; 0=All Banners, 1=Graphic Banners, 2=Text Banners, 3=Flash/HTML Banners
      MS: 0,  // Merchant type; 0=Active Merchants Only, 1=Inactive Merchants Only, 2=Low Balance Merchants Only *Yes its inconsistent with below param values for "MI" :/
      EF: 'xml' // response format
    }
  },
  affiliateLinkCode: {
    // AffiliateViewLinkCode_Export.aspx?AfID=278221&CID=232646&BT=0&MI=1&H=&W=&S=&type=xml
    action: 'AffiliateViewLinkCode_Export.aspx',
    qs: {
      CID: API_CID,
      BT: 0,  // Banner type; 0=All Banners, 1=Graphic Banners, 2=Text Banners, 3=Flash/HTML Banners
      MI: 1,  // Merchant type; 1=Active Merchants Only, 2=All Merchants, 0=Inactive Merchants Only
      type: 'xml'
    }
  },
  coupons: {
    // AffiliateSearchCoupons_Export.aspx?PT=2,4&C=&K=&CID=0&R=0&AfID=278221&ID=232646&JO=1&type=xml
    action: 'AffiliateSearchCoupons_Export.aspx',
    qs: {
      PT: '4',      // Program types; comma list; 4="% Sale", 2="Sale", 3="Lead", 1="Click"
      CID: 0,       // category ids, comma list of or "0" for all
      ID: API_CID,
      JO: 1,        // from merchants we have joined only. 1=yes / 0=no
      type: 'xml',
      // R: 0,      // unknown
      // C: null,   // unknown
      // K: null,   // unknown
    }
  },

  /* Commissions/Sales */
  _transactions: {
    // http://www.clixGalore.com/AffiliateTransactionSentReport_Export.aspx?AfID=278221&ST=1&RP=4&CID=163476&S2=&AdID=0&SD=&ED=&B=2&type=xml
    action: 'AffiliateTransactionSentReport_Export.aspx',
    qs: {
      CID: API_CID,
      AdID: 0,
      //ST: 1,      // 1=Confirmed; 2=Pending; 0=Cancelled
      RP: 3,  	    // Period; 2=Last 7 days; 3=Last 31 days; 4=Last 90 days; 5=Last 1 year; 6=Specific Period
      // S2: null,
      // SD: null,
      // ED: null,
      B: 2, 		    // date filter based on; 1=Based On Approved/cancelled Date; 2=Based On Transaction Date
      type: 'xml',
    }
  },
};

// Short-Cuts for specific Transaction status
_.extend(API_TYPES, {
  transactionsConfirmed:  _.merge({}, API_TYPES._transactions, {qs:{ ST:1 }}),
  transactionsPending:    _.merge({}, API_TYPES._transactions, {qs:{ ST:2 }}),
  transactionsCancelled:  _.merge({}, API_TYPES._transactions, {qs:{ ST:0 }}),
});


function ClixGaloreClient() {
	if (!(this instanceof ClixGaloreClient)) return new ClixGaloreClient();
  debug("Create new client");

	// default request options
	this.client = request.catch({
    baseUrl: API_URL,
    json: false,
    encoding: 'ucs-2',
    resolveWithFullResponse: false,
    qs: {
      AfID: SITE_ID,  // AffiliateId/SiteId - use "0" to get data for all even Ominto currently has only 1
    }
  });

  //limiter.request(this.client, 30, 60).debug(debug);
}

/**
 * Get XML feeds.
 * @param {String} s_type The type of api/feed to request
 * @param {String} s_bodyKey  The body key to deep select from resulting json
 * @param {Object} o_params  Optional params to pass/overwrite to request querystring
 */
ClixGaloreClient.prototype.getFeed = co.wrap(function* (s_type, s_bodyKey, o_params) {
  if (!o_params) o_params = {};
  if (!API_TYPES[s_type]) throw new Error("Unknown ClixGalore api type: " + s_type);
  s_bodyKey = s_bodyKey || 'DocumentElement.ReportData';


  if(o_params.SD) {
    o_params.SD = moment(o_params.SD).format('YYYY-MM-DD');
  }
  if(o_params.ED) {
    o_params.ED = moment(o_params.ED).format('YYYY-MM-DD');
  }

  const arg = {
    url: API_TYPES[s_type].action,
    qs: _.merge({}, API_TYPES[s_type].qs, o_params),
  };

	const body = yield this.client.get(arg).then(jsonify);
	const response = _.get(body, s_bodyKey, []);

  return response;
});

/**
 * workaround for "affiliateJoinRequests"
 * Some (at least 1) of their feeds responds with invalid header, node cant handle and quits with error "Parse Error: HPE_INVALID_CONSTANT".
 * On top of this, ClixGalore provides data in UCS2-LE encoding :/
 * This hack will download the XML feed using curl.
 * Due to heavy and complicated encoding within node, we pass the curl responds directly to linux iconv and encode it into utf8.
 * @param {String} s_type The type of api/feed to request
 * @param {String} s_bodyKey  The body key to deep select from resulting json
 */
ClixGaloreClient.prototype.curlXml = co.wrap(function* (s_type, s_bodyKey) {
  if (!API_TYPES[s_type]) throw new Error("Unknown ClixGalore api type: " + s_type);
  s_bodyKey = s_bodyKey || 'DocumentElement.ReportData';

  let args = _.extend({AfID: SITE_ID}, API_TYPES[s_type].qs);
  let url = API_URL + API_TYPES[s_type].action + '?' + querystring.stringify(args);

  const promise = new Promise( (resolve,reject) => {
    const curlCmd = spawn('/usr/bin/curl', ['-q', url]);
    const iconvCmd = spawn('/usr/bin/iconv', ['-f', 'ucs-2le', '-t', 'utf-8']);
    let data = "";
    let err = "";

    curlCmd.stdout.on('data', d => {iconvCmd.stdin.write(d);} );
    curlCmd.stderr.on('data', d => err += d);
    curlCmd.on('close', (code) => {
      if (code !== 0) return reject('curl exited with status '+code+', errors: '+err);
      iconvCmd.stdin.end();
    });

    iconvCmd.stdout.on('data', d => data += d);
    iconvCmd.stderr.on('data', d => err += d);
    iconvCmd.on('close', function (code) {
      if (code !== 0) return reject('iconv exited with status '+code+', errors: '+err);
      resolve(data);
    });
  });

  const body = yield promise.then(jsonify);
	const response = _.get(body, s_bodyKey, []);

  return response;
});

module.exports = function() {
  return new ClixGaloreClient();
};
