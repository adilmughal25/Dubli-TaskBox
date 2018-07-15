"use strict";

const _ = require('lodash');
const request = require('request-promise');
const debug = require('debug')('linkprice:api-client');
const moment = require('moment');
const tough = require('tough-cookie');
const querystring = require('querystring');


const BASE_URL = 'http://api.linkprice.com/';
const API_CFG = {
  dubli: {
    apiToken: 'A100540634',
    aid: 'A100540634',
  }
};

function LinkPrice(s_entity, s_region) {
  if (!s_entity) throw new Error("Missing required argument 's_entity'!");
  if (!API_CFG[s_entity]) throw new Error("Entity '"+s_entity+"' is not defined in API_CFG.");
  if (!API_CFG[s_entity]) throw new Error("Region '"+s_region+"' for entity '"+s_entity+"' is not defined in API_CFG.");

  const cfg = API_CFG[s_entity];

  const client = request.defaults({
    baseUrl: BASE_URL,
    resolveWithFullResponse: true,
    json: true
  });

  client.getMerchants = function() {
    client.url = getUrl;
    const apiUrl = client.url('merchants', cfg);
    debug('GET' + apiUrl);


    return client.get(apiUrl)
      .then(resp => resp.body && resp.body ? resp.body : [])
  };

  client.getTransactions = function(startDate, endDate) {
    client.url = getUrl;
    const apiUrl = client.url('transactions', cfg, startDate, endDate);
    debug('GET' + apiUrl);

    return client.get(apiUrl)
      .then(resp => resp.body && resp.body.rows ? resp.body.rows : [])
  };

  return client;
}

function getUrl(urlType, cfg, startDate, endDate) {
  if (urlType === 'merchants') {
    return 'shoplist2.php?' + 'a_id='+ cfg.aid
  }

  if (urlType === 'transactions') {
    return 'Statistics.pl/orders/?' + 'startDate=' + startDate + '&endDate='+ endDate + '&UID='+ cfg.uid+'&LoginToken=' + cfg.loginToken
  }

  throw new Error("Pass valid url type for valid url(merchants, transactions).");
}

module.exports = LinkPrice;