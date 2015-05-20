(function() {
  "use strict";

  var cluster = require('cluster');
  var configs = require('../configs.json');
  var uuid = require('node-uuid');
  var bunyan = require('bunyan');
  var co = require('co');
  var schedule = require('node-schedule');

  var getImpactRadiusProducts = require("./scripts/impactRadiusProductFtp");
  var clickJunctionApi = require("./scripts/clickJunctionApi");
  var impactRadiusApi = require("./scripts/impactRadiusApi");

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

    var name = id + ":data:api";
    var log = bunyan.createLogger({
      name: name,
      serializers: bunyan.stdSerializers
    });

    var schedules = {};

    schedules.impactRadiusProductFtp = schedule.scheduleJob({minute: 1}, function(){
      getImpactRadiusProducts();
    });

    schedules.clickJunctionApiMerchants = schedule.scheduleJob({minute: 5}, function(){
      clickJunctionApi.getMerchants();
    });

    schedules.impactRadiusApiMerchants = schedule.scheduleJob({minute: 5}, function(){
      impactRadiusApi.getMerchants();
    });

    schedules.clickJunctionApiCommissions = schedule.scheduleJob({minute: [0,10,20,30,40,50]}, function(){
      clickJunctionApi.getCommissionDetails();
    });

    schedules.impactRadiusApiCommisions = schedule.scheduleJob({minute: [0,10,20,30,40,50]}, function(){
      impactRadiusApi.getCommissionDetails();
    });

    //impactRadiusApi.getCommissionDetails();
    
  }

  module.exports = {
    init: init
  };

  return module.exports;
})();
