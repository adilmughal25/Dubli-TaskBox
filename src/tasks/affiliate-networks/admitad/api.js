"use strict";

/*
 * API Documentation: https://developers.admitad.com/en/doc/api
 * For best results, use datefilter on "status_updated_start" and "status_updated_end".
 * - While testing, i found "declined" status update in 8/2015 from sale dated to 6/2014!!
 */

const _ = require('lodash');
const co = require('co');
const request = require('request-promise');
const debug = require('debug')('admitad:api-client');
const moment = require('moment');
const limiter = require('ominto-utils').promiseRateLimiter;

const API_CFG = {
  url: 'https://api.admitad.com/',
  ominto: {
    clientId: '4f4a18238d260e4c457bd885667949',
    secret: 'e644187aaf8325ef993ead2c618589',
    storeId: 296893,
  },
  dubli: {
    clientId: 'ef607af853e28790fa360daf3f2616',
    secret: '0ccae8ee1cf05bd25cfe1ceba81a96',
    storeId: 98792,
  }
};

// Paths MUST end with /
const API_TYPES_DEFAULTS = {
  token: {
    path: 'token/',
    scope: 'public_data',
    qs: {
      scope: '',
      grant_type: 'client_credentials',
      client_id: '{{clientId}}',
    },
  },
  statistics: {
    path: 'statistics/actions/',
    scope: 'statistics',
    authorization: 'bearer',
    qs: {
      // date_start,
      // date_end,
      order_by: '-id',  // The sign "-" before the value is the reverse order. For example order_by=-clicks&order_by=cr
      total: 0,         // Obtain aggregated data for entire request? 1/0 - aggregated data / non-aggregated
      limit: 250,       // Max is 500
      offset: 0
    }
  },
  merchants: {
    path: 'advcampaigns/website/{{storeId}}/',
    scope: 'advcampaigns_for_website',
  },
  coupons: {
    path: 'coupons/website/{{storeId}}/',
    scope: 'coupons_for_website',
  },
  links: {
    path: _.template('banners/:campaign/website/:store/', {interpolate: /:(\w+)/g}),
    scope: 'banners_for_website'
  }
};

/**
 * New Class AdmitadClient
 * Admitad API requires OAuth2.0 - token with expiration.
 * @class
 */
function AdmitadClient(s_entity) {
  if (!(this instanceof AdmitadClient)) return new AdmitadClient(s_entity);
  if (!s_entity) throw new Error("Missing required argument 's_entity'!");
  if (!API_CFG[s_entity]) throw new Error("Entity '"+s_entity+"' is not defined in API_CFG.");
  debug("Create new client for entity: %s", s_entity);

  this.cfg = API_CFG[s_entity];
	this.token = null;              // the token for re-use
	this.tokenExpires = new Date(); // use token until expired

	// default request options
  this.client = request.defaults({
    baseUrl: API_CFG.url,
    json: true,
    simple: true,
    resolveWithFullResponse: false,
    headers: {
      accept: "application/json"
    }
  });

  this.apiTypes = _.clone(API_TYPES_DEFAULTS, true);
  // fill api_types placeholder with entity dependant auth cfg
  this.apiTypes.token.qs.client_id  = this.apiTypes.token.qs.client_id.replace('{{clientId}}', this.cfg.clientId);
  this.apiTypes.merchants.path      = this.apiTypes.merchants.path.replace('{{storeId}}', this.cfg.storeId);
  this.apiTypes.coupons.path        = this.apiTypes.coupons.path.replace('{{storeId}}', this.cfg.storeId);

  // no limitations knows/documented
  // DEH: Found some. It dies with a 503 if you try to parallelize it fully
  limiter.request(this.client, 10, 1).debug(debug); 
}

/**
 * Computes the list of all api scopes possibly used in one of the calls to apply to the access token permissions.
 * @memberof AdmitadClient
 * @returns {String}
 */
AdmitadClient.prototype.getScope = function() {
  let scope = '';
  let apiTypes = this.apiTypes;

  Object.keys(apiTypes).forEach(function(item, idx) {
    scope += apiTypes[item].scope + ' ';
  });

  return _.trim(scope);
};

/**
 * Retrieve authentication token from Admitad api for any further api calls.
 * @memberof AdmitadClient
 * @returns {String} api auth token
 */
