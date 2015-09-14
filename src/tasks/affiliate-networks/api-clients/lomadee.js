"use strict";

/*
 * Lomadee API client for their RESTful API.
 *
 * API Documentation
 *    Merchants API: http://developer.buscape.com.br/portal/developer/documentacao/apis-afiliados/api-lomadee/lojas/
 */

var co = require('co');
const request = require('request-promise');

const API_URL = ' http://sandbox.buscape.com.br/service/';
const API_KEY = '5749507a5a7258304352673d';

function createClient() {

  var client = request.default({
    baseUr: API_URL,
    qs: {format: 'json'},
    json: true
  });

  client.baseUrl = API_URL;
  client.apiKey = API_KEY;

  client.getMerchants = function() {
    return this.get({
      url: 'sellers/lomadee/' + API_KEY + '/BR'
    });
  }.bind(client);
}
