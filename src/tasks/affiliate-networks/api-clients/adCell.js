"use strict";

/*
 * API Documentation: https://www.adcell.de/api/v2/
 * Documentation requires valid Partner account credentials.
 *
 * ToDo: aggregate all api method implementations into minimum of abstract methodsto reduce redundant code within the api methods.
 */

const _ = require('lodash');
const co = require('co');
const request = require('request-promise');
// debugging the requests || TODO: remove after finishing implementation
//require('request-promise').debug = true; 
const debug = require('debug')('adcell:api-client');
const moment = require('moment');

const API_URL      = 'https://www.adcell.de/api/v2/';
const API_USERID   = '205737';                  // DubLi-Legacy: 165872
const API_PASSWORD = 'HF&239gj(VF23i7Fsrn%238'; // DubLi-Legacy: Hvg&sdu386HJf37d&hp4dF
//const API_USERID   = '165872';
//const API_PASSWORD = 'Hvg&sdu386HJf37d&hp4dF';

const API_TYPES = {
  user: {
    path: "user/"               // https://www.adcell.de/api/v2/user/getToken?userName=*****&password=*****
  },
  program: {
    path: "affiliate/program/", // https://www.adcell.de/api/v2/affiliate/program/export?affiliateStatus=accepted&token=*****
    rows: 500                   // num rows to fetch pare page (per request); default is 25; max:1000
  },
  promotion: {
    path: "affiliate/promotion/", // https://www.adcell.de/api/v2/affiliate/promotion/getPromotionTypeCoupon?token=****&programIds[]=3687&programIds[]=1762&programIds[]=...
    rows: 500                     // num rows to fetch pare page (per request); default is 25; max:1000
  },
  statistic: {
    path: "affiliate/statistic/", // https://www.adcell.de/api/v2/affiliate/statistic/byCommission?token=****&startDate=2015-05-01&endDate=2015-05-31&...
    rows: 500                     // num rows to fetch pare page (per request); default is 25; max:1000
  }
};


/**
 * New Class AdCellClient
 * AdCell API requires a token for any request. This token has to be requested in a initial call and is valid for 15minutes.
 * @class
 */
function AdCellClient() {
	if (!(this instanceof AdCellClient)) return new AdCellClient();
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

  debug("Get new token");
  
  let result, body, arg = {
    url: API_TYPES.user.path + 'getToken',
    qs: {
      userName: API_USERID,
      password: API_PASSWORD,
      format: 'json'
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
      page: 1,
      format: 'json'
    }
  };

	// make sure we have a valid token for next request
	yield this.getToken();

  _.extend(arg.qs, {
    token: this.token,
    affiliateStatus: 'accepted'
  }, params);

  debug("Using token '%s' to request programs...", this.token);

	body = yield this.client.get(arg);
	response = _.get(body, 'data', []);

  if (body.status != 200) {
    throw new Error("Could not get affiliate programs for export. Response: [" + body.status + "]" + body.message);
  }

	return response;
});

/**
 * Fetching commissions for given affiliate programs / merchants.
 * @memberof AdCellClient
 * @param {Object} params - The params to pass onto the api call
 * @param {Object} params.programIds - array of programIds to fetch data for (!required)
 * @param {Object} params.page - which page to fetch from api
 * @param {Object} params.rows - how many rows/items per page to fetch
 * @returns {{programId:string, programName:string, ...}[]}
 */
AdCellClient.prototype.getCommissions = co.wrap(function* (params) {
	let response, body, arg = {
    url: API_TYPES.program.path + 'getCommissions',
    qs: {
      rows: API_TYPES.program.rows,
      page: 1,
      format: 'json'
    }
  };

	// make sure we have a valid token for next request
	yield this.getToken();

  _.extend(arg.qs, {
    token: this.token
  }, params);

  debug("Using token '%s' to request commissions for programIds: %s", this.token, JSON.stringify(arg.qs.programIds));

	body = yield this.client.get(arg);
	response = _.get(body, 'data', []);

  if (body.status != 200) {
    throw new Error("Could not get commissions. Response: [" + body.status + "]" + body.message);
  }

	return response;
});

