"use strict";

const _ = require('lodash');
const co = require('co');
const debug = require('debug')('a8:api-client');
const request = require('request-promise');
const qs = require('querystring');

const API_ACCOUNT = 'a16120154459';
const API_BASE = 'https://api.a8.net/as/'+API_ACCOUNT+'/pointreport/';
const API_USER = 'merchants';
const API_PASS = 'Ominto2016';

/*
A8 Imp Links
https://api.a8.net/as/a16120154459/

1. decide-report [decide-reportA-a000000000-YYYYMMDD.txt]
https://api.a8.net/as/a16120154459/pointreport/decide/decide-reportA-a16120154459-20161214.txt

2. unsealed-report [unsealed-reportA-a000000000-YYYYMMDD.txt]
https://api.a8.net/as/a16120154459/pointreport/unsealed/unsealed-reportA-a16120154459-20161214.txt

3. unsealedadd-report [unsealedadd-reportA-a000000000-YYYYMMDD.txt]
https://api.a8.net/as/a16120154459/pointreport/unsealed-add/unsealedadd-reportA-a16120154459-20161214.txt
*/

const A8Client = function() {

  if (!(this instanceof A8Client)) return new A8Client();

  debug('a8:api-client');

  const that = this;

  // if needed for authorization
  // var auth = "Basic " + new Buffer(username + ":" + password).toString("base64");

  this.client = request.defaults({
    baseUrl: API_BASE,
    json: true,
    auth: {
      user: API_USER,
      pass: API_PASS
    }
  });

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
    return urlExt + '-reportA-' + API_ACCOUNT + '-' + date + '.txt';
  };

  // expose
  this.get = this.client.get;
};

module.exports = A8Client;
