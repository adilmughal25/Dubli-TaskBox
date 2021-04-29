"use strict";

const _ = require('lodash');
const request = require('request-promise');
const debug = require('debug')('affiliatewindow:api-client');
const converter = require("csvtojson").Converter;

const BASE_URL = 'https://api.awin.com/';
const API_CFG = {
  ominto: {
    apiToken: '8cc78691-0aa5-448c-ad18-fd9a96e68943',
    user: '238283',
  },
  dubli: {
    apiToken: '8cc78691-0aa5-448c-ad18-fd9a96e68943',
    user: '128635',
  },
};

function AWClient(s_entity) {
  if (!s_entity) throw new Error("Missing required argument 's_entity'!");
  if (!API_CFG[s_entity]) throw new Error("Entity '"+s_entity+"' is not defined in API_CFG.");
//   if (!API_CFG[s_entity]) throw new Error("Region '"+s_region+"' for entity '"+s_entity+"' is not defined in API_CFG.");

  const cfg = API_CFG[s_entity];

  const client = request.defaults({
    baseUrl: BASE_URL,
    resolveWithFullResponse: true,
    json: true,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer '+cfg.apiToken,
    },
  });

  client.getMerchants = function() {
    client.url = getUrl;
    // https://api.awin.com/publishers/45628/programmes?relationship=joined
    const apiUrl = client.url('merchants', cfg);
    debug('GET ' + apiUrl);


    return client.get(apiUrl)
        .then(resp => resp.body)
        .catch(err => console.log(err));
  };

  client.getCommissions = function(advertiserId) {
    client.url = getUrl;
    const apiUrl = client.url('commissions', cfg, advertiserId);
    debug('GET ' + apiUrl);


    return client.get(apiUrl)
        .then(resp => resp.body)
        // .catch(err => console.log(err));
  };

  client.getDeals = function*() {
    const apiClient = request.defaults({
      baseUrl: 'https://ui.awin.com/',
      resolveWithFullResponse: true,
      json: true
    });
      // https://ui.awin.com/export-promotions/238283/e55af278629a6336549b016ba817299d?downloadType=json&membershipStatus=joined
      //const apiUrl = 'export-promotions/238283/e55af278629a6336549b016ba817299d?downloadType=json&promotionType=&categoryIds=&regionIds=11&advertiserIds=&membershipStatus=&promotionStatus=';
      const apiUrl = 'export-promotions/238283/e55af278629a6336549b016ba817299d?downloadType=json&membershipStatus=joined';
      debug('GET ' + apiUrl);

      const apiResponse = yield apiClient.get(apiUrl)
        .then(resp => {
          return resp.body && resp.body ? resp.body : []
        });

        return new Promise(function(resolve, reject) {
          var csvConverter = new converter({});
            csvConverter.fromString(apiResponse,function(err,result){

                  if(err){
                      console.log(err);
                      reject();
                  }

                  resolve(result);
              });
        });
  }

  client.getTransactions = function(transactionsData) {
    client.url = getUrl;
    const apiUrl = client.url('transactions', cfg, transactionsData);
    debug('GET ' + apiUrl);

    return client.get(apiUrl)
      .then(resp => resp.body && resp.body ? resp.body : [])
  };

  return client;
}

function getUrl(urlType, cfg, params) {
  if (urlType === 'merchants') {
    return 'publishers/'+cfg.user+'/programmes?relationship=joined';
  }

  if (urlType === 'commissions') {
    return 'publishers/'+cfg.user+'/commissiongroups?advertiserId=' + params.advertiserId;
  }

  if (urlType === 'transactions') {
    return 'publishers/' + cfg.user+ '/transactions/?startDate='+
    encodeURIComponent(params.startDate)+ '&endDate='+
    encodeURIComponent(params.endDate)+ '&dateType='+params.type;
  }

  throw new Error("Pass valid url type for valid url(merchants, transactions, commisions)");
}

module.exports = AWClient;