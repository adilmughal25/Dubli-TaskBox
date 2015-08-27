"use strict";

const configs = require('../configs.json');
const uuid = require('node-uuid');
const bunyan = require('bunyan');
const co = require('co');
const schedule = require('node-schedule');
const debug = require('debug')('taskbox:tasks');
const _ = require('lodash');
const prettyMs = require('pretty-ms');

const affiliateTasks = require('./affiliate-tasks');
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
  var isDev = /^dev/.test(process.env.NODE_ENV);
  var runOnStartOnly = !!process.env.RUN_ON_START_ONLY;
  var runOnStart = runOnStartOnly || !!process.env.RUN_ON_START;

  var schedules = {};

  ftpToS3(log, configs.ftpToS3);
  affiliateTasks.init(createTask);
  createTask('TownClock SNS Ping', snsPing.ping, {minute: [0,15,30,45]});

  function taskRunner(name, task) {
    return function() {
      var start = Date.now();
      log.info(name +" started");
      co(task).then(function() {
        var end = Date.now();
        var elapsed = prettyMs(end-start, {verbose:true});
        log.info(name + " successfully completed in "+ elapsed);
      }).catch(function(error) {
        if (error === "already-running") {
          debug(name + " is currently already running. Waiting until next run-time");
          return;
        }
        log.error(name + " ERROR OCCURED: " + ('stack' in error) ? error.stack : error);
      });
    };
  }

  function createTask(name, task, spec) {
    // using task_t so i can pretend i'm a C programmer for a line of code
    var task_t = typeof task, isTask = task_t === 'function';
    if (!isTask) throw new Error("can't create task for "+name+": passed task is not a function! (is:"+task_t+")");
    var id = name.replace(/(?:\W+|^)(\w)/g, (m,letter) => letter.toUpperCase());
    var rule = new schedule.RecurrenceRule();
    _.extend(rule, spec);

    if (!isDev || !runOnStartOnly) {
      // log.info("Schedule task: "+name+" ("+id+") with spec: "+JSON.stringify(spec)+"");
      schedules[id] = schedule.scheduleJob(spec, taskRunner(name, task));
    }

    if (isDev && runOnStart) {
      debug("Dev Mode: Starting task `%s` immediately", id);
      taskRunner('(dev-autostart) '+name, task)();
    }
  }
}

module.exports = {
  init: init
};
