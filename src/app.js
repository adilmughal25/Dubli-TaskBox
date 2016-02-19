"use strict";

const configs = require('../configs.json');
const bunyan = require('bunyan');
const path = require('path');
const fs = require('fs');

const monitor = require('./monitor');
const ftpToS3 = require('./ftp-to-s3');
const tasks = require('./tasks');

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

  var name = id + ":taskbox";
  var log = bunyan.createLogger({
    name: name,
    serializers: bunyan.stdSerializers
  });
  log.level(configs.logLevel);

  // set up ftp server for taskbox
  ftpToS3(log, configs.aws.ftpToS3);

  const tasker = tasks(log);
  monitor(tasker);
  taskEvents(tasker, log);
}

function taskEvents (tasker, log) {
  const updateReport = function() {
    // if (process.env.NODE_ENV === 'dev') return;
    tasker.report().then(function(data) {
      const file = process.env.NODE_ENV === 'dev' ?
        path.resolve(__dirname, '..', 'test/output/run-report.json') :
        path.resolve(__dirname, '..', 'logs/run-report.json');
      fs.writeFile(file, JSON.stringify(data), 'utf8');
    });
  };
  const prefix = (t, str) => {
    if (typeof t === 'string') return '['+t+'] '+str;
    if (typeof t === 'object' && t.id) return '['+t.id+'] '+str;
    return str;
  };
  tasker.on('task-start', (task) => {
    log.info(task,  prefix(task, "Started task"));
    updateReport();
  });
  tasker.on('task-error', (task, error) => {
    const msg = error ? ('stack' in error ? error.stack : error) : "Unknown Error";
    log.error(task, prefix(task, "Error running task: "+msg));
    updateReport();
  });
  tasker.on('task-success', (task) => {
    log.info(task, prefix(task, "Task Finished: "));
    updateReport();
  });
  tasker.on('task-cancelled', (task, reason) => {
    log.error(task, prefix(task, "Task was cancelled: `"+reason+"`"));
    updateReport();
  });
  tasker.on("task-will-start", (taskId) => {
    log.info({id: taskId}, prefix(taskId, "Task will start soon"));
    updateReport();
  });
  tasker.on('task-registered', (task) => {
    log.info(task, prefix(task, "Task registered"));
  });

  if (process.env.NODE_ENV !== 'dev' || !!process.env.RUN_TASKS_IN_DEV) {
    tasker.start()
      .then(x => {
        log.info("Task Manager started!");
        updateReport();
      })
      .catch(e => log.error(e, "Error starting task manager!"));
  } else {
    setTimeout(function(){
      // set-timeout to allow for all the task registration calls to finish.
      console.log("+----------------------------------------------------------------------------+");
      console.log("|                                                                            |");
      console.log("|                   SERVER IS RUNNING IN DEVELOPMENT MODE!                   |");
      console.log("|                                                                            |");
      console.log("| This means your tasks won't run automatically! To run a task, use the task |");
      console.log("| monitoring UI which is reachable at the following url:                     |");
      console.log("|     http://localhost:8000/                                                 |");
      console.log("|                                                                            |");
      console.log("| Alternately, you can use the `npm run task` run script, but you shouldn't  |");
      console.log("| do this while the taskbox is running (although the only known negative     |");
      console.log("| effect of this would be your task not updating through the monitoring UI.  |");
      console.log("|                                                                            |");
      console.log("+----------------------------------------------------------------------------+");
    }, 2000);
  }
}

module.exports = {
  init: init
};
