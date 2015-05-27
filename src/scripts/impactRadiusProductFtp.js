"use strict";

var _ = require('lodash');
var AWS = require('aws-sdk');
var co = require('co');
var cofy = require('cofy');
var debug = require('debug')('impactradius:ftp');
var FtpClient = require('ftp');
var path = require('path');
require('promise.prototype.finally');

AWS.config.region = 'us-east-1';

cofy.class(FtpClient);
// cofy.class(AWS.S3);

var connectionCreds = {
  host: "products.impactradius.com",
  user: "ps-ftp_155520",
  password: "EtQQMmRVjb"
};
var s3_bucket = 'automation-352228731405';
var filePattern = /_IR\.csv\.gz$/;
var lastProcessed = {};
var s3client = new AWS.S3();
cofy.object(s3client);

var productFetchRunning = false;
function* getProducts() {
  if (productFetchRunning) { throw "already-running"; }
  productFetchRunning = true;
  try {
    var fileList = yield allFiles();
    yield processFiles(fileList);
  } finally {
    productFetchRunning = false;
  }
}

function allFiles() {
  return co(function*() {
    var ftp = yield getFtp();
    var list = yield _fetch(ftp, '/');
    ftp.end();
    return list;
  });

  function _fetch(ftp, dir) {
    return co(function*() {
      var results = [];
      debug("get file list for dir %s", dir);
      var list = yield ftp.$list(dir, true);
      list.forEach(x => x.path = path.join(dir, x.name));
      var item, i;
      for (i = 0; i < list.length; i++) {
        item = list[i];
        if (item.type === 'd') {
          results = results.concat(yield _fetch(ftp, item.path));
        } else if (_fresh(item)) {
          debug("found item %s", item.path);
          results.push(_.pick(item, 'path', 'date'));
        }
      }
      return _.sortBy(results, 'path');
    });
  }

  function _fresh(item) {
    if (item.type !== '-') return false;
    if (!filePattern.test(item.name)) return false;

    var entry = lastProcessed[item.path];
    if (!entry) return true;
    if (entry < item.date) return true;

    return false;
  }
}

function processFiles(list) {
  return co(function*(){
    for (var i = 0; i<list.length; i++) {
      var entry = list[i];
      var data = yield getFile(list[i].path);
      var response = yield s3client.$putObject({
        Bucket: s3_bucket,
        Key: 'impactradius/productftp' + entry.path,
        Body: data
      });
    }
  });
}

function getFile(filePath) {
  return co(function*() {
    var ftp = yield getFtp();
    debug("fetching file %s", filePath);
    var data = yield ftp.$get(filePath, true);
    return data;
  });
}

function getFtp() {
  return new Promise(function(resolve, reject) {
    var ftp = new FtpClient();
    ftp.on('ready', resolve.bind(null, ftp));
    ftp.on('error', reject);
    debug("ftp connection started");
    var _end = ftp.end;
    ftp.end = function() {
      debug("ftp connection closed");
      _end.apply(this, arguments);
    };
    ftp.connect(connectionCreds);
  });
}

module.exports = {
  getProducts: getProducts
};
