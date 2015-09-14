"use strict";

const _ = require('lodash');
const co = require('co');
const debug = require('debug')('taskbox:tasks');
const prettyMs = require('pretty-ms');
const schedule = require('node-schedule');
const uuid = require('node-uuid');

module.exports = setup;

function setup(log) {
  var isDev = /^dev/.test(process.env.NODE_ENV);
  var runOnStartOnly = !!process.env.RUN_ON_START_ONLY;
  var runOnStart = runOnStartOnly || !!process.env.RUN_ON_START;

  var schedules = {};
  createTask.createGroup = createGroup;
  return createTask;

  function taskRunner(name, task, logger) {
    return function() {
      var subLogger = logger.child({
        invocationId: uuid.v4(),
        invocationTime: new Date()
      });
      var taskContext = { log: subLogger };
      var taskBound = task.bind(taskContext);

      var start = Date.now();
      subLogger.info(name +" started");
      co(taskBound).then(function(result) {
        var end = Date.now();
        var elapsed = prettyMs(end-start, {verbose:true});
        subLogger.info({result:result,elapsedTime:elapsed}, name + " successfully completed in "+ elapsed);
      }).catch(function(error) {
        if (error === "already-running") {
          debug(name + " is currently already running. Waiting until next run-time");
          return;
        }
        subLogger.error(name + " ERROR OCCURED: " + ('stack' in error) ? error.stack : error);
      });
    };
  }

  function createTask(name, task, spec) {
    // using task_t so i can pretend i'm a C programmer for a line of code
    var task_t = typeof task, isTask = task_t === 'function';
    if (!isTask) throw new Error("can't create task for "+name+": passed task is not a function! (is:"+task_t+")");
    var id = name.replace(/\W+/g, '-').toLowerCase();
    if (schedules[id]) throw new Error("Task with id "+id+" has already been defined! Task names must be unique!");
    var rule = new schedule.RecurrenceRule();
    _.extend(rule, spec);
    var taskLogger = log.child({
      taskId: id,
      runSpec: JSON.stringify(spec)
    });

    if (!isDev || !runOnStartOnly) {
      taskLogger.info("Schedule task: "+name);
      schedules[id] = schedule.scheduleJob(spec, taskRunner(name, task, taskLogger));
    }

    if (isDev && runOnStart) {
      debug("Dev Mode: Starting task `%s` immediately", id);
      taskRunner('(dev-autostart) '+name, task, taskLogger.child({autoStarted:true}))();
    }
  }

  function createGroup(i_numberOfHours, o_taskSet) {
    if (24 % i_numberOfHours !== 0) throw new Error("number of hours must cleanly divide into 24 hours!");
    const mult = 24 / i_numberOfHours;
    const taskNames = _.shuffle(Object.keys(o_taskSet));
    const numTasks = taskNames.length;
    const timeBetweenTasks = i_numberOfHours / numTasks;
    let time = 0;
    taskNames.forEach(name => {
      const hours = Math.floor(time);
      const minutes = Math.floor((time-hours) * 60);
      const hoursArray = [];
      for (let i = 0; i < mult; i++) {
        hoursArray.push(hours + (i*i_numberOfHours));
      }
      const spec = {hour:hoursArray, minute:minutes};
      createTask(name, o_taskSet[name], spec);
      time += timeBetweenTasks;
    });
  }

}
