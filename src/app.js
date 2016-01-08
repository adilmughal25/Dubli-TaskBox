"use strict";

const configs = require('../configs.json');
const bunyan = require('bunyan');

const ftpToS3 = require('./ftp-to-s3');
const scheduleTasks = require('./schedule-tasks');
const tasks = require('./tasks');

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

  // set up ftp server for taskbox
  ftpToS3(log, configs.aws.ftpToS3);

  // The Taskmaster:
  const createTask = scheduleTasks(log);
  tasks(createTask);
}

module.exports = {
  init: init
};
