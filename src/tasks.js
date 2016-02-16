"use strict";

const _ = require('lodash');
const configs = require('../configs.json');
const affiliates = require('./tasks/affiliate-networks/index');
const snsPing = require('./tasks/sns-ping');
const TaskMatic = require('taskmatic');
const path = require('path');
const fs = require('fs');
const http = require('http');

function setup(log, isRunnerTool) {
  // all affiliate tasks are handled here:
  const tasker = setupTaskManager(log, isRunnerTool);
  affiliates.init(tasker);

  // other miscellaneous tasks
  tasker.createTask('TownClock SNS Ping', '15m', snsPing.ping);

  if (! isRunnerTool) {
    tasker.start()
      .then(x => log.info("Task Manager started!"))
      .catch(e => log.error(e, "Error starting task manager!"));
  }

  return tasker;
}

function setupTaskManager(log, isRunnerTool) {
  const db = process.env.NODE_ENV === 'dev' ? path.resolve(__dirname, '..', 'test/taskdb') : '/var/lib/taskbox-taskdb';
  const tasker = new TaskMatic({
    dbPath: db,
    noDebug: isRunnerTool
  });

  const updateReport = function() {
    if (isRunnerTool) return;
    // if (process.env.NODE_ENV === 'dev') return;
    tasker.report().then(function(data) {
      const file = process.env.NODE_ENV === 'dev' ?
        path.resolve(__dirname, '..', 'test/output/run-report.json') :
        path.resolve(__dirname, 'logs/run-report.json');
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
  if (! isRunnerTool) {
    tasker.on('task-registered', (task) => {
      log.info(task, "Task registered: "+task.id);
    });
  }

  const createTask = (name, spec, task) => {
    var id = nameToId(name);
    tasker.schedule(id, spec, task.bind({log:log}));
  };

  const createGroup = (spec, tasks) => {
    Object.keys(tasks).forEach(function(name) {
      var id = nameToId(name);
      tasker.schedule(id, spec, tasks[name].bind({log:log}));
    });
  };

  tasker.createTask = createTask;
  tasker.createGroup = createGroup;

  if (!isRunnerTool) startTaskStatusServer(tasker);

  return tasker;
}

function startTaskStatusServer(tasker) {
  // this will be made prettier soon, but for now even just having this status report will be good
  // later we could even pretty easily add a button that calls an ajax which triggers tasker.run(taskid)
  // to force a task to run.
  var server = http.createServer(function (request, response) {
    tasker.report()
    .catch(e => {
      response.writeHead(200, {"Content-Type": "text/plain"});
      response.end("Received Error "+e+"\n");
    })
    .then(function(report) {
      response.writeHead(200, {"Content-Type": "text/html"});
      const html = ("<!doctype html><html><body><table>" +
        row('id', 'status', 'next run', 'last run', 'last status') +
        _.sortBy(report, 'id').map(x => {
          return row(x.id, x.status, x.next, x.last, x.lastStatus);
        }).join('') +
        "</table></body></html>\n");
      response.end(html);

    });
  });

  // Listen on port 8000, IP defaults to 127.0.0.1
  server.listen(8000);
}

function row() {
  return "<tr>" + [].slice.call(arguments).map(x => "<td>"+x+"</td>").join('') + "</tr>";
}

function nameToId(name) {
  return name.replace(/\W+/g, '-').toLowerCase();
}

module.exports = setup;
