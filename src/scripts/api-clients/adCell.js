"use strict";

/*
 * API Documentation: https://www.adcell.de/api/v2/
 */

var _ = require('lodash');
var co = require('co');
var request = require('request-promise');
var debug = require('debug')('adcell:api-client');

const API_URL      = 'https://www.adcell.de/api/v2/';
const API_USERID   = '205737';
const API_PASSWORD = 'HF&239gj(VF23i7Fsrn%238';

var API_TYPES = {
  user: {
    path: "user/"               // https://www.adcell.de/api/v2/user/getToken?userName=*****&password=*****
  },
  program: {
    path: "affiliate/program/", // https://www.adcell.de/api/v2/affiliate/program/export?affiliateStatus=accepted&token=*****
    rows: 50                    // num rows to fetch pare page (per request); default is 25
  }
};

/**
 * New Class AdCellClient
 * AdCell API requires a token for any request. This token has to be requested in a initial call and is valid for 15minutes.
 * @class
 */
function AdCellClient() {
	if (!(this instanceof AdCellClient)) return new AdCellClient();

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
}

/**
 * Retrieve authentication token from AdCell api for any further api calls.
 * @memberof AdCellClient
 * @returns {String} api auth token
 */
AdCellClient.prototype.getToken = co.wrap(function* () {
  if (this.token !== null && this.tokenExpires > new Date()) {
    debug("Reusing Auth token: %s", this.token);
    return this.token;
  }

  let result, body, arg = {
    url: API_TYPES.user.path + 'getToken',
    qs: {
      userName: API_USERID,
      password: API_PASSWORD
    }
  };

  body = yield this.client.get(arg);
  result = _.get(body, 'data', []);

  if (body.status != 200) {
    throw new Error("Could not get Token for AdCell API requests. Response: [" + body.status + "]" + body.message);
  }

  this.token = result.token;  // make the new token available for our class
  this.tokenExpires = parseInt(result.expires) * 1000;  // update token expiration in milliseconds

  return this.token;
});


/**
 * Fetching all affiliate programs / merchants from AdCell which we are applied and accepted for.
 * @memberof AdCellClient
 * @param {Object} params - The params to pass onto the api call
 * @param {Object} params.page - which page to fetch from api
 * @param {Object} params.rows - how many rows/items per page to fetch
 * @returns {{programId:string, programName:string, ...}[]}
 */
AdCellClient.prototype.getAffiliateProgram = co.wrap(function* (params) {
	let response, body, arg = {
    url: API_TYPES.program.path + 'export',
    qs: {
      rows: API_TYPES.program.rows,
      page: 1
    }
  };

	// make sure we have a valid token for next request
	yield this.getToken();

  _.extend(arg.qs, {
    token: this.token,
    affiliateStatus: 'accepted'
  }, params);

	debug("Used token: %s", this.token);

	body = yield this.client.get(arg);
	response = _.get(body, 'data', []);

  if (body.status != 200) {
    throw new Error("Could not get affiliate programs for export. Response: [" + body.status + "]" + body.message);
  }

	return response;
});


module.exports = function() {
  return new AdCellClient();
};
