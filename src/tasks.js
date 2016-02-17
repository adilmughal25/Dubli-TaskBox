"use strict";

const _ = require('lodash');
const configs = require('../configs.json');
const affiliates = require('./tasks/affiliate-networks/index');
const snsPing = require('./tasks/sns-ping');
const TaskMatic = require('taskmatic');
const monitor = require('./monitor');
const path = require('path');
const fs = require('fs');
const http = require('http');

function setup(log) {
  // all affiliate tasks are handled here:
  const tasker = setupTaskManager(log);
  affiliates.init(tasker);

  // other miscellaneous tasks
  tasker.createTask('TownClock SNS Ping', '15m', snsPing.ping);

  return tasker;
}

function setupTaskManager(log) {
  const db = process.env.NODE_ENV === 'dev' ? path.resolve(__dirname, '..', 'test/taskdb') : '/var/lib/taskbox-taskdb';
  const tasker = new TaskMatic({
    dbPath: db,
    noDebug: true
  });

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

  return tasker;
}

function nameToId(name) {
  return name.replace(/\W+/g, '-').toLowerCase();
}

module.exports = setup;
