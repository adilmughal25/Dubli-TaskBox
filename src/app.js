"use strict";

var configs = require('../configs.json');
var uuid = require('node-uuid');
var bunyan = require('bunyan');
var co = require('co');
var schedule = require('node-schedule');
var debug = require('debug')('taskbox:tasks');
var _ = require('lodash');
var prettyMs = require('pretty-ms');

var affiliatewindowApi = require('./scripts/affiliatewindowApi');
var affilnetApi = require('./scripts/affilinetApi');
var avantlinkApi = require('./scripts/avantlinkApi');
var clickJunctionApi = require("./scripts/clickJunctionApi");
var commissionfactoryApi = require('./scripts/commissionfactoryApi');
var impactRadiusGenericApi = require('./scripts/impactRadiusGenericApi');
var impactRadiusProductFtp = require("./scripts/impactRadiusProductFtp");
var linkShareApi = require("./scripts/linkShareApi");
var pepperjamApi = require('./scripts/pepperjamApi');
var performanceHorizonApi = require('./scripts/performanceHorizonApi');
var publicideasApi = require('./scripts/publicideasApi');
var tradetrackerApi = require('./scripts/tradetrackerApi');
var webgainsApi = require('./scripts/webgainsApi');
var vcommissionApi = require('./scripts/vcommissionApi');
var zanoxApi = require('./scripts/zanoxApi');

var impactRadiusApi = impactRadiusGenericApi('impactradius');
var apdPerformanceApi = impactRadiusGenericApi('apdperformance');

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
  var isDev = /^dev/.test(process.env.NODE_ENV);
  var runOnStart = !!process.env.RUN_ON_START;

  var schedules = {};

  createTask("ImpactRadius Merchants", impactRadiusApi.getMerchants, {minute: 3});
  createTask("LinkShare Merchants", linkShareApi.getMerchants, {minute: 6});
  createTask("ClickJunction Merchants (USA)", clickJunctionApi.getMerchantsUSA, {minute: 9});
  createTask("PerformanceHorizon Merchants", performanceHorizonApi.getMerchants, {minute: 12});
  createTask("Zanox Merchants", zanoxApi.getMerchants, {minute: 15});
  createTask("PepperJam Merchants", pepperjamApi.getMerchants, {minute: 18});
  createTask("VCommission Merchants", vcommissionApi.getMerchants, {minute:21});
  createTask("ClickJunction Merchants (Euro)", clickJunctionApi.getMerchantsEuro, {minute: 24});
  createTask("CommissionFactory Merchants", commissionfactoryApi.getMerchants, {minute:27});
  createTask("AffiliateWindow Merchants", affiliatewindowApi.getMerchants, {minute:30});
  createTask("Avantlink Merchants", avantlinkApi.getMerchants, {minute:33});
  createTask("TradeTracker Merchants", tradetrackerApi.getMerchants, {minute:36});
  createTask("PublicIdeas Merchants", publicideasApi.getMerchants, {minute:39});
  createTask("Webgains Merchants", webgainsApi.getMerchants, {minute:42});
  createTask("APD Performance Merchants", apdPerformanceApi.getMerchants, {minute:45});
  createTask("Affili.Net Merchants", affilnetApi.getMerchants, {minute:48});
  // createTask("", blah.getMerchants, {minute:51});
  // createTask("", blah.getMerchants, {minute:54});
  // createTask("", blah.getMerchants, {minute:57});
  // createTask("", blah.getMerchants, {minute:0});

  // disabled for now:
  //createTask("ImpactRadius Product FTP", impactRadiusProductFtp.getProducts, {minute:1});
  //createTask("ImpactRadius Commissions", impactRadiusApi.getCommissionDetails, {minute: [0,10,20,30,40,50]});
  //createTask("LinkShare Commissions", linkShareApi.getCommissionDetails, {minute: [0,10,20,30,40,50]});
  //createTask("ClickJunction Commissions", clickJunctionApi.getCommissionDetails, {minute: [0,10,20,30,40,50]});


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
    log.info("Schedule task: "+name+" ("+id+") with spec: "+JSON.stringify(spec)+"");
    var rule = new schedule.RecurrenceRule();
    _.extend(rule, spec);
    schedules[id] = schedule.scheduleJob(spec, taskRunner(name, task));

    if (isDev && runOnStart) {
      debug("Dev Mode: Starting task `%s` immediately", id);
      taskRunner('(dev-autostart) '+name, task)();
    }
  }
}

module.exports = {
  init: init
};
