"use strict";

const _ = require('lodash');
const co = require('co');
const request = require('request-promise');
// debugging the requests || TODO: remove after finishing implementation
require('request-promise').debug = true; 
const debug = require('debug')('clixgalore:api-client');
const limiter = require('ominto-utils').promiseRateLimiter;
const jsonify = require('./jsonify-xml-body');

const ary = x => x ? (_.isArray(x) ? x : [x]) : [];

const API_URL = 'http://www.clixgalore.com/';
const SITE_ID = 278221;
const API_CID = 232646; // not sure what that param means

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
};

function ClixGaloreClient() {
	if (!(this instanceof ClixGaloreClient)) return new ClixGaloreClient();
  debug("Create new client");

	// default request options
	this.client = request.defaults({
    baseUrl: API_URL,
    json: true,
    encoding: 'ucs-2',
    resolveWithFullResponse: true,
    qs: {
      AfID: SITE_ID,  // AffiliateId/SiteId - use "0" to get data for all even Ominto currently has only 1
    }
  });

  //limiter.request(this.client, 1, 2).debug(debug);
}

ClixGaloreClient.prototype.getFeed = co.wrap(function* (s_type, bodyKey) {
  if (!API_TYPES[s_type]) throw new Error("Unknown ClixGalore api type: " + s_type);
  bodyKey = bodyKey || 'DocumentElement.ReportData';

  const arg = {
    url: API_TYPES[s_type].action,
    qs: API_TYPES[s_type].qs
  };

	const body = yield this.client.get(arg).then(jsonify);
	const response = _.get(body, bodyKey, []);

  return response;
});

module.exports = function() {
  return new ClixGaloreClient();
};
