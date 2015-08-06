"use strict";

const ZANOX_CONNECT_ID  = '05523FA4A5AB834CA23D';
const ZANOX_SECRET_KEY = '7F690371bc3443+dbeF22E2b292495/300f3b543';

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
