"use strict";

const configs = require('../configs.json');
const bunyan = require('bunyan');

const scheduleTasks = require('./schedule-tasks');
const affiliates = require('./affiliate-tasks'); // perhaps put this in ./tasks/affiliate-networks/index.js later?
const ftpToS3 = require('./ftp-to-s3');
const snsPing = require('./tasks/sns-ping');

function init(id) {
  process.on('message', function(msg) {
    console.log("MSG", msg);
    //TODO - if its a "stop" command, then stop listening and kill yourself the cluster way
  });
  process.once('SIGTERM', function() {
    //TODO - stop listening of course, and kill yourself the cluster way
    process.exit(0);
  });
  process.once('SIGINT', function() {
    //TODO - stop listening of course, and kill yourself the cluster way
    process.exit(0);
  });

  var name = id + ":taskbox";
  var log = bunyan.createLogger({
    name: name,
    serializers: bunyan.stdSerializers
  });
  log.level(configs.logLevel);

  // The Task Master:
  const createTask = scheduleTasks(log);

  // set up ftp server for taskbox
  ftpToS3(log, configs.ftpToS3);

  // all affiliate tasks are handled here:
  affiliates.init(createTask);

  // other miscellaneous tasks
  createTask('TownClock SNS Ping', snsPing.ping, {minute: [0,15,30,45]});
}

module.exports = {
  init: init
};
