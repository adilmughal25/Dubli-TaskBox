"use strict";

const _ = require('lodash');
const co = require('co');
const debug = require('debug')('a8:api-client');
const request = require('request-promise');
const qs = require('querystring');

const API_ACCOUNT_NUMBER = 'a16120154459';
const API_BASE_URL = 'https://api.a8.net/as/'+API_ACCOUNT_NUMBER+'/pointreport/';
const API_USERNAME = 'merchants';
const API_PASSWORD = 'Ominto2016';

/*
A8 Imp Links
https://api.a8.net/as/a16120154459/ [root directory for reports]

According to A8, we need to only process report A in the directories.

1. decide-report [decide-reportA-a000000000-YYYYMMDD.txt]
https://api.a8.net/as/a16120154459/pointreport/decide/decide-reportA-a16120154459-20161214.txt

2. unsealed-report [unsealed-reportA-a000000000-YYYYMMDD.txt]
https://api.a8.net/as/a16120154459/pointreport/unsealed/unsealed-reportA-a16120154459-20161214.txt

3. unsealedadd-report [unsealedadd-reportA-a000000000-YYYYMMDD.txt]
https://api.a8.net/as/a16120154459/pointreport/unsealed-add/unsealedadd-reportA-a16120154459-20161214.txt
*/

/**
 * A8 client for making calls to report based (text files) API
 * @returns {A8}
 * @constructor
 */
const A8Client = function() {

  if (!(this instanceof A8Client)) return new A8Client();

  debug('a8:api-client');

  const that = this;

  // if needed for authorization
  // var auth = "Basic " + new Buffer(API_USERNAME + ":" + API_PASSWORD).toString("base64");

  /**
   * Client Constructor
   * @returns {Object/json}
   */
  this.client = request.defaults({
    baseUrl: API_BASE_URL,
    json: true,
    auth: {
      user: API_USERNAME,
      pass: API_PASSWORD
    }
  });

  /**
  * Generates URLs based of report type
  * @param type report type {decide, unsealed, unsealedadd}
  * @param date date for which the report need to be fetched
  * @returns {String}
  */
  this.url = function urlMaker(type, date) {

    var urlExt;
    switch (type) {
      case 'decide':
          urlExt = 'decide/decide'
        break;
      case 'unsealed':
          urlExt = 'unsealed/unsealed'
        break;
      case 'unsealedadd':
          urlExt = 'unsealed-add/unsealedadd'
        break;
      default:
        debug('Unknown type for urlMaker!!!');
    }
    return urlExt + '-reportA-' + API_ACCOUNT_NUMBER + '-' + date + '.txt';
  };

  // expose
  this.get = this.client.get;
};

module.exports = A8Client;
