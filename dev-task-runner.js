#!/usr/bin/env node --harmony
"use strict";

process.env.NODE_ENV = 'dev';
process.env.SAVE_MERCHANTS = 1;
process.env.SAVE_COMMISSIONS = 1;

const bunyan = require('bunyan');
const co = require('co');
const minimist = require('minimist');
const tasks = require('./src/tasks');

const ALL_TASKS = {};
const logger = bunyan.createLogger({ name: 'task-runner', serializers: bunyan.stdSerializers });
const go = co.wrap(_go);

startup();

go()
  .catch(e => console.log("ERROR", e))
  .then(process.exit);

function* _go() {
  const args = minimist(process.argv.slice(2));
  if (args.list) return yield list();
  if (args.run) return yield run(args.run);
  help();
  return;
}

function help() {
  const me = process.argv[1];
  console.log("Usage: "+me+" [--list|--run task-id]");
}

function startup() {
  const _id = n => n.toLowerCase().replace(/\W+/g, '-').replace(/(^-|-$)/g, '');
  const register = (name, func) => ALL_TASKS[_id(name)] = {desc:name, handler:func};
  register.createGroup = (n, defs) => Object.keys(defs).forEach(n => register(n, defs[n]));
  tasks(register);
}

function list() {
  Object.keys(ALL_TASKS).sort().forEach(id => console.log("  " + id));
  return Promise.resolve();
}

function run(id) {
  const name = ALL_TASKS[id].name;
  const ctx = { log: logger, task: name };
  const fn = ALL_TASKS[id].handler.bind(ctx);
  const p = (co(fn)
    .then(result => console.log("Result: ", result))
    .catch(error => console.error("Error: ", error.stack))
    .then(() => console.log("DONE!")));
  return p;
}
