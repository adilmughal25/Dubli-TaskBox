"use strict";

/*
 * API Documentation: *DA only* http://www.partner-ads.com/dk/udtraek.php?action=visudtraek
 * Documentation requires valid Partner account credentials.
 */

const _ = require('lodash');
const co = require('co');
const request = require('request-promise');
const debug = require('debug')('partnerads:api-client');
const iconv = require('iconv-lite');
const jsonify = require('../support/jsonify-xml-body');
const moment = require('moment');

const API_CFG = {
  url: 'http://www.partner-ads.com/dk/',
  ominto: {
    key: '53456144231849860441',
  },
  dubli: {
    key: '50281138263829750385',
  }
};

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
function PartnerAdsClient(s_entity) {
	if (!(this instanceof PartnerAdsClient)) return new PartnerAdsClient(s_entity);
  if (!s_entity) throw new Error("Missing required argument 's_entity'!");
  if (!API_CFG[s_entity]) throw new Error("Entity '"+s_entity+"' is not defined in API_CFG.");
  debug("Create new client for entity: %s", s_entity);

  this.cfg = API_CFG[s_entity];

  // default request options
  this.client = request.defaults({
    baseUrl: API_CFG.url,
    json: false,
    simple: true,
    resolveWithFullResponse: false,
    encoding: null,
    qs: {
      key: this.cfg.key
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

module.exports = PartnerAdsClient;
