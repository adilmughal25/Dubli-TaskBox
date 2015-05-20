(function() {
  "use strict";

  var cluster = require('cluster');
  var configs = require('../configs.json');
  var uuid = require('node-uuid');
  var bunyan = require('bunyan');
  var co = require('co');
  var schedule = require('node-schedule');

  var getImpactRadiusProducts = require("./scripts/impactRadiusProductFtp");
  var clickJunctionApiMerchants = require("./scripts/clickJunctionApi");

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

    var impactRadiusProductFtpSchedule = schedule.scheduleJob({minute: 1}, function(){
      getImpactRadiusProducts();
    });

    var clickJunctionApiMerchantsSchedule = schedule.scheduleJob({minute: 5}, function(){
      clickJunctionApiMerchants();
    });

    
  }

  module.exports = {
    init: init
  };

  return module.exports;
})();
