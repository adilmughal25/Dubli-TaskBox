"use strict";

const _ = require('lodash');
const request = require('request-promise');
const debug = require('debug')('adservice:api-client');
const moment = require('moment');
const tough = require('tough-cookie');
const querystring = require('querystring');


const BASE_URL = 'https://publisher.adservice.com/cgi-bin/publisher/API';
const API_CFG = {
  dubli: {
    dk: {
      loginToken: 'c64c3a69585fa4351a6e561634cd8fb5a7ee0f95',
      uid: 19451,
    },
  }
};

function Adservice(s_entity, s_region) {
  if (!s_entity) throw new Error("Missing required argument 's_entity'!");
  if (!s_region) s_region = 'india';
  if (!API_CFG[s_entity]) throw new Error("Entity '"+s_entity+"' is not defined in API_CFG.");
  if (!API_CFG[s_entity][s_region]) throw new Error("Region '"+s_region+"' for entity '"+s_entity+"' is not defined in API_CFG.");
 
  const cfg = API_CFG[s_entity][s_region];
  
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
      .then(resp => resp.body && resp.body.rows ? resp.body.rows : [])
  };

  client.getTransactions = function() {
    client.url = getUrl;  
    const apiUrl = client.url('transactions', cfg);
    debug('GET' + apiUrl);

    return client.get(apiUrl)
      .then(resp => resp.body && resp.body.rows ? resp.body.rows : [])
  };

  return client;
} 

function getUrl(urlType, cfg) {
  if (urlType === 'merchants') {
    return 'Campaigns.pl?' + 'UID='+ cfg.uid+'&LoginToken=' + cfg.loginToken
  }
  
  if (urlType === 'transactions') {
    return 'Statistics.pl/orders/?' + 'UID='+ cfg.uid+'&LoginToken=' + cfg.loginToken
  }

  throw new Error("Pass valid url type for valid url(merchants, transactions).");
}

module.exports = Adservice;