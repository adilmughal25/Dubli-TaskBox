(function() {
  "use strict";
  var parser = require('xml2json');
  var request = require("request-promise");
  require('promise.prototype.finally');

  function getDataClient(baseUrl) {
    var dataClient = request.defaults({
      baseUrl: baseUrl,
      json: true,
      simple: false,
      resolveWithFullResponse: true
    });
    return dataClient;
  }
  var advertiserClient = getDataClient("https://advertiser-lookup.api.cj.com");
  var commissionClient = getDataClient("https://commission-detail.api.cj.com");
  
  var merchantsRunning = false;
  function getMerchants(page) {
    page = page || 1;
    var perPage = 25;
    
    //either if its not already running (if the scheduler hits it again on the hour)
    //or if its internally called by itself for the next page
    if(!merchantsRunning || page != 1) {
      merchantsRunning = true;
      advertiserClient.get({
        uri: "/v3/advertiser-lookup?advertiser-ids=joined&records-per-page="+perPage+"&page-number="+page,
        headers: {
          authorization: "009c8796168d78c027c9b4f1d8ed3902172eefa59512b9f9647482240bcd99d00a70c6358dd2b855f30afeafe055e1c8d99e632a626b1fa073a4092f4dd915e26d/36d998315cefa43e0d0377fff0d89a2fef85907b556d8fc3b0c3edc7a90b2e07fc8455369f721cc69524653234978c36fd12c67646205bf969bfa34f8242de8d",
          accept: "application/xml"
        }
      }, function(error, response, body) {
        var ret = parser.toJson(body, {
          object: true,
        });
        var info = ret['cj-api']['advertisers'];
        var merchants = ret['cj-api']['advertisers']['advertiser'];

        if(merchants) {
          sendMerchantsToEventHub(merchants);
        }

        if(info['total-matched'] >= perPage * info['page-number']) {
          //wait a minute and grab the next page
          setTimeout(function() {
            getMerchants(info['page-number'] + 1);
          }, 1*60*1000);
        } else {
          merchantsRunning = false;
        }
      });
    }
  }

  var commissionsRunning = false;
  function getCommissionDetails(page) {
    var tempEnd = new Date();
    var tempStart = new Date();
    
    tempEnd.setDate(tempEnd.getDate() + 1);
    tempStart.setDate(tempStart.getDate() - 1);

    tempEnd = tempEnd.getFullYear() + "-" + (tempEnd.getMonth() + 1) + "-" + tempEnd.getDate();
    tempStart = tempStart.getFullYear() + "-" + (tempStart.getMonth() + 1) + "-" + tempStart.getDate();
    
    if(!commissionsRunning || page != 1) {
      commissionsRunning = true;
      commissionClient.get({
        uri: "v3/commissions?date-type=posting&start-date="+tempStart+"&end-date="+tempEnd,
        headers: {
          authorization: "009c8796168d78c027c9b4f1d8ed3902172eefa59512b9f9647482240bcd99d00a70c6358dd2b855f30afeafe055e1c8d99e632a626b1fa073a4092f4dd915e26d/36d998315cefa43e0d0377fff0d89a2fef85907b556d8fc3b0c3edc7a90b2e07fc8455369f721cc69524653234978c36fd12c67646205bf969bfa34f8242de8d",
          accept: "application/xml"
        }
      }, function(error, response, body) {
        var ret = parser.toJson(body, {
          object: true,
        });

        var info = ret['cj-api']['commissions'];
        var commissions = ret['cj-api']['commissions']['commission'];

        if(commissions) {
          sendCommissionsToEventHub(commissions);
        }

        //DOES THIS BASTARD PAGINATE? STUPID FUCKING DOCS
        // if(info['total-matched'] >= perPage * info['page-number']) {
        //   //wait a minute and grab the next page
        //   setTimeout(function() {
        //     getCommissionDetails(info['page-number'] + 1);
        //   }, 1*60*1000);
        // } else {
        //   commissionsRunning = false;
        // }
        commissionsRunning = false;
      });
    }
  }

  function sendMerchantsToEventHub(merchants) {
    console.log(merchants);
    //The lambda on this kinesis is gonna be in charge of getting all of the links and products
    //in bulk calls to the links/products API's... still a bit annoying cuz they rate-limit
    //those API's to 25 per minutes... so if all the merchants in a given "set" have huge Product 
    //listings
  }

  function sendCommissionsToEventHub(commissions) {
    console.log(commissions);
    //The lambda on this kinesis is gonna be in charge of getting all of the links and products
    //in bulk calls to the links/products API's... still a bit annoying cuz they rate-limit
    //those API's to 25 per minutes... so if all the merchants in a given "set" have huge Product 
    //listings
  }

  module.exports = {
    getMerchants: getMerchants,
    getCommissionDetails: getCommissionDetails
  }
})();
