"use strict";

/*
 * Webgains API client for their RESTful API.
 * Used for merchant information only. See "webgainsSoap.js" for SOAP API client to get commission information.
 * 
 * API Documentation: 
 *    Voucher code API  : http://www.webgains.fr/newsletter/images/VoucherCode_API_v2.pdf
 *    Offers API  : http://www.webgains.fr/newsletter/images/Offers_API_Publisher.pdf
 *    Banners API : http://www.webgains.fr/newsletter/images/ADS_API-en.pdf
 *    Program API : http://www.webgains.fr/newsletter/images/Programs_API-en.pdf
 *
 * TODO: Instead of usign transaction API, you can use the call back script : http://www.webgains.fr/newsletter/images/Callback_script.pdf
 */

const API_URL = 'http://api.webgains.com/2.0';
const API_KEY = '96069aeda4817545eb3ad17641e68899';
const CAMPAIGN_ID = 177143;
// DubLi legacy
//const API_KEY = '123ceb006202c54d7d7668b7568ad2cb'; // DubLi DE acc.
//const CAMPAIGN_ID = 75700;                          // DubLi DE acc.

const request = require('request-promise');

function createClient() {
  var client = request.defaults({
    baseUrl: API_URL,
    qs: {key: API_KEY},
    json: true
  });

  client.baseUrl = API_URL;
  client.apiKey = API_KEY;
  client.campaignId = CAMPAIGN_ID;

  client.getMerchants = function() {
    return this.get({
      url: 'programs',
      qs: {
        key: API_KEY,
        programsjoined: 1
      }
    });
  }.bind(client);

  client.getTextLinks = function() {
    return this.get({
      url: 'vouchers',
      qs: {
        key: API_KEY,
        joined: 'joined',
        media_type: 'text'
      }
    });
  }.bind(client);

  client.getCoupons = function() {
    return this.get({
      url: 'vouchers',
      qs: {
        key: API_KEY,
        joined: 1
      }
    });
  };

  client.getOffers = function(campaignId) {
    return this.get({
      url: 'offers',
      qs: {
        key: API_KEY,
        campaignId: campaignId
      }
    });
  };

  return client;
}

module.exports = createClient;
