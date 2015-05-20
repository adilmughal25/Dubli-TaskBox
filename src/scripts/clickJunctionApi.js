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
  
  function getMerchants(page) {
    page = page || 1;
    var perPage = 25;
    
    //either if its not already running (if the scheduler hits it again on the hour)
    //or if its internally called by itself for the next page
    if(!running || page != 1) {
      advertiserClient.get({
        uri: "/v3/advertiser-lookup?advertiser-ids=joined&records-per-page="+perPage+"&page-number="+page,
        headers: {
          authorization: "009c8796168d78c027c9b4f1d8ed3902172eefa59512b9f9647482240bcd99d00a70c6358dd2b855f30afeafe055e1c8d99e632a626b1fa073a4092f4dd915e26d/36d998315cefa43e0d0377fff0d89a2fef85907b556d8fc3b0c3edc7a90b2e07fc8455369f721cc69524653234978c36fd12c67646205bf969bfa34f8242de8d"
        }
      }, function(error, response, body) {
        var ret = parser.toJson(body,  {
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
        }
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

  module.exports = getMerchants

})();
