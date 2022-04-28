"use strict";

var os = require('os');
var crypto = require('crypto');
var hostname = os.hostname();
var environment = process.env.NODE_ENV || process.argv[2] || 'dev';
process.env.NODE_ENV = environment;
var app = require('./app');

// Temporary Fix: If current environment is not prod then there is no need to run taskbox.
// Once the mock data will be provided for taskbox affiliate apis this will go away.
// To test the affiliate apis you need to login to instance and run it for specific merchant manually.
if (environment !== 'prod') {
  return;
}

if (environment == 'dev' || environment == 'development') {
  app.init('dev:dev');
} else {
  var machineHash = crypto.createHash('md5').update(hostname).digest('hex');
  app.init(machineHash + ":" + environment);
}
