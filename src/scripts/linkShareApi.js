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
  var client = getDataClient("https://api.rakutenmarketing.com");

  var bearerToken;
  var refreshToken;

  function getCode(done) {
    if(bearerToken) {
      done();
    } else {
      client.post({
        uri: "token",
        headers: {
          Authorization: "Basic YkxnOXFicVRzZWdDQ0VPTE5NN2dieHV0eWFvYTpKRWZTcEVPMldyZWhnRlB0MHJCMXd2MHU1REVh"
        },
        form: {
          grant_type: 'password',
          username: 'Ominto',
          password: 'Minty678',
          scope: '3239617'
        }
      }, function(error, response, body) {
        bearerToken = body.access_token;
        refreshToken = body.refresh_token;
        setTimeout(function() {
          refreshCode();
        }, body.expires_in * 1000 - 10000);

        done();
      });
    }
  }

  function refreshCode() {
    client.post({
      uri: "token",
      headers: {
        Authorization: "Basic YkxnOXFicVRzZWdDQ0VPTE5NN2dieHV0eWFvYTpKRWZTcEVPMldyZWhnRlB0MHJCMXd2MHU1REVh"
      },
      form: {
        grant_type: 'password',
        refresh_token: refreshToken,
        scope: 'Production'
      }
    }, function(error, response, body) {
      bearerToken = body.access_token;
      refreshToken = body.refresh_token;
      setTimeout(function() {
        refreshCode(body);
      }, body.expires_in * 1000 - 60000);
    });
  }
  
  var merchantsRunning = false;
  function getMerchants(nextUri) {
    getCode(function () {
      nextUri = nextUri || "advertisersearch/1.0";
      merchantsRunning = true;

      client.get({
        uri: nextUri,
        headers: {
          Authorization: "Bearer " + bearerToken,
          accept: "application/xml"
        }
      }, function(error, response, body) {
        var ret = parser.toJson(body, {
          object: true,
        });

        var merchants = ret.result.midlist.merchant;
        if(merchants) {
          sendMerchantsToEventHub(merchants);
        }
        merchantsRunning = false;
      });
    });
  }

  var commissionsRunning = false;
  function getCommissionDetails(page, startDate, endDate) {
    getCode(function () {
      page = page || 1;

      if(!startDate) {
        var tempStart = new Date();
        tempStart.setDate(tempStart.getDate() - 1);
        tempStart = tempStart.toISOString().substr(0,19).replace("T", " ")
      } else {
        tempStart = startDate;
      }

      if(!endDate) {
        var tempEnd = new Date();
        tempEnd.setDate(tempEnd.getDate() + 1);
        tempEnd = tempEnd.toISOString().substr(0,19).replace("T", " ")
      } else {
        tempEnd = endDate;
      }

      if(!commissionsRunning || page != 1) {
        var uri = "/events/1.0/transactions?limit=1000&page="+page;
        client.get({
          uri: uri,
          headers: {
            Authorization: "Bearer " + bearerToken,
            accept: "application/json"
          }
        }, function(error, response, body) {
          var commissions = body;
          if(commissions) {
            sendCommissionsToEventHub(commissions);

            if(commissions.length == 1000) {
              getCommissionDetails(page+1, tempStart, tempEnd);
            } else {
              commissionsRunning = false;
            }
          } else {
            commissionsRunning = false;
          }
        });
      }
    });
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
    getCommissionDetails: getCommissionDetails,
    getCode: getCode
  }
})();
