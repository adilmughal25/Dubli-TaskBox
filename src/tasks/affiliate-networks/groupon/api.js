"use strict";

/*
 * API Documentation: https://partner-api.groupon.com/help/reporting-version-2
 * - No throttling or requests limitations known/documented.
 * - JSON and pagination supported
 * - API RESTfull URL manually concatenated due to custom param value formatting for "date".
 */

const _ = require('lodash');
const co = require('co');
const request = require('axios');
const debug = require('debug')('groupon:api-client');
const moment = require('moment');
const querystring = require('querystring');

const API_CFG = {
  ominto: {
    us: {
      url: 'https://partner-api.groupon.com/reporting/v2/',
      key: '86a0205660442988d738ec1e6716ac073c1e935f'
    },
    row: {
      url: 'https://partner-int-api.groupon.com/reporting/v2/',
      key: '68b91f453321aa927887f2be988522829bb610f8'
    }
  }
  // dubli: {
  //   us: {
  //     url: 'https://partner-api.groupon.com/reporting/v2/',
  //     key: 'cbfa54371c094c88d2178c0a260290ac09de4679'
  //   },
  //   eu: {
  //     url: 'https://partner-int-api.groupon.com/reporting/v2/',
  //     key: '469776c78dc3f8bfdf63fc32606da73788cf049c'
  //   }
  // }
};

const API_TYPES = {
  order: {
    path: "order.json",
    rows: 250,
    qs: {
      group: 'order|deal|date',
      timezone: 'UTC'
    }
  }
  /*
  // possibly "ledger" later?! - does not per item detail
  , ledger: {
    path: "ledger.json"
  }
  */
};

/**
 * New Class GrouponClient
 * @class
 */
const GrouponClient = function(s_entity, s_region) {
  let _tag = s_entity + s_region;
  if (!(this instanceof GrouponClient)) return new GrouponClient(s_entity, s_region);
  if (!s_entity) throw new Error("Missing required argument 's_entity'!");
  if (!s_region) s_region = 'us';
  if (!API_CFG[s_entity][s_region]) throw new Error("Unknown groupon region `"+s_region+"` for entity `"+s_entity+"`! Available regions: "+Object.keys(API_CFG[s_entity]).join(', '));

  this._token = undefined;
  this._expires = new Date(0);
  this._cfg = API_CFG[s_entity][s_region];

  this.debug = require('debug')('groupon:'+s_entity+':'+s_region+':api-client');

  // default request options
  this.client = request.default({
    json: true,
    simple: true,
    resolveWithFullResponse: false,
    headers: {
      accept: "application/json",
      'accept-charset': 'utf-8'
    }
  });
};

/**
 * Fetching all transactions/sales within a specified date period.
 * @memberof GrouponClient
 * @param {Object} params - The params to pass onto the api call
 * @param {Object} params.page - which page to fetch from api
 * @param {Object} params.pageSize - Optional; how many rows/items per page to fetch
 * @param {Object} params.startDate - Date range filter, from date
 * @param {Object} params.endDate - Date range filter, until date
 * @returns {Array}
 */
GrouponClient.prototype.getOrders = co.wrap(function* (params) {
  const arg = {
    url: API_TYPES.order.path,
    qs: {
      pageSize: API_TYPES.order.rows,
      page: 1,
      clientId: this._cfg.key
    }
  };

  // format dates to API expected format
  params.startDate = params.startDate || new Date(Date.now() - (1 * 86400 * 1000));
  params.endDate = params.endDate || new Date();

  // Example: "..&date=[2014-01-01&date=2014-12-31]&var2=val2"
  let date = 'date=[' + moment(params.startDate).format('YYYY-MM-DD') +
    '&date=' + moment(params.endDate).format('YYYY-MM-DD')  + ']';
  debug("Fetch commissions from %s till %s", params.startDate, params.endDate);

  delete params.startDate;
  delete params.endDate;

  _.extend(arg.qs, API_TYPES.order.qs, params);

  let url = this._cfg.url + arg.url + '?' + querystring.stringify(arg.qs) + '&' + date;

  // request.get('https://partner-api.groupon.com/reporting/v2/order.json?clientId=cbfa54371c094c88d2178c0a260290ac09de4679&group=order%7Cdeal%7Cdate&date=%5B2015-08-01&date=2015-08-28%5D&timezone=UTC').then(x => console.log("x is", x));
  const body = yield this.client.get(url).catch( function(err) {
    throw new Error("Api returned error. Response: [" + err.statusCode + "] " + err.message);
  });
  const response = body || [];

  return response;
});

module.exports = GrouponClient;
