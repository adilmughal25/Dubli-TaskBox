"use strict";

/*
 * API Documentation: https://developers.admitad.com/en/doc/api
 */

const _ = require('lodash');
const co = require('co');
const request = require('request-promise');
// debugging the requests || TODO: remove after finishing implementation
//require('request-promise').debug = true; 
const debug = require('debug')('admitad:api-client');
const moment = require('moment');
const limiter = require('ominto-utils').promiseRateLimiter;

const API_URL           = 'https://api.admitad.com/';
//const API_CLIENT_ID     = '4f4a18238d260e4c457bd885667949';
//const API_CLIENT_SECRET = 'e644187aaf8325ef993ead2c618589';
// DubLi Legacy
const API_CLIENT_ID     = 'ef607af853e28790fa360daf3f2616';
const API_CLIENT_SECRET = '0ccae8ee1cf05bd25cfe1ceba81a96';

const API_TYPES = {
  token: {
    path: 'token/',
    scope: 'public_data',
    qs: {
      scope: '',
      grant_type: 'client_credentials',
      client_id: API_CLIENT_ID,
    },
  },
  statistics: {
    path: 'statistics/actions/',
    scope: 'statistics',
    authorization: 'bearer',
    qs: {
      //date_start,
      //date_end,
      order_by: '-id',  // The sign "-" before the value is the reverse order. For example order_by=-clicks&order_by=cr
      total: 0,         // Obtain aggregated data for entire request? 1/0 - aggregated data / non-aggregated
      limit: 250,
      offset: 0
    }
  },
};

/**
 * New Class AdmitadClient
 * Admitad API requires OAuth2.0 - token with expiration.
 * @class
 */
function AdmitadClient() {
	if (!(this instanceof AdmitadClient)) return new AdmitadClient();
  debug("Create new client");

	this.token = null;              // the token for re-use
	this.tokenExpires = new Date(); // use token until expired

	// default request options
	this.client = request.defaults({
    baseUrl: API_URL,
    json: true,
    simple: true,
    resolveWithFullResponse: false,
    headers: {
      accept: "application/json"
    }
  });

  //limiter.request(this.client, 1, 2).debug(debug);
}

AdmitadClient.prototype.getScope = function() {
  let scope = '';

  Object.keys(API_TYPES).forEach(function(item, idx) {
    scope += API_TYPES[item].scope + ' ';
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

  let response, body, arg = {
    url:  API_TYPES.token.path,
    qs:   _.merge(API_TYPES.token.qs, {
      scope: this.getScope()
    })
  };

  body = yield this.client.post(arg).auth(API_CLIENT_ID, API_CLIENT_SECRET, true);
  response = body || {};

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
AdmitadClient.prototype.getStatisticsByAction = co.wrap(function* (params) {
	let response, body, arg = {
    url: API_TYPES.statistics.path,
    auth: {},
    qs: {
      limit: API_TYPES.statistics.rows,
      page: 1,
      date_start: new Date(),
      date_end: new Date(),
    }
  };

  // format dates to API expected format
  params.date_start = params.date_start ? moment(params.date_start).format('DD.MM.YYYY') : arg.qs.date_start;
  params.date_end = params.date_end ? moment(params.date_end).format('DD.MM.YYYY'): arg.qs.date_end;

	// make sure we have a valid token for next request
	yield this.getToken();

  // merge our passed params into the querystring
  _.extend(arg.qs, params);
  // set the authentication type and value
  arg.auth[API_TYPES.statistics.authorization] = this.token;

  debug("Using token '%s' to fetch statistics by commission between %s and %s", this.token, arg.qs.date_start, arg.qs.date_end);

	body = yield this.client.get(arg);
	response = body || {};

	return response;
});

module.exports = function() {
  return new AdmitadClient();
};
