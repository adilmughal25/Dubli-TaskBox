"use strict";

var os = require('os');
var crypto = require('crypto');
var hostname = os.hostname();
var environment = process.env.NODE_ENV || process.argv[2] || 'dev';
process.env.NODE_ENV = environment;
var app = require('./app');

if (environment == 'dev' || environment == 'development') {
  app.init('dev:dev');
} else {
  var machineHash = crypto.createHash('md5').update(hostname).digest('hex');
  app.init(machineHash + ":" + environment);
}
