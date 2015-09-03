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

const ALL_TASKS = {};
const logger = bunyan.createLogger({ name: 'task-runner', serializers: bunyan.stdSerializers });
const go = co.wrap(_go);

startup();

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

function startup() {
  const _id = n => n.toLowerCase().replace(/\W+/g, '-').replace(/(^-|-$)/g, '');
  const register = (name, func) => ALL_TASKS[_id(name)] = {desc:name, handler:func};
  register.createGroup = (n, defs) => Object.keys(defs).forEach(n => register(n, defs[n]));
  tasks(register);
}

function list(patt) {
  const filt = patt === true ? (id => true) : (id => id.indexOf(patt) > -1);
  Object.keys(ALL_TASKS)
    .sort()
    .filter(filt)
    .forEach(id => console.log("  " + id));
  return Promise.resolve();
}

function doError(msg) {
  console.error("");
  console.error(msg);
  help();
  process.exit();
}

function run(id) {
  if (id === true) doError("No task specified!");
  if (!ALL_TASKS[id]) doError("Task `"+id+"` does not exist!");
  // if (!id) throw new Error("")
  const name = ALL_TASKS[id].desc;
  const ctx = { log: logger, task: name };
  const fn = ALL_TASKS[id].handler.bind(ctx);
  const p = (co(fn)
    .then(result => result && console.log("Result: ", result))
    .catch(error => error && console.error("Error: ", error.stack))
    .then(() => console.log("task "+name+" ("+id+") completed")));
  return p;
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
