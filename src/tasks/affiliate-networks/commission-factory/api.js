"use strict";

/*
 * API Documentation: http://dev.commissionfactory.com/V1/Affiliate/Functions/GetTransactions/
 */
const request = require('request-promise').defaults({ rejectUnauthorized: false });
const debug = require('debug')('commissionfactory:api-client');
const limiter = require('ominto-utils').promiseRateLimiter;

const API_CFG = {
  url: 'https://api.commissionfactory.com/V1/Affiliate',
  ominto: {
    key: 'd7ca984b2190487a954b08c4db740105',
  },
  dubli: {
    key: '19151cf1faae4e5b8af6c167b655eef6',
  }
};

function CommissionFactoryClient(s_entity) {
  if (!(this instanceof CommissionFactoryClient)) return new CommissionFactoryClient(s_entity);
  if (!s_entity) throw new Error("Missing required argument 's_entity'!");
  if (!API_CFG[s_entity]) throw new Error("Entity '"+s_entity+"' is not defined in API_CFG.");
  debug("Create new client for entity: %s", s_entity);

  const cfg = API_CFG[s_entity];
  const client = request.defaults({
    baseUrl: API_CFG.url,
    json: true,
    qs: {
      apiKey: cfg.key
    }
  });

  limiter.request(client, 15, 60).debug(debug);

  return client;
}

module.exports = CommissionFactoryClient;

/*
createClient()
  .get('/Merchants?status=Joined&commissionType=Percent per Sale')
  .then( x => console.log("RESULTS", JSON.stringify(x, null, 2)) )
  .catch( e => console.error("Error", e.stack) );

*/
