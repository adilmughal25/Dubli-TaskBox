"use strict";

var co = require('co');
var wait = require('co-waiter');
var uuid = require('node-uuid');
var utils = require('ominto-utils');
var prettyMs = require('pretty-ms');
var o_configs = require('../../../../configs');
var denodeify = require('denodeify');
var gzip = denodeify(require('zlib').gzip);
var _check = utils.checkApiResponse;
var createEnvelope = utils.createEnvelope;
var dataService = utils.getDataClient(o_configs.data_api.url, o_configs.data_api.auth);
var kinesisClient = utils.kinesisClient(o_configs);
var kinesisPut = co.wrap(kinesisClient.putEventFromTaskbox);

const MAX_UNGZIPPED_SIZE = 32 * 1024; // if it's over 32kb, gzip it

var send = co.wrap(function* (s_myName, s_streamName, s_streamType, s_taskName, items) {
  var debug = _debug(s_myName);

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

      var checker = _check('could not save kinesis stream event: '+JSON.stringify(items[i]));
      yield kinesisPut(s_streamName, s_streamType, item, o_flags, s_taskName).then(checker);

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
      .concat(errors.map( (e,i) => "#" + (i+1) + ": " + e.stack ))
      .join('\n    ') + "\n  --";
    throw new Error(msg);
  }

  const report = {
    timeSpentSaving: prettyMs(allElapsed, {verbose: true}),
    timeSpentCompressing: prettyMs(compressionTime, {verbose: true}),
    totalSentToKinesis: allCount,
    compressedCount: compressedCount,
    uncompressedCount: uncompressedCount,
    errorCount: errors.length
  };

  if (errors.length) {
    report.errors = errors;
  }

  return report;
});

var DEV_SAVE_MERCHANTS = (process.env.NODE_ENV === 'dev' && process.env.SAVE_MERCHANTS);
function devSaveMerchants(s_which, a_items) {
  if (!DEV_SAVE_MERCHANTS) return;
  var debug = _debug(s_which);
  var resolve = require('path').resolve;
  var write = require('fs').writeFileSync;
  var f = resolve(__dirname, '../../../../test/output/merchant-output-'+s_which+'.json');
  debug("Saving output file to %s", f);
  write(f, JSON.stringify(a_items), 'utf-8');
  console.log("\n\n  -> SAVED "+f+'\n');
}

var DEV_SAVE_COMMISSIONS = (process.env.NODE_ENV === 'dev' && process.env.SAVE_COMMISSIONS);
function devSaveCommissions(s_which, a_items) {
  if (!DEV_SAVE_COMMISSIONS) return;
  var debug = _debug(s_which);
  var resolve = require('path').resolve;
  var write = require('fs').writeFileSync;
  var f = resolve(__dirname, '../../../../test/output/commissions-output-'+s_which+'.json');
  debug("Saving output file to %s", f);
  write(f, JSON.stringify(a_items), 'utf-8');
  console.log("\n\n  -> SAVED "+f+'\n');
}

function sendMerchants(s_myName, merchants) {
  var s_streamName = 'merchant';
  var s_streamType = 'merchant:add:' + s_myName;
  var s_taskName = 'tasks:' + s_myName + ':merchant-importer';

  devSaveMerchants(s_myName, merchants);
  return send(s_myName, s_streamName, s_streamType, s_taskName, merchants);
}

function sendCommissions(s_myName, commissions) {
  var s_streamName = 'transaction';
  var s_streamType = 'transaction:update';
  var s_taskName = 'tasks:' + s_myName + ':commission-processor';

  devSaveCommissions(s_myName, commissions);
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
