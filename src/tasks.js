"use strict";

const configs = require('../configs.json');
const affiliates = require('./tasks/affiliate-networks/index');
const snsPing = require('./tasks/sns-ping');

function setup(createTask) {
  // all affiliate tasks are handled here:
  // affiliates.init(createTask);

  // other miscellaneous tasks
  createTask('TownClock SNS Ping', snsPing.ping, {minute: [0,15,30,45]});
}

module.exports = setup;
