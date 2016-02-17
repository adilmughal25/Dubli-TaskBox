"use strict";

const co = require('co');
const _ = require('lodash');
const request = require('request-promise');
const debug = require('debug')('commission-junction:api-client');
const limiter = require('ominto-utils').promiseRateLimiter;
const jsonify = require('./jsonify-xml-body');

var runCounter = 0;

const API_CFG = {
  ominto: {
    us: {
      key: '00bea07dbb74ab519de55477a272fea9b9e7eca6895ecade844bc92fdccebd3a744e404fc9c91a1cfe8c1a689d314ed93509a370e7aaee2928775d1cf2e5a64137/3f3b67598602ca08f1284aa2d5384a3e8383095ee9d5ab6800e7947bcf0c0fd62f9f842b53a44659e4cc73897450be91c06ddc22bb3006ddd595643311bdab29',
      siteId: 7811975,
    },
    eu: {
      key: '0081758295d65c5839f92f5c8b993bc156fdefbf3f2e0923decbfe268f4735f362274cf25c758d8370f5efa0bf36e2b18389fc72641d7713e4d9d087592a72a4b1/3faa70ac0b9da26df05410693ed49a4293e3a1e40a59c8603b6623c476badb940128b2156e7457d7dd391c39b3a664233d10560794d039a8500bc09b5d492739',
      siteId: 7845446,
    }
  },
  dubli: {
    us: {
      key: '00964db799685a5650b8a4a66c77900a0a88e5f956584606f614af02ac6a06c49b1501bf174abaf114dfc33337e14cc8cad862de24468ed106b879081f092af37d/0b9a363906602ad792594b6b86133d6330cc27e22d70426b4e8f6ff26540de7e46d5210a7b9903dc721ffeccb387b9d3e2a4d1ad54d50dfb04c5bf005f08bd35',
      siteId: 1564357
    },
    de: {
      key: '009f58b52d87228097892de8c86d89dd8a33ebcbc2af038f3208aeb9dc9befb3147b9cb35b16d59c64e047e0251dde6042732f42983de3013c42eb4b3505879b35/20fddbdd464a65777a868fd8d79d20ca597fab9b6e62fd45edb847711eb41d4e7f872bd335b7a192092c915bb7a64f3c13c6773b93645f58d4b1078290dcdc2d',
      siteId: 3883365
    },
    es: {
      key: '00b3ed318c31041e2897712ad7eec5915673efdaeec546ddb7c989eb87e87e9049bf7757080c3157abfb4051d85a00242a0cb8b52069e41d58bc831b0d47a798a1/64e86af857e91a4ce39a494fef0e889336d45731c01c1d6edcade81541d3f1712a1fb56e80538ccec1f3fb1b6f9bc10e58c06d4e54d4d8b2968b7de94a0edf01',
      siteId: 4986492
    },
    gb: {
      key: '008aa32508c77c39c9e832245b17f9f7f2c7277b7f9c7c38752a318c5911bf49e37646473643d573525866047dd018cf57af1960ef3eb9031cda3592ff877f734b/0086375188415023c633d42f5c3d4713e36728f327e50061cc145029b6a536d2b945a674c3d4726ca3e2de37cac4f3f7d2399d12d2f5cfd339208ae5cc43e04931',
      siteId: 5349615
    },
    dk: {
      key: '008b7d75758b771ee651e72205f190186da26a52798540b1d87f9dca00dbac1af3af849af911b60d3224c4cd156e81d887f4200ac8927da34cc76792fdde4716d9/7e4ab0b623f74dfaa9dce2690f34af6953cb7fb0967ce48867c2acc9ea1a00ab9a3ccaf2afaaa8808f95ed87a02da27a96b6fa86398365d33acaf4e90c163a81',
      siteId: 6241124
    },
    it: {
      key: '008810f9b7e0a92cb05f92688829f396ea1f9241c340aa2a205036639265fba82054d99d049bfe7fe922d9e16896e6d9a5df0cd4ae11353bd2e179dd6171f1f3b9/498d7ba03596ddec7dcd642a6f1b1972781c94e61a77a20c13b043052991ef60b7eea37d0100e0513102c74562070fd101bb838ff561ab9c6f8f6576f4e7535d',
      siteId: 7401652
    },
  }
};

