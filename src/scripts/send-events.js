"use strict";

var dataService = require('ominto-utils').getDataClient(require('../../configs').data_api.url, require('../../configs').data_api.auth);
var debug = require('debug')('send-events');

function send(s_streamName, s_streamType, s_taskName, items) {
  var s_url = '/event/' + s_streamName;
  var promises = [];
  items.forEach(function(item) {
    var params = {
      url: s_url,
      body: {
        type: s_streamType,
        data: item,
        trigger: [{
          task: s_taskName,
          timestamp: new Date()
        }]
      }
    };
    debug("sending to kinesis stream `%s` with type `%s` and data %s", s_url, s_streamType, JSON.stringify(item));
    promises.push(dataService.put(params));
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
