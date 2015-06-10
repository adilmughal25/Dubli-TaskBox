"use strict";
var uuid = require('node-uuid');
var utils = require('ominto-utils');
var o_configs = require('../../configs');
var debug = require('debug')('send-events');
var _check = utils.checkApiResponse;
var createEnvelope = utils.createEnvelope;
var dataService = utils.getDataClient(o_configs.data_api.url, o_configs.data_api.auth);

function send(s_streamName, s_streamType, s_taskName, items) {
  var s_url = '/event/' + s_streamName;
  var o_trigger = {
    task: s_taskName,
    timestamp: new Date()
  };
  var promises = items.map(function(item) {
    var envelope = createEnvelope(s_streamType, {}, item, {}, [o_trigger]);
    var params = { url: s_url, body: envelope };
    var checker = _check(202, 'could not save kinesis stream event: '+JSON.stringify(envelope));
    debug("sending to kinesis stream `%s` with type `%s` and data %s", s_url, s_streamType, JSON.stringify(item));
    var promise = dataService.put(params).then(checker);
    return promise;
  });
  return Promise.all(promises);
}

function sendMerchants(s_myName, merchants) {
  var s_streamName = 'merchant';
  var s_streamType = 'merchant:add:' + s_myName;
  var s_taskName = 'tasks:' + s_myName + ':api';
  return send(s_streamName, s_streamType, s_taskName, merchants);
}

function sendCommissions(s_myName, commissions) {
  var s_streamName = 'merchant';
  var s_streamType = 'merchant:commission:' + s_myName;
  var s_taskName = 'tasks:' + s_myName + ':api';
  return send(s_streamName, s_streamType, s_taskName, commissions);
}

module.exports = {
  sendMerchants: sendMerchants,
  sendCommissions: sendCommissions
};
