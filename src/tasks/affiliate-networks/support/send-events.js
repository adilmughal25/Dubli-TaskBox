"use strict";

const co = require('co');
const wait = require('co-waiter'); // not used
const uuid = require('node-uuid'); // not used
//const utils = require('ominto-utils');
const prettyMs = require('human-interval');
const o_configs = require('../../../../configs');
const denodeify = require('denodeify');
const gzip = denodeify(require('zlib').gzip);
//const _check = utils.checkApiResponse; // not used
const _ = require('lodash');

//const createEnvelope = utils.createEnvelope; // not used
//const dataService = utils.getDataClient(o_configs.data_api.internalUrl, o_configs.data_api.auth); // not used

const storePayloadInRedis = require('./store-payload-in-redis');
const kinesisPut = require('./direct-kinesis-put');

const MAX_UNGZIPPED_SIZE = 32 * 1024; // if it's over 32kb, gzip it

var send = co.wrap(function* (s_myName, s_streamName, s_streamType, s_taskName, items, options) {
  if (!options) options = {};

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
      if (options.redis) {
        var key = yield storePayloadInRedis(s_item);
        item = {redisDataKey: key};
        debug({stored:item}, 'storing payload data in redis');
      } else {
        if (s_item.length > MAX_UNGZIPPED_SIZE) {
          debug("item size is %d, max un-gzipped size is %d, compressing!", s_item.length, MAX_UNGZIPPED_SIZE);
          var start = Date.now();
          item = {gzippedData: (yield gzip(s_item)).toString('base64')};
          compressedCount += 1;
          compressionTime += (Date.now() - start);
        }
      }

      yield kinesisPut(s_streamName, s_streamType, item, o_flags, s_taskName);

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



var DEV_SAVE_MERCHANTS = (process.env.NODE_ENV === 'test' && process.env.SAVE_MERCHANTS);
function devSaveMerchants(s_which, a_items) {
  //if (!DEV_SAVE_MERCHANTS) return;
  var debug = _debug(s_which);
  var resolve = require('path').resolve;
  var write = require('fs').writeFileSync;
  var f = resolve(__dirname, '../../../../test/output/merchant-output-'+s_which+'.json');
  debug("Saving output file to %s", f);
  write(f, JSON.stringify(a_items), 'utf-8');
  console.log("\n\n  -> SAVED "+f+'\n');
}

var DEV_SAVE_COMMISSIONS = (process.env.NODE_ENV === 'test' && process.env.SAVE_COMMISSIONS);
function devSaveCommissions(s_which, a_items) {
  //if (!DEV_SAVE_COMMISSIONS) return;
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
  return send(s_myName, s_streamName, s_streamType, s_taskName, merchants, {redis:true});
}

function sendCommissions(s_myName, commissions) {
  commissions = _.filter(commissions, function (commission) {
    return commission.transaction_id !== "" && commission.order_id !== ""
  });
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
