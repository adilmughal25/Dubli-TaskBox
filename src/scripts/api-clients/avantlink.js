"use strict";

const AUTH_KEY = '401dc5ad219d787ee5ff88d38872c8d5';
const BASE_URL = 'https://classic.avantlink.com/api.php';
const AFFILIATE_ID = '147618';
const WEBSITE_ID = '183130';

var _ = require('lodash');
var denodeify = require('denodeify');
var querystring = require('querystring');
var request = require('request-promise');
var jsonify = require('./jsonify-xml-body');

function createClient() {
  var client = request.defaults({});

  client.getMerchants = function() {
    var url = BASE_URL + '?' + querystring.stringify({
      module: 'AssociationFeed',
      auth_key: AUTH_KEY,
      affiliate_id: AFFILIATE_ID,
      output: 'json',
      association_status: 'active'
    });

    return client.get({
      uri: url,
      json: true
    });
  };

  client.getTextLinks = function() {
    var url = BASE_URL + '?' + querystring.stringify({
      module: 'AdSearch',
      affiliate_id: AFFILIATE_ID,
      website_id: WEBSITE_ID,
      output: 'xml',
      ad_type: 'text'
    });

    var promise = client.get(url)
      .then(jsonify)
      .then(data => data.NewDataSet.Table1);
    return promise;
  };

  return client;
}

module.exports = createClient;
