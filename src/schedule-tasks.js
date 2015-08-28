"use strict";

const _ = require('lodash');
const co = require('co');
const debug = require('debug')('taskbox:tasks');
const prettyMs = require('pretty-ms');
const schedule = require('node-schedule');

module.exports = setup;

function setup(log) {
  var isDev = /^dev/.test(process.env.NODE_ENV);
  var runOnStartOnly = !!process.env.RUN_ON_START_ONLY;
  var runOnStart = runOnStartOnly || !!process.env.RUN_ON_START;

  var schedules = {};
  return createTask;

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
