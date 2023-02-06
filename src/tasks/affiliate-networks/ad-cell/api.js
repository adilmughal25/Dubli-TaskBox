"use strict";

/*
 * API Documentation: https://www.adcell.de/api/v2/
 * Documentation requires valid Partner account credentials.
 *
 * ToDo: aggregate all api method implementations into minimum of abstract methodsto reduce redundant code within the api methods.
 */
const Agent = require ('https');
const _ = require('lodash');
const co = require('co');
const request = require('axios');
const moment = require('moment');
//const limiter = require('ominto-utils').promiseRateLimiter;
const debug = require('debug')('adcell:api-client');

const API_CFG = {
  url: 'https://www.adcell.de/api/v2/',
  ominto: {
    user: '205737',
    pass: 'HF&239gj(VF23i7Fsrn%238',
  },
  dubli: {
    user: '165872',
    pass: 'Hvg&sdu386HJf37d&hp4dF',
  }
};

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
function AdCellClient(s_entity) {
  if (!(this instanceof AdCellClient)) return new AdCellClient(s_entity);
  if (!s_entity) throw new Error("Missing required argument 's_entity'!");
  if (!API_CFG[s_entity]) throw new Error("Entity '"+s_entity+"' is not defined in API_CFG.");
  debug("Create new client for entity: %s", s_entity);

  this.cfg = API_CFG[s_entity];
  this.token = null;              // the token for re-use
  this.tokenExpires = new Date(); // use token until expired

  // default request options
  this.client = request.default({
    baseUrl: API_CFG.url,
    strictSSL : false,
    responseType: 'json',
    validateStatus: true,
    decompress: false,
    headers: {
      accept: "application/json"
    }
  });

  //limiter.request(this.client, 1, 2).debug(debug);
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

  debug("Get new token for api userid: %s.", this.cfg.user);

  let result, body, arg = {
    url: API_TYPES.user.path + 'getToken',
    qs: {
      userName: this.cfg.user,
      password: this.cfg.pass,
      format: 'json'
    }
  };

  body =yield this.client.get(arg);
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
    throw new Error("Could not get commissions. Response: [" + body.status + "]" + body.message + ". Token:[" + this.token + "]");
  }

  return response;
});

/**
 * Fetching all available coupons/text promos for our accepted affiliate programs.
 * @memberof AdCellClient
 * @param {Object} params - The params to pass onto the api call
 * @param {Object} params.programIds - array of programIds to fetch coupons for (!required)
 * @param {Object} params.page - which page to fetch from api
 * @param {Object} params.rows - how many rows/items per page to fetch
 * @param {String} promoType - What type of promo:"Coupon" or "Text"
 * @returns {{promotionId:string, programId:string, ...}[]}
 */
AdCellClient.prototype.getPromotionType = co.wrap(function* (params, promoType) {
  promoType = promoType || 'Coupon';
  let response, body, arg = {
    url: API_TYPES.promotion.path + 'getPromotionType' + promoType,
    qs: {
      rows: API_TYPES.promotion.rows,
      page: 1,
      format: 'json',
      outputSubId: 'OMINTO_SID_REPLACEMENT',
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
    throw new Error("Could not get " + promoType + " for export. Response: [" + body.status + "]" + body.message + ". Token:[" + this.token + "]");
  }

  return response;
});

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

  debug("Using token '%s' to fetch statistics by commission between %s and %s for entity %s", this.token, arg.qs.startDate, arg.qs.endDate, this.cfg.user);

  body = yield this.client.get(arg);
  response = _.get(body, 'data', []);

  if (body.status != 200) {
    throw new Error("Could not get transactions. Response: [" + body.status + "]" + body.message + ". Token:[" + this.token + "]");
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

module.exports = AdCellClient;