/**
 * Fetching all available coupons/text promos for our accepted affiliate programs.
 * @memberof AdCellClient
 * @param {String} promoType - What type of promo:"Coupon" or "Text"
 * @param {Object} params - The params to pass onto the api call
 * @param {Object} params.programIds - array of programIds to fetch coupons for (!required)
 * @param {Object} params.page - which page to fetch from api
 * @param {Object} params.rows - how many rows/items per page to fetch
 * @returns {{promotionId:string, programId:string, ...}[]}
 */
AdCellClient.prototype.getPromotionType = co.wrap(function* (promoType, params) {
  promoType = promoType || 'Coupon';
	let response, body, arg = {
    url: API_TYPES.promotion.path + 'getPromotionType' + promoType,
    qs: {
      rows: API_TYPES.promotion.rows,
      page: 1,
      format: 'json',
      showJsCode: 0,     // 0=no;1=yes; show JSCode in ouput
      showhtmlCode: 0,   // 0=no;1=yes; show HTML Code in output,
      endDate: getDateFormatted(1)  // Filtering by vouchers whose validity ends on or after this date; Format YYYY-mm-dd (e.g.: 2014-11-23) 
    }
  };

	// make sure we have a valid token for next request
	yield this.getToken();

  _.extend(arg.qs, {
    token: this.token
  }, params);

  debug("Fetch " + promoType + " for %d programId's.", arg.qs.programIds.length);

	body = yield this.client.get(arg);
	response = _.get(body, 'data', []);

  if (body.status != 200) {
    throw new Error("Could not get " + promoType + " for export. Response: [" + body.status + "]" + body.message);
  }

	return response;
});

/**
 * Function alias for getPromotionType('Coupon', {params})
 * @memberof AdCellClient
 */
AdCellClient.prototype.getPromotionTypeCoupon = (params) => {
  return this.getPromotionType('Coupon', params);
};

/**
 * Function alias for getPromotionType('Text', {params})
 * @memberof AdCellClient
 */
AdCellClient.prototype.getPromotionTypeText = (params) => {
  return this.getPromotionType('Text', params);
};


/**
 * Fetching all transactions/sales within a specified date period.
 * @memberof AdCellClient
 * @param {Object} params - The params to pass onto the api call
 * @param {Object} params.startDate - date filter for transactions only AFTER that date
 * @param {Object} params.endDate - date filter for transactions only BEFORE that date
 * @param {Object} params.page - which page to fetch from api
 * @param {Object} params.rows - how many rows/items per page to fetch
 * @returns {Object[]}
 */
AdCellClient.prototype.getStatisticsByCommission = co.wrap(function* (params) {
	let response, body, arg = {
    url: API_TYPES.statistic.path + 'byCommission',
    qs: {
      rows: API_TYPES.statistic.rows,
      page: 1,
      format: 'json',
      startDate: getDateFormatted(-1),  // default date to get transactions from AFTER that date
      endDate: getDateFormatted(0)      // default date to get transactions from BEFORE that date
    }
  };

  // format dates to API expected format
  params.startDate = params.startDate ? moment(params.startDate).format('YYYY-MM-DD') : arg.qs.startDate;
  params.endDate = params.endDate ? moment(params.endDate).format('YYYY-MM-DD'): arg.qs.endDate;

	// make sure we have a valid token for next request
	yield this.getToken();

  _.extend(arg.qs, {
    token: this.token
  }, params);

  debug("Using token '%s' to fetch statistics by commission between %s and %s", this.token, arg.qs.startDate, arg.qs.endDate);

	body = yield this.client.get(arg);
	response = _.get(body, 'data', []);

  if (body.status != 200) {
    throw new Error("Could not get transactions. Response: [" + body.status + "]" + body.message);
  }

	return response;
});

/**
 * Function getDateFormatted
 * Returns a formatted date as string while optionally add {addDays} number of days to todays date.
 * Little helper for API Request with dates in specific format.
 * @param {Number} addDays  Optional number of days to add/substract from today/now.
 * @param {String} format  The format to return the date - use node-moment formatting syntax. Default: YYYY-MM-DD
 * @returns {String}
 */
function getDateFormatted(addDays, format) {
  addDays = addDays || 0;
  format = format || 'YYYY-MM-DD';

  let _date = new Date();
  _date.setDate(_date.getDate() + addDays);

  return moment(_date).format(format);
}


module.exports = function() {
  return new AdCellClient();
};
