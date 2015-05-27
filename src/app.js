"use strict";

var configs = require('../configs.json');
var uuid = require('node-uuid');
var bunyan = require('bunyan');
var co = require('co');
var schedule = require('node-schedule');

var impactRadiusProductFtp = require("./scripts/impactRadiusProductFtp");
var clickJunctionApi = require("./scripts/clickJunctionApi");
var impactRadiusApi = require("./scripts/impactRadiusApi");
var linkShareApi = require("./scripts/linkShareApi");

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

  var schedules = {};

  // already been refactored
  createTask("ImpactRadius Product FTP", impactRadiusProductFtp.getProducts, {minute:1});
  createTask("ImpactRadius Merchants", impactRadiusApi.getMerchants, {minute: 5});
  createTask("ImpactRadius Commissions", impactRadiusApi.getCommissionDetails, {minute: [0,10,20,30,40,50]});
  createTask("LinkShare Merchants", linkShareApi.getMerchants, {minute: 5});
  createTask("LinkShare Commissions", linkShareApi.getCommissionDetails, {minute: [0,10,20,30,40,50]});
  createTask("ClickJunction Merchants", clickJunctionApi.getMerchants, {minute: 5});
  createTask("ClickJunction Commissions", clickJunctionApi.getCommissionDetails, {minute: [0,10,20,30,40,50]});

  function taskRunner(name, task) {
    return function() {
      co(task).then(function() {
        log.info(name + " successfully completed!");
      }).catch(function(error) {
        if (error === "already-running") {
          log.info(name + " is currently already running. Waiting until next run-time");
          return;
        }
        log.error(name + " ERROR OCCURED: " + ('stack' in error) ? error.stack : error);
      });
    };
  }

  function createTask(name, task, spec) {
    var id = name.replace(/(?:\W+|^)(\w)/g, (m,letter) => letter.toUpperCase());
    log.info("Creating task: "+name+" ("+id+") with spec: "+JSON.stringify(spec)+"");
    schedules[id] = schedule.scheduleJob(spec, taskRunner(name, task));

    if ((process.env.NODE_ENV||"").indexOf('dev') === 0) {
      log.info("Dev Mode: Starting task `"+name+"` immediately");
      taskRunner('Development Autostart: '+name, task)();
    }
  }
}

module.exports = {
  init: init
};
