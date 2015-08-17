"use strict";

const configs = require('../configs.json');
const uuid = require('node-uuid');
const bunyan = require('bunyan');
const co = require('co');
const schedule = require('node-schedule');
const debug = require('debug')('taskbox:tasks');
const _ = require('lodash');
const prettyMs = require('pretty-ms');

const ftpToS3 = require('./ftp-to-s3');

const affiliatewindowApi = require('./scripts/affiliatewindowApi');
const avantlinkApi = require('./scripts/avantlinkApi');
const belboonApi = require('./scripts/belboonApi');
const clickJunctionApi = require("./scripts/clickJunctionApi");
const commissionfactoryApi = require('./scripts/commissionfactoryApi');
const impactRadiusProductFtp = require("./scripts/impactRadiusProductFtp");
const linkShareApi = require("./scripts/linkShareApi");
const omgpmApi = require('./scripts/omgpmApi');
const pepperjamApi = require('./scripts/pepperjamApi');
const performanceHorizonApi = require('./scripts/performanceHorizonApi');
const publicideasApi = require('./scripts/publicideasApi');
const tradetrackerApi = require('./scripts/tradetrackerApi');
const webgainsApi = require('./scripts/webgainsApi');
const zanoxApi = require('./scripts/zanoxApi');

const affilinetGenericApi = require('./scripts/affilinetGenericApi');
const affilinetUKApi = affilinetGenericApi('uk');
const affilinetFranceApi = affilinetGenericApi('fr');
const affilinetNetherlandsApi = affilinetGenericApi('nl');
const affilinetSpainApi = affilinetGenericApi('es');
const affilinetGermanyApi = affilinetGenericApi('de');
const affilinetSwitzerlandApi = affilinetGenericApi('ch');
const affilinetAustriaApi = affilinetGenericApi('at');

const impactRadiusGenericApi = require('./scripts/impactRadiusGenericApi');
const impactRadiusApi = impactRadiusGenericApi('impactradius');
const apdPerformanceApi = impactRadiusGenericApi('apdperformance');

const hasoffersGenericApi = require('./scripts/hasoffersGenericApi');
const snapdealApi = hasoffersGenericApi('snapdeal');
const vcommissionApi = hasoffersGenericApi('vcommission');

const adCellApi = require('./scripts/adCellApi');


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

  createTask("Affili.Net (UK) Merchants", affilinetUKApi.getMerchants, {minute:0});
  createTask("ImpactRadius Merchants", impactRadiusApi.getMerchants, {minute: 2});
  createTask("LinkShare Merchants", linkShareApi.getMerchants, {minute: 4});
  createTask("ClickJunction Merchants (USA)", clickJunctionApi.getMerchantsUSA, {minute: 8});
  createTask("Affili.Net (France) Merchants", affilinetFranceApi.getMerchants, {minute:10});
  createTask("PerformanceHorizon Merchants", performanceHorizonApi.getMerchants, {minute: 12});
  createTask("Zanox Merchants", zanoxApi.getMerchants, {minute: 14});
  createTask("PepperJam Merchants", pepperjamApi.getMerchants, {minute: 16});
  createTask("Affili.Net (Netherlands) Merchants", affilinetNetherlandsApi.getMerchants, {minute:18});
  createTask("VCommission Merchants", vcommissionApi.getMerchants, {minute:20});
  createTask("ClickJunction Merchants (Euro)", clickJunctionApi.getMerchantsEuro, {minute: 22});
  createTask("CommissionFactory Merchants", commissionfactoryApi.getMerchants, {minute:24});
  createTask("Affili.Net (Germany) Merchants", affilinetGermanyApi.getMerchants, {minute:26});
  createTask("AffiliateWindow Merchants", affiliatewindowApi.getMerchants, {minute:28});
  createTask("Avantlink Merchants", avantlinkApi.getMerchants, {minute:30});
  createTask("TradeTracker Merchants", tradetrackerApi.getMerchants, {minute:32});
  createTask("Affili.Net (Spain) Merchants", affilinetSpainApi.getMerchants, {minute:34});
  createTask("PublicIdeas Merchants", publicideasApi.getMerchants, {minute:36});
  createTask("Webgains Merchants", webgainsApi.getMerchants, {minute:38});
  createTask("APD Performance Merchants", apdPerformanceApi.getMerchants, {minute:40});
  createTask("Affili.Net (Switzerland) Merchants", affilinetSwitzerlandApi.getMerchants, {minute:42});
  createTask("SnapDeal Merchants", snapdealApi.getMerchants, {minute:44});
  createTask("Belboon Merchants", belboonApi.getMerchants, {minute:46});
  createTask("OMGpm Merchants", omgpmApi.getMerchants, {minute:48});
  createTask("Affili.Net (Austria) Merchants", affilinetAustriaApi.getMerchants, {minute:50});

  // createTask("", blah.getMerchants, {minute:52});
  // createTask("", blah.getMerchants, {minute:54});
  // createTask("", blah.getMerchants, {minute:56});
  // createTask("", blah.getMerchants, {minute:58});

  createTask("ClickJunction (USA) Commissions", clickJunctionApi.getCommissionDetailsUSA, {minute: 0});
  createTask("PepperJam Commissions", pepperjamApi.getCommissionDetails, {minute:2});
  createTask("ImpactRadius Commissions", impactRadiusApi.getCommissionDetails, {minute: 4});
  createTask("ClickJunction (Euro) Commissions", clickJunctionApi.getCommissionDetailsEuro, {minute: 6});
  createTask("APD Performance Commissions", apdPerformanceApi.getCommissionDetails, {minute:8});
  createTask("Zanox Commissions", zanoxApi.getCommissionDetails, {minute:10});
  createTask("Affili.Net (UK) Commissions", affilinetUKApi.getCommissionDetails, {minute:12});
  createTask("Affili.Net (France) Commissions", affilinetFranceApi.getCommissionDetails, {minute:14});
  createTask("Affili.Net (Netherlands) Commissions", affilinetNetherlandsApi.getCommissionDetails, {minute:16});
  createTask("Affili.Net (Spain) Commissions", affilinetSpainApi.getCommissionDetails, {minute:18});
  createTask("Affili.Net (Germany) Commissions", affilinetGermanyApi.getCommissionDetails, {minute:20});
  createTask("Affili.Net (Switzerland) Commissions", affilinetSwitzerlandApi.getCommissionDetails, {minute:22});
  createTask("Affili.Net (Austria) Commissions", affilinetAustriaApi.getCommissionDetails, {minute:24});
  createTask("AffiliateWindow Commissions", affiliatewindowApi.getCommissionDetails, {minute:26});

  //createTask("LinkShare Commissions", linkShareApi.getCommissionDetails, {minute: 0});

  // disabled for now:
  //createTask("ImpactRadius Product FTP", impactRadiusProductFtp.getProducts, {minute:1});

	createTask("AdCell Merchants", adCellApi.getMerchants, {minute:28});

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
