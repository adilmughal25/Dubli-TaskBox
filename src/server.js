(function() {
  "use strict";

  var cluster = require('cluster');
  var os = require('os');
  var crypto = require('crypto');
  var numCPUs = os.cpus().length;
  var hostname = os.hostname();
  var environment = process.env.NODE_ENV || process.argv[2] || 'dev';
  process.env.NODE_ENV = environment;
  var app = require('./app');

  if(environment == 'dev' || environment == 'development') {
    app.init('dev:dev');
  } else {
    if (cluster.isMaster) {
      for (var i = 0; i < numCPUs; i++) {
        cluster.fork();
      }
      cluster.on('fork', function(worker) {
        console.log('worker ' + worker.id + ' fork');
      });
      cluster.on('listening', function(worker, address) {
        console.log('worker ' + worker.id + ' listening');
      });
      cluster.on('online', function(worker) {
        console.log('worker ' + worker.id + ' online');
      });
      cluster.on('disconnect', function(worker) {
        console.log('worker ' + worker.id + ' disconnected');
      });
      cluster.on('exit', function(worker, code, signal) {
        console.log('worker ' + worker.id + ' died');
      });
    } else {
      var machineHash = crypto.createHash('md5').update(hostname).digest('hex');
      app.init(machineHash + ":" + cluster.worker.id);
      cluster.worker.on('message', function(msg) {
        console.log('worker ' + worker.id + ' message', msg);
      });
    }
  }
})();
