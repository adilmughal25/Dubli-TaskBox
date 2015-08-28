"use strict";

const ZANOX_CONNECT_ID  = '05523FA4A5AB834CA23D';
const ZANOX_SECRET_KEY = '7F690371bc3443+dbeF22E2b292495/300f3b543';

/*
 * DubLi legacy 
 * 
 * DE => ConnectId=B3BDAC24C1DAA7DC5A09, SecretKey=08b62B43cabA44+491847882Ea8b47/bbbf62b4b, PublicKey=351830A4BD6B7922A7E8,
 * ES => ConnectId=67DDC904C5892BEEBBAC, SecretKey=4072aFb8f2DA47+5a5e12c42a9559e/f0f9d1d43, PublicKey=27E55614E0EB039E5092,
 * AU =>  ConnectId=BF7462542C38A94281A3, SecretKey=baBcc4a6414646+fa385C7c9052f03/8e1b7ed47, PublicKey=FA250AB4DE8A4250867A,
 * DK => ConnectId=FBBB9FF48B8BAF972DC2, SecretKey=b5D20F39A1524e+68467cc534241d3/Ea491924b, PublicKey=00CEC4642A18408DB387,
 * Global => ConnectId=32E345C490C8778C5166, SecretKey=c28131336e9945+b95c684C621476F/6060a994d, PublicKey=A19B7754F4FBB76ECECD,
 * SE => ConnectId=086C05E4EB8A8234E814, SecretKey=ff3ce2a9F4A444+780e00984fc89Cf/aa1910441, PublicKey=54ECCAC4CB89413B1655,
 * NO => ConnectId=00C3C6B4044935C6A380, SecretKey=b306F985320d42+8a716b96daf6eB0/0855fC843, PublicKey=7057E1B4CD9A92973FCB,
 */
//const ZANOX_CONNECT_ID  = 'B3BDAC24C1DAA7DC5A09';
//const ZANOX_SECRET_KEY = '08b62B43cabA44+491847882Ea8b47/bbbf62b4b';

const denodeify = require('denodeify');
const zanox_req = require('zanox_js');

function createClient() {
  const client = zanox_req(ZANOX_CONNECT_ID, ZANOX_SECRET_KEY);

  client.getIncentives = function(params, next) {
    return client.sendRequest('GET', '/incentives', params, next);
  };

  client.getExclusiveIncentives = function(params, next) {
    return client.sendRequest('GET', '/incentives/exclusive', params, next);
  };

  Object.keys(client).forEach(function(method) {
    if (typeof client[method] !== 'function') return;
    const $method = '$' + method;
    client[$method] = denodeify(client[method]).bind(client);
  });

  return client;
}

module.exports = createClient;
