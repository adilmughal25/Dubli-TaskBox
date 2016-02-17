#!/usr/bin/env node --harmony
"use strict";

// force some things on.
process.env.DEBUG = '*';
process.env.NODE_ENV = 'dev';
process.env.SAVE_MERCHANTS = 1;
process.env.SAVE_COMMISSIONS = 1;

// getTasks() is basically just `require('../tasks')`, except that it shuts debug up for a while
const tasks = getTasks();
const debug = require('debug')('task-runner');

const bunyan = require('bunyan');
const co = require('co');
const minimist = require('minimist');

const logger = bunyan.createLogger({ name: 'task-runner', serializers: bunyan.stdSerializers });
const tasker = tasks(logger, true);
const go = co.wrap(_go);

go()
  .catch(e => console.log("ERROR", e.stack))
  .then(process.exit);

function* _go() {
  const args = minimist(process.argv.slice(2));
  if (args.list) return yield list(args.list);
  if (args.run) return yield run(args.run);
  help();
  return;
}

function help() {
  const me = process.argv[1];
  console.log("");
  console.log("Usage: "+me+" [--list|--list search-string|--run task-id]");
  console.log("  if search-string is specified to --list, filters to only tasks whose id contains that search-string (using indexOf)");
  console.log("");
  console.log("  this script is also registered in package.json, using these shortcuts:");
  console.log("     npm run task-list");
  console.log("     npm run task-list [search-string]");
  console.log("     npm run task [task-name]");
}

function list(patt) {
  const filt = patt === true ? (id => true) : (id => id.indexOf(patt) > -1);
  const _debug = require('debug');
  const orig = _debug.log;
  _debug.log = function() {};
  return tasker.report().then(function(taskList) {
    _debug.log = orig;
    taskList.map(x => x.id)
      .sort()
      .filter(filt)
      .forEach(id => console.log("  " + id));
  });
}

function doError(msg) {
  console.error("");
  console.error(msg);
  help();
  process.exit();
}

function run(id) {
  return (tasker.run(id)
    .then(result => result && console.log("Result: ", result))
    .catch(error => error && console.error("Error: ", error.stack))
    .then(() => console.log("task "+id+" completed")));
}

// getTasks() is basically just `require('../tasks')`, except that it shuts debug up for a while
function getTasks() {
  const _debug = require('debug');
  const orig = _debug.log;
  _debug.log = function() {};
  const tasks = require('../tasks');
  _debug.log = orig;
  return tasks;
}
