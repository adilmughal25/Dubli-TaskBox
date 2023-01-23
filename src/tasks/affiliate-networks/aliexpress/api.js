"use strict";

const co = require('co');
const _ = require('lodash');
const moment = require('moment');
const request = import('got');
const debug = require('debug')('aliexpress:api-client');
//const limiter = require('ominto-utils').promiseRateLimiter;
const jsonify = require('../support/jsonify-xml-body');

//http://click.aliexpress.com/rd/bAYFkQE8?af={publisher_id}&amp;dp={click_id}
//https://gw.api.alibaba.com/openapi/param2/2/portals.open/api.getCompletedOrders/[Appkey]?appSignature=[appSignature]&startDate=[startDate]&endDate=[endDate]&liveOrderStatus=[liveOrderStatus]
const BASE_URL = 'https://gw.api.alibaba.com/openapi/param2/2/portals.open/';
const API_CFG = {
  ominto: {
    id: 'ominto',
    //apiKey: '25268',
    appSignature: 'Un98ajNnCZ2N',
  },
  dubli: {
    id: 'dubli',
    //apiKey: '25268',
    appSignature: 'Un98ajNnCZ2N',
  }
};


const API_TYPES = {
  commissions: {
    url: 'http://gw.api.alibaba.com/openapi/param2/2/portals.open/',
    action: 'api.getCompletedOrders/25268',
    qs: {
      'appSignature': null,
      'liveOrderStatus': 'pay',
      'startDate': null,
      'endDate': null,
      // 'pageNo': 1,
      // 'pageSize': 5,
      'limit': [25, 60]
    },
    limit: null // cj doesn't say they limit this api -- bypass rate limiting
  }
};

const activeClients = {};

function aliExpressClient(s_entity, s_region, s_type) {
  if (!s_entity) throw new Error("Missing required argument 's_entity'!");
  if (!API_CFG[s_entity]) throw new Error("Entity '"+s_entity+"' is not defined in API_CFG.");
  if (!API_TYPES[s_type]) throw new Error("Unknown Ali Express API type: "+s_type);

  const _tag = s_entity + '-' + s_type;
  if (activeClients[_tag]) return activeClients[_tag];

  let cfg = API_CFG[s_entity];
  let c_type = API_TYPES[s_type];

  const client = request.extend({
    prefixUrl: c_type.url,
    url: c_type.action,
    responseType: 'json',
    resolveBodyOnly: true
  });


  client.getCommission = co.wrap(function* (dateStart, dateEnd) {
    c_type.qs['startDate'] = dateStart;
    c_type.qs['endDate'] = dateEnd;
    c_type.qs['appSignature'] = cfg['appSignature'];
    let arg = {qs: c_type.qs};

    debug("getCommission for period starting from %s until %s (%s)", dateStart, dateEnd, JSON.stringify({args:arg}));

    //let ret = yield client.get(arg).then(jsonify);
    let ret = yield client.get(arg);
    ret = JSON.parse(ret);
    if (ret && ret.result && ret.result.orders) {
      return ret.result.orders;
    }

    return [];
  });

  client.pagedApiCall = co.wrap(function* () {
    let perPage = 100;  // max. 100 per API Server
    let page = 0;
    let results = [];
    let total = 0;
    let start = Date.now();

    while (true) {
      let arg = {qs: _.extend({}, c_type.qs, {'pageNumber':++page, 'pageSize':perPage})};

      debug("%s: page %d of %s (%s)", c_type.action, page, Math.floor(total/perPage) || 'unknown', JSON.stringify({args:arg}));

      let ret = yield client.get(arg).then(jsonify);
      let info = _.get(ret, c_type.bodyKey);
      let meta = info.$;
      results = results.concat(info[c_type.resultKey] || []);

      total = meta['total-matched'];
      if (meta['page-number'] * perPage >= total) break;
    }

    let end = Date.now();
    debug("%s finished: %d items over %d pages (%dms)", c_type.action, results.length, page, end-start);

    return results;
  });

  if (c_type.limit) {
    var num = c_type.limit[0];
    var time = c_type.limit[1];
    //limiter.request(client, num, time).debug(debug);
  }

  activeClients[_tag] = client;

  return client;
}

module.exports = aliExpressClient;





// function Adservice(s_entity) {
//   if (!s_entity) throw new Error("Missing required argument 's_entity'!");
//   if (!API_CFG[s_entity]) throw new Error("Entity '"+s_entity+"' is not defined in API_CFG.");

//   const cfg = API_CFG[s_entity];

//   const client = request.default({
//     baseUrl: BASE_URL,
//     resolveWithFullResponse: true,
//     json: true
//   });


//   client.getTransactions = function(startDate, endDate) {
//     console.log('----');
//     const clientUrl = 'api.getCompletedOrders/' + cfg.apiKey + '?appSignature='+ cfg.appSignature +'&startDate='+startDate+'&endDate='+endDate+'&liveOrderStatus=success';
//     const apiUrl = clientUrl;
//     debug('GET' + apiUrl);

//     return client.get(apiUrl)
//       .then(resp => { return resp;})
//   };

//   return client;
// }

// module.exports = Adservice;