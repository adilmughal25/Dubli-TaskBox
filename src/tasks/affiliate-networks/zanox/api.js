"use strict";

const denodeify = require('denodeify');
const zanox_req = require('./zanox');
const debug = require('debug')('adcell:api-client');

const API_CFG = {
  ominto: {
    global: {
      connectId: '05523FA4A5AB834CA23D',
      secretKey: '7F690371bc3443+dbeF22E2b292495/300f3b543',
    }
  },
  dubli: {
    de: {
      connectId: 'B3BDAC24C1DAA7DC5A09',
      secretKey: '08b62B43cabA44+491847882Ea8b47/bbbf62b4b',
    },
    es: {
      connectId: '67DDC904C5892BEEBBAC',
      secretKey: '4072aFb8f2DA47+5a5e12c42a9559e/f0f9d1d43',
    },
    au: {
      connectId: 'BF7462542C38A94281A3',
      secretKey: 'baBcc4a6414646+fa385C7c9052f03/8e1b7ed47',
    },
    dk: {
      connectId: 'FBBB9FF48B8BAF972DC2',
      secretKey: 'b5D20F39A1524e+68467cc534241d3/Ea491924b',
    },
    global: {
      connectId: '32E345C490C8778C5166',
      secretKey: 'c28131336e9945+b95c684C621476F/6060a994d',
    },
    se: {
      connectId: '086C05E4EB8A8234E814',
      secretKey: 'ff3ce2a9F4A444+780e00984fc89Cf/aa1910441',
    },
    no: {
      connectId: '00C3C6B4044935C6A380',
      secretKey: 'b306F985320d42+8a716b96daf6eB0/0855fC843'
    }
  }
};

function ZanoxApiClient(s_entity, s_region) {
  if (!(this instanceof ZanoxApiClient)) return new ZanoxApiClient(s_entity, s_region);
  if (!s_entity) throw new Error("Missing required argument 's_entity'!");
  if (!s_region) throw new Error("Missing required argument 's_region'!");
  if (!API_CFG[s_entity]) throw new Error("Entity '"+s_entity+"' is not defined in API_CFG.");
  if (!API_CFG[s_entity][s_region]) throw new Error("Region '"+s_region+"' for entity '"+s_entity+"' is not defined in API_CFG.");
  debug("Create new client for entity: %s-%s", s_entity, s_region);

  this.cfg = API_CFG[s_entity][s_region];
  this.client = zanox_req(this.cfg.connectId, this.cfg.secretKey);
  var that = this;

  this.client.getIncentives = function(params, next) {
    return that.client.sendRequest('GET', '/incentives', params, next);
  };

  this.client.getExclusiveIncentives = function(params, next) {
    return that.client.sendRequest('GET', '/incentives/exclusive', params, next);
  };

  Object.keys(this.client).sort().forEach(function(method) {
    if (typeof that.client[method] !== 'function') return;
    const $method = '$' + method;
    that[$method] = denodeify(that.client[method]).bind(that.client);
  });
}

module.exports = ZanoxApiClient;
