"use strict";

const _ = require('lodash');
const co = require('co');
const denodeify = require('denodeify');
const soap = require('soap');
const request = require('request-promise');
const debug = require('debug')('jumia:api-client');
const parseString = require('xml2js').parseString;
//require('tough-cookie'); // for request's benefit

const API_CFG = {
  jumia: {
    api_key: 'tdYiAJ71MnE4Vzfn5RkKZg',
    affiliate_id: 36387,
    baseUrl: 'http://affiliate.jumia.com'
  }
};

function Jumia(s_entity) {
  if (!s_entity) throw new Error("Missing required argument \'s_entity'!");

  const client = request.defaults({
    baseUrl: API_CFG[s_entity].baseUrl,
    resolveWithFullResponse: true
  });

  client.getTransactions = function*(s_entity, startDate, endDate) {
    client.url = this.getUrl;
    const apiUrl = client.url('transactions', API_CFG[s_entity], startDate, endDate);
    debug('Get' + apiUrl);

    const result = yield client.get(apiUrl).then(resp => resp.body && resp.body ? resp.body : {});
    return client.parseXml(result, 'commissions');
  }

  client.getOffers = function*(s_entity, startDate, endDate) {
    client.url = this.getUrl;
    const apiUrl = client.url('offers', API_CFG[s_entity]);
    debug('Get' + apiUrl);

    const result = yield client.get(apiUrl).then(resp => resp.body && resp.body ? resp.body : {});
    return client.parseXml(result, 'offers');
  }

  client.getMerchants = function*(s_entity, campaign_id) {
    client.url = this.getUrl;
    const apiUrl = client.url('merchants', API_CFG[s_entity], '', '', campaign_id);
    debug('Get' + apiUrl);

    const result = yield client.get(apiUrl).then(resp => resp.body && resp.body ? resp.body : {});
    return client.parseXml(result, 'merchants')
  }

  client.getUrl = function(urlType, cfg, startDate, endDate, campaign_id) {
    if (urlType === 'transactions') {
      return '/affiliates/api/5/reports.asmx/Conversions?api_key='+cfg['api_key']+'&affiliate_id='+ cfg['affiliate_id']+'&start_date='+startDate+'&end_date='+ endDate+'&offer_id=0';
    }

    if (urlType === 'offers') {
      return '/affiliates/api/4/offers.asmx/OfferFeed?api_key='+cfg['api_key']+'&affiliate_id='+ cfg['affiliate_id']+'&campaign_name=&media_type_category_id=0&vertical_category_id=0&vertical_id=0&offer_status_id=0&tag_id=0&start_at_row=1&row_limit=10000';
    }

    if (urlType === 'merchants') {
      return '/affiliates//api/2/offers.asmx/GetCampaign?api_key='+cfg['api_key']+'&affiliate_id='+ cfg['affiliate_id']+ '&campaign_id='+campaign_id;
    }
  }

  client.parseXml = function(xmlData, type) {
    return new Promise (function(resolve, reject) {
      parseString(xmlData, {explicitArray : false}, function (err, result) {
        if(err) {
          reject(err);
        }

        let parsedData = {};
        if (type === 'commissions') {
          parsedData = result.conversion_response.conversions ? result.conversion_response.conversions.conversion : [];
        } else if (type === 'offers') {
          parsedData = result.offer_feed_response.offers ? result.offer_feed_response.offers.offer : [];
        }
        else if (type === 'merchants') {
          parsedData = result.campaign_response.campaign ? result.campaign_response.campaign.creatives.creative_info : [];
        }

        return resolve(parsedData);
      });
    });
  }

  return client;
}

module.exports = Jumia;
