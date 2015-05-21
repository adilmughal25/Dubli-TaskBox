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
  var client = getDataClient("https://api.impactradius.com");
  
  var merchantsRunning = false;
  function getMerchants(nextUri) {
    var perPage = 1000;
    
    //either if its not already running (if the scheduler hits it again on the hour)
    //or if its internally called by itself for the next page
    if(!merchantsRunning || nextUri != null) {
      nextUri = nextUri || "Mediapartners/IRDHLqHpQY79155520ngJ28D9dMGTVZJA1/Campaigns.json?PageSize="+perPage+"&Page=1";
      merchantsRunning = true;

      client.get({
        uri: nextUri,
        headers: {
          Authorization: "Basic SVJESExxSHBRWTc5MTU1NTIwbmdKMjhEOWRNR1RWWkpBMTpFYU1tNUdWZ2p3Q2FaM0ozY2NDcmlBcVJ1THNOc1VLbw==",
          Accept: "application/json",
          "Content-Type" : "application/json"
        }
      }, function(error, response, body) {
        var merchants = body['Campaigns'];
        if(merchants) {
          sendMerchantsToEventHub(merchants);
        }

        if(body["@nextpageuri"] != "") {
          //wait a minute and grab the next page
          setTimeout(function() {
            getMerchants(body["@nextpageuri"]);
          }, 1*60*1000);
        } else {
          merchantsRunning = false;
        }
      });
    }
  }

  var commissionsRunning = false;
  function getCommissionDetails(nextUri) {
    var perPage = 1000;
    var tempEnd = new Date();
    var tempStart = new Date();
    
    tempEnd.setDate(tempEnd.getDate() + 1);
    tempStart.setDate(tempStart.getDate() - 1);

    tempEnd = tempEnd.toISOString().substr(0,19) + "-00:00";
    tempStart = tempStart.toISOString().substr(0,19) + "-00:00"
    
    if(!commissionsRunning || nextUri != null) {
      nextUri = nextUri || "Mediapartners/IRDHLqHpQY79155520ngJ28D9dMGTVZJA1/Actions.json?PageSize="+perPage+"&Page=1&StartDate="+tempStart+"&EndDate="+tempEnd;
      
      commissionsRunning = true;
      client.get({
        uri: nextUri,
        headers: {
          Authorization: "Basic SVJESExxSHBRWTc5MTU1NTIwbmdKMjhEOWRNR1RWWkpBMTpFYU1tNUdWZ2p3Q2FaM0ozY2NDcmlBcVJ1THNOc1VLbw==",
          Accept: "application/json",
          "Content-Type" : "application/json"
        }
      }, function(error, response, body) {
        var commissions = body['Actions'];
        if(commissions) {
          sendCommissionsToEventHub(commissions);
        }

        if(body["@nextpageuri"] != "") {
          //wait a minute and grab the next page
          setTimeout(function() {
            getCommissionDetails(body["@nextpageuri"]);
          }, 1*60*1000);
        } else {
          merchantsRunning = false;
        }
      });
    }
  }

  function sendMerchantsToEventHub(merchants) {
    console.log(merchants);
    
  }

  function sendCommissionsToEventHub(commissions) {
    console.log(commissions);
    
  }

  module.exports = {
    getMerchants: getMerchants,
    getCommissionDetails: getCommissionDetails
  }
})();
