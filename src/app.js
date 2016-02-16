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

  const updateReport = function() {
    // if (process.env.NODE_ENV === 'dev') return;
    tasker.report().then(function(data) {
      const file = process.env.NODE_ENV === 'dev' ?
        path.resolve(__dirname, '..', 'test/output/run-report.json') :
        path.resolve(__dirname, '..', 'logs/run-report.json');
      fs.writeFile(file, JSON.stringify(data), 'utf8');
    });
  };

  tasker.on('task-start', (task) => {
    log.info(task, "Started task: "+task.id);
    updateReport();
  });
  tasker.on('task-error', (task, error) => {
    log.error(task, "Error running "+task.id+": "+error.stack);
    updateReport();
  });
  tasker.on('task-done', (task) => {
    log.info(task, "Task Finished: "+task.id);
    updateReport();
  });
  tasker.on('task-registered', (task) => {
    log.info(task, "Task registered: "+task.id);
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
      console.log("+------------------------------------------------+");
      console.log("|                                                |");
      console.log("|    SERVER IS RUNNING IN DEVELOPMENT MODE!      |");
      console.log("|                                                |");
      console.log("| This means your tasks won't run automatically! |");
      console.log("| To run a task, use `npm run task [task-name]`  |");
      console.log("| A list of available tasks is available by      |");
      console.log("| running the command `npm run task-list`.       |");
      console.log("|                                                |");
      console.log("+------------------------------------------------+");
    }, 2000);
  }
}

module.exports = {
  init: init
};
