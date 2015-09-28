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
      key: '009c8796168d78c027c9b4f1d8ed3902172eefa59512b9f9647482240bcd99d00a70c6358dd2b855f30afeafe055e1c8d99e632a626b1fa073a4092f4dd915e26d/36d998315cefa43e0d0377fff0d89a2fef85907b556d8fc3b0c3edc7a90b2e07fc8455369f721cc69524653234978c36fd12c67646205bf969bfa34f8242de8d',
      siteId: 7811975,
    },
    eu: {
      key: '0095320cfab933ded5d007f9794a48a81cdd8e3c719b82dd1e1a044fa27f8e1703e125b03fab46ade6c01292f4767f96132b7559a574f6af9f4e566357af74b915/6b511e3ef71b158dccdeff973c54b9005269ee96759b133c84d0570bf71e98f46ad60c4cc0590d8453ab0d42d99398991de469e771055d5b353ca518ea169501',
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
      key: '00b21042a59c52663bc280826d7406cf149ea5a8fbfb2e71b901ef447d8e751ada4a03bc80cfc99e9e0c6569c084f3b510409984879c5c5787bd1085361660c3f7/4ad5889cff68a5eca19eceb1df5c69355a43771487890a645d8ac8371862e0e87e0acb6c06fff71e0ddd38a91466507e57f854f7175bf1b4e808f1588e37d289',
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
      key: '00bccee7f7fbb975996d8591a13e1f5ef469fb33401a6b7ccd0e56e108531afb6ed4a0935655eef88b91716cdf5f51526468adf3c2b4dbd40fcfb8b91055fd5f67',
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
