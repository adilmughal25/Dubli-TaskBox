"use strict";

const csv = require("csvtojson");
const request=require('request')
const baseUrl = 'https://kol.jumia.com/api/feeds/conversions/download/39d93760d9fdc30b894acb5422bec21508368e12ad9ec03870fb2f8e623e6a5b/60';

function JumiaSheet(s_entity) {
  if (!s_entity) throw new Error("Missing required argument \'s_entity'!");

  const client = {};

  client.getTransactions  = function* start() {
  return new Promise((resolve,reject)=> {
    let transactionObj = [];
    request.get(baseUrl, function (error, response, body) {
      if (!error && response.statusCode == 200) {
          csv().fromString(body).on("json",function(json){
            transactionObj.push(json);
          }).on('done', (error) => {
              if (error)
                return reject(error);
              resolve(transactionObj);
          })
        }
      });
  })
}
  return client;
}

module.exports = JumiaSheet;