AdmitadClient.prototype.getToken = co.wrap(function* () {
  if (this.token !== null && this.tokenExpires > new Date()) {
    debug("Reusing Auth token: %s", this.token);
    return this.token;
  }

  debug("Get new token");

  let response, body;
  const arg = {
    url: this.apiTypes.token.path,
    auth: {
      username: this.cfg.clientId,
      password: this.cfg.secret,
    },
    qs: _.merge(this.apiTypes.token.qs, {
      scope: this.getScope()
    })
  };

  body = yield this.client.post(arg);
  response = body || {error:-1, error_description:'Unknown error. Empty response body.'};

  if (response.error) {
    throw new Error("Could not get Token for Admitad API requests. Response: [" + response.error + "]" + response.error_description);
  }

  this.token = response.access_token;  // make the new token available for our class
  let expiresInSec = parseInt(response.expires_in) - 60;  // update token expiration in milliseconds -60sec buffer time
  this.tokenExpires = new Date(new Date().getTime() + (expiresInSec * 1000));

  return this.token;
});

/**
 * Fetching all transactions/sales within a specified date period.
 * @memberof AdmitadClient
 * @param {Object} params - The params to pass onto the api call
 * @param {Object} params.startDate - date filter for transactions only AFTER that date
 * @param {Object} params.endDate - date filter for transactions only BEFORE that date
 * @param {Object} params.page - which page to fetch from api
 * @param {Object} params.rows - how many rows/items per page to fetch
 * @returns {Object[]}
 */
// TODO: Refactor to use this.executeRequest
AdmitadClient.prototype.getStatisticsByAction = co.wrap(function* (params) {
	let response, body;
  const arg = {
    url: this.apiTypes.statistics.path,
    auth: {},
    qs: {
      limit: this.apiTypes.statistics.rows,
      page: 1,
    }
  };

  // require at least 1 set of dates
  if(params.date_start === undefined && params.date_end === undefined && params.status_updated_start === undefined && params.status_updated_end === undefined) {
    throw new Error("Invalid request. Please specify a date filter with param pair (date_start & date_end) or (status_updated_start & status_updated_end).");
  }

  // format dates to API expected format
  params.date_start = params.date_start ? moment(params.date_start).format('DD.MM.YYYY') : undefined;
  params.date_end = params.date_end ? moment(params.date_end).format('DD.MM.YYYY'): undefined;
  params.status_updated_start = params.status_updated_start ? moment(params.status_updated_start).format('DD.MM.YYYY 00:00:00') : undefined;
  params.status_updated_end = params.status_updated_end ? moment(params.status_updated_end).format('DD.MM.YYYY HH:mm:ss'): undefined; // API validates that date/time isnt in future!

	// make sure we have a valid token for next request
	yield this.getToken();

  // merge our passed params into the querystring
  _.extend(arg.qs, params);
  // set the authentication type and value
  arg.auth[this.apiTypes.statistics.authorization] = this.token;

  debug("Using token '%s' to fetch statistics by commission between %s and %s", this.token, params.date_start || params.status_updated_start, params.date_end || params.status_updated_end);

	body = yield this.client.get(arg);
	response = body || {};

	return response;
});

AdmitadClient.prototype.getMerchants = co.wrap(function* (params) {
  let body = yield this.executeRequest('merchants', params);
  return body || {};
});

AdmitadClient.prototype.getCoupons = co.wrap(function* (params) {
  let body = yield this.executeRequest('coupons', params);
  return body || {};
});

AdmitadClient.prototype.getLinks = co.wrap(function* (params) {
  let fixedPath = this.apiTypes.links.path({campaign: params.id, store: this.cfg.storeId});
  let arg = {
    url: fixedPath,
    simple: false,
    qs: params,
    resolveWithFullResponse: true
  };

  yield this.getToken();
  _.set(arg, 'auth.bearer', this.token);

  debug("Using token '%s' to fetch links for campaign '%s'", this.token, params.id);

  let resp = yield this.client.get(arg);
  return (resp.statusCode !== 200 || resp.body.error) && {} || resp.body;
});

AdmitadClient.prototype.executeRequest = co.wrap(function* (type, params) {
  let body;
  const arg = {
    url: this.apiTypes[type].path,
    auth: {},
    qs: params
  };

  yield this.getToken();
  arg.auth.bearer = this.token;

  debug("Using token '%s' to fetch '%s'", this.token, type);

  body = yield this.client.get(arg);
  return body || {};
});

module.exports = AdmitadClient;
