"use strict";

/*
 * API Documentation: *DA only* http://www.partner-ads.com/dk/udtraek.php?action=visudtraek
 * Documentation requires valid Partner account credentials.
 */

const _ = require('lodash');
const co = require('co');
const request = require('request-promise');
// debugging the requests || TODO: remove after finishing implementation
//require('request-promise').debug = true; 
const debug = require('debug')('partnerads:api-client');
const iconv = require('iconv-lite');
const jsonify = require('./jsonify-xml-body');
const moment = require('moment');

const API_URL = 'http://www.partner-ads.com/dk/';
const API_KEY = '53456144231849860441';
// DubLi Legacy
//const API_KEY = '50281138263829750385';

const API_TYPES = {
  programs: {
    action: "programoversigt_xml.php",  // http://www.partner-ads.com/dk/programoversigt_xml.php?key=53456144231849860441&godkendte=1
    params: {
      godkendte: 1
    }
  },
  commissions: {
    action: "vissalg_xml.php",  // http://www.partner-ads.com/dk/vissalg_xml.php?key=53456144231849860441&fra=14-12-1&til=14-12-31
    params: {
      fra: null,
      til: null
    }
  },
  cancellations: {
    action: "annulleringer_xml.php",  // http://www.partner-ads.com/dk/annulleringer_xml.php?key=53456144231849860441&fra=14-12-1&til=14-12-31
    params: {
      fra: null,
      til: null
    }
  }
};


/**
 * New Class PartnerAdsClient
 * @class
 */
function PartnerAdsClient() {
	if (!(this instanceof PartnerAdsClient)) return new PartnerAdsClient();
  debug("Create new client");

	// default request options
	this.client = request.defaults({
    baseUrl: API_URL,
    json: false,
    simple: true,
    resolveWithFullResponse: false,
    encoding: null,
    qs: {
      key: API_KEY
    },
    headers: {
      accept: "application/xml",
    }
  });
}

/**
 * Abstract API call for all available API Types as defined in API_TYPES.
 * @memberof PartnerAdsClient
 * @param {String} type   Name of type as defined in API_TYPES
 * @param {String} bodyKey  Path to items within nested JSON response
 * @param {Object} params Optional object of params passed through as querystrings to the request
 * @returns [{programid:string, programnavn:string, ...},{}]
 */
PartnerAdsClient.prototype.call = co.wrap(function* (type, bodyKey, params) {
  if(!(type in API_TYPES)) {
    throw new Error("API type "+type+" is not supported by that api.");
  }

  // format dates to API expected format
  params = params || {};
  params.fra = params.fra ? moment(params.fra).format('YY-M-D') : undefined;
  params.til = params.til ? moment(params.til).format('YY-M-D') : undefined;

	let response, arg = {
    url: API_TYPES[type].action,
    qs: _.extend(API_TYPES[type].params, params),
  };

	response = yield this.client.get(arg)
    .then((r) => iconv.decode(r, 'iso-8859-1'))
    .then(jsonify)
    .then(body => _.get(body, bodyKey))
    .then(data => {
      if (!data) return [];
      return _.isArray(data) ? data : [data];
    })
  ;

  return response;
});

module.exports = function() {
  return new PartnerAdsClient();
};
