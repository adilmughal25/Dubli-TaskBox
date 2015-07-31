"use strict";

var co = require('co');
var wait = require('co-waiter');
var uuid = require('node-uuid');
var utils = require('ominto-utils');
var prettyMs = require('pretty-ms');
var o_configs = require('../../../configs');
var denodeify = require('denodeify');
var gzip = denodeify(require('zlib').gzip);
var _check = utils.checkApiResponse;
var createEnvelope = utils.createEnvelope;
var dataService = utils.getDataClient(o_configs.data_api.url, o_configs.data_api.auth);

const MAX_UNGZIPPED_SIZE = 32 * 1024; // if it's over 32kb, gzip it

var send = co.wrap(function* (s_myName, s_streamName, s_streamType, s_taskName, items) {
  var debug = _debug(s_myName);
  var s_url = '/event/' + s_streamName;
  var a_trigger = [{
    task: s_taskName,
    timestamp: new Date()
  }];
  var errors = [];
  var allStart = Date.now();
  var allCount = 0;
  var compressedCount = 0;
  var compressionTime = 0;
  debug("got %d events from %s to process!", items.length, s_taskName);
  for (var i = 0; i < items.length; i++) {
    try {
      var item = items[i];
      var o_flags = {};
      var s_item = JSON.stringify(item);
      if (s_item.length > MAX_UNGZIPPED_SIZE) {
        debug("item size is %d, max un-gzipped size is %d, compressing!", s_item.length, MAX_UNGZIPPED_SIZE);
        var start = Date.now();
        item = yield gzip(s_item);
        compressionTime += (Date.now() - start);
        o_flags.gzipped_data = true;
      }

      var envelope = createEnvelope(s_streamType, {}, item, o_flags, a_trigger);
      var params = { url: s_url, body: envelope };
      var checker = _check(202, 'could not save kinesis stream event: '+JSON.stringify(envelope));
      yield dataService.put(params).then(checker);
      allCount++;
      if (o_flags.gzipped_data) { compressedCount++; }
    } catch (e) {
      errors.push(e);
    }
  }
  var allEnd = Date.now();
  var allElapsed = allEnd - allStart;

  var uncompressedCount = allCount - compressedCount;

  debug("processed: %d, uncompressed: %d, compressed: %d, errors: %d, time spent compressing: %s, total save time: %s",
    allCount, uncompressedCount, compressedCount, errors.length,
    prettyMs(compressionTime, {verbose: true}),
    prettyMs(allElapsed, {verbose: true})
  );

  if (errors.length) {
    var msg = ["Received "+errors.length+" errors while sending "+items.length+" kinesis events:"]
      .concat(errors.map( (e,i) => "#" + (i+1) + ": " + e.message ))
      .join('\n    ');
    throw new Error(msg);
  }

  return;
});

var DEV_SAVE_MERCHANTS = (process.env.NODE_ENV === 'dev' && process.env.SAVE_MERCHANTS);
function devSaveMerchants(s_which, a_items) {
  if (!DEV_SAVE_MERCHANTS) return;
  var resolve = require('path').resolve;
  var write = require('fs').writeFile;
  var f = resolve(__dirname, '../../../merchant-output-'+s_which+'.json');
  write(f, JSON.stringify(a_items), 'utf-8', function (e) {
    if (e) return console.error('error saving file', e.stack);
    console.log("\n\n  -> SAVED "+f+'\n');
  });
}


function sendMerchants(s_myName, merchants) {
  var s_streamName = 'merchant';
  var s_streamType = 'merchant:add:' + s_myName;
  var s_taskName = 'tasks:' + s_myName + ':api';

  devSaveMerchants(s_myName, merchants);
  return send(s_myName, s_streamName, s_streamType, s_taskName, merchants);
}

function sendCommissions(s_myName, commissions) {
  var s_streamName = 'transaction';
  var s_streamType = 'transaction:update';
  var s_taskName = 'tasks:' + s_myName + ':commission-processor';
  return send(s_myName, s_streamName, s_streamType, s_taskName, commissions);
}

var _dbgCache = {};
function _debug(s_name) {
  if (!process.env.DEBUG) return () => {};
  if (!_dbgCache[s_name]) _dbgCache[s_name] = require('debug')('send-events:'+s_name);
  return _dbgCache[s_name];
}

module.exports = {
  sendMerchants: sendMerchants,
  sendCommissions: sendCommissions
};