const API_TYPES = {
  advertisers: {
    url: 'https://advertiser-lookup.api.cj.com/v3',
    action: 'advertiser-lookup',
    qs: {
      'advertiser-ids': 'joined',
    },
    bodyKey: 'cj-api.advertisers',
    resultKey: 'advertiser',
    limit: [25, 60] // 25 requests per minute max
  },
  links: {
    url: 'https://linksearch.api.cj.com/v2',
    action: 'link-search',
    qs: {
      'website-id': '{{website-id}}',
      'advertiser-ids': 'joined',
      // 'link-type': 'text', // now scanning all links and filtering the list down to just text links, so this is disabled
    },
    bodyKey: 'cj-api.links',
    resultKey: 'link',
    limit: [25, 60]
  },
  commissions: {
    url: 'https://commission-detail.api.cj.com/v3',
    action: 'commissions',
    qs: {
      'date-type': 'posting',
      'start-date': null,
      'end-date': null
    },
    bodyKey: 'cj-api.commissions',
    resultKey: 'commission',
    limit: null // cj doesn't say they limit this api -- bypass rate limiting
  }
};

const activeClients = {};

function commissionJunctionClient(s_entity, s_region, s_type) {
  if (!s_entity) throw new Error("Missing required argument 's_entity'!");
  if (!s_region) throw new Error("Missing required argument 's_region'!");
  if (!API_CFG[s_entity]) throw new Error("Entity '"+s_entity+"' is not defined in API_CFG.");
  if (!API_CFG[s_entity][s_region]) throw new Error("Region '"+s_region+"' for entity '"+s_entity+"' is not defined in API_CFG.");
  if (!API_TYPES[s_type]) throw new Error("Unknown CJ API type: "+s_type);

  const _tag = s_entity + '-' + s_region + '-' + s_type;
  if (activeClients[_tag]) return activeClients[_tag];

  let cfg = API_CFG[s_entity][s_region];
  let c_type = API_TYPES[s_type];

  const client = request.defaults({
    baseUrl: c_type.url,
    url: c_type.action,
    json: false,
    simple: true,
    resolveWithFullResponse: false,
    headers: {
      authorization: cfg.key,
      accept: 'application/xml'
    }
  });

  client.getMerchants = co.wrap(function* () {
    return yield client.pagedApiCall();
  });

  client.getLinks = co.wrap(function* () {
    c_type.qs['website-id'] = cfg.siteId;
    return yield client.pagedApiCall();
  });

  client.getCommission = co.wrap(function* (dateStart, dateEnd) {
    c_type.qs['start-date'] = dateStart;
    c_type.qs['end-date'] = dateEnd;
    let arg = {qs: c_type.qs};

    debug("getCommission for period starting from %s until %s (%s)", dateStart, dateEnd, JSON.stringify({args:arg}));

    let ret = yield client.get(arg).then(jsonify);
    let info = _.get(ret, c_type.bodyKey);
    let meta = info.$;
    let results = info[c_type.resultKey] || [];

    return results;
  });

  client.pagedApiCall = co.wrap(function* () {
    let perPage = 100;  // max. 100 per API Server
    let page = 0;
    let results = [];
    let total = 0;
    let start = Date.now();

    while (true) {
      let arg = {qs: _.extend({}, c_type.qs, {'page-number':++page, 'records-per-page':perPage})};

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
    limiter.request(client, num, time).debug(debug);
  }

  activeClients[_tag] = client;

  return client;
}

module.exports = commissionJunctionClient;
