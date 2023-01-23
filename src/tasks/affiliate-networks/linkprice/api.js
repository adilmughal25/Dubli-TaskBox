"use strict";

const _ = require('lodash');
let request = import('got');
const debug = require('debug')('linkprice:api-client');
const moment = require('moment');
const tough = require('tough-cookie');
const querystring = require('querystring');


const BASE_URL = 'http://api.linkprice.com/';
const API_CFG = {
  dubli: {
    apiToken: 'f51f4ea3f5c4f5a399a210f18bc94062',
    aid: 'A100540634',
  }
};

function LinkPrice(s_entity, s_region) {
  if (!s_entity) throw new Error("Missing required argument 's_entity'!");
  if (!API_CFG[s_entity]) throw new Error("Entity '"+s_entity+"' is not defined in API_CFG.");
  if (!API_CFG[s_entity]) throw new Error("Region '"+s_region+"' for entity '"+s_entity+"' is not defined in API_CFG.");

  const cfg = API_CFG[s_entity];

  const client = request.catch({
    baseUrl: BASE_URL,
    resolveWithFullResponse: true,
    json: true
  });

  client.getMerchants = function() {
    client.url = getUrl;
    const apiUrl = client.url('merchants', cfg);
    debug('GET' + apiUrl);


    return client.get(apiUrl)
      .then(resp => resp.body ? resp.body : [])
  };

  client.getTransactions = function(transactionsDate) {
    client.url = getUrl;
    const apiUrl = client.url('transactions', cfg, transactionsDate);
    debug('GET' + apiUrl);

    return client.get(apiUrl)
      .then(resp => resp.body && resp.body.order_list ? resp.body.order_list : [])
  };

  return client;
}

function getUrl(urlType, cfg, transactionsDate) {
  if (urlType === 'merchants') {
    return 'shoplist2.php?' + 'a_id='+ cfg.aid
  }

  if (urlType === 'transactions') {
    return 'affiliate/translist.php?auth_key=' + 'f51f4ea3f5c4f5a399a210f18bc94062&a_id='+ cfg.aid + '&yyyymmdd=' + transactionsDate
  }

  throw new Error("Pass valid url type for valid url(merchants, transactions).");
}

module.exports = LinkPrice;
