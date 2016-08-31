"use strict";

const config = require('./../configs.json').notification;
const _ = require('lodash');
const path = require('path');
const Handlebars = require('handlebars');
const fs = require('fs');
const moment = require('moment');
const serve = require('koa-static');
const koa = require('koa');
const route = require('koa-route');
const app = koa();
const notification = require('./tasks/affiliate-networks/notification');

function startMonitor(tasker) {


  app.use(serve(__dirname + '/public'));
  app.use(serve(config.path_data));
  app.use(route.get('/data.js', function *(){
    this.body = yield notification.generate(tasker);
  }));
  app.use(route.get('/start', function *(){
    this.body = startTask(tasker, this.request.querystring)
  }));
  app.use(route.get('/',  function *(){
    this.body = yield defaultReport(tasker, this.response)
  }));

  app.listen(8000);
}


const template = Handlebars.compile(fs.readFileSync(path.join(__dirname, 'monitor.hbs'), 'utf8'));

const defaultReport = function * (tasker, response) {
  try{
    const report = yield tasker.report();
    response.type = 'text/html';
    const transformedReport = report.map(x => {
          const details = (
            x.lastStatus === 'error' ? x.lastError :
            x.lastStatus === 'success' ? x.lastResult :
            null
          ) || '[no stored information from last run]';
          return _.extend({}, x, {
            nextPretty: pretty(x.next),
            lastPretty: pretty(x.last),
            lastEndPretty: pretty(x.lastEnd),
            lastDetails: details
          });
        });
        
        const html = template({ report: report });
        return html;
  } catch(e) {
    response.type = 'text/plain';
    return "Received Error "+e+"\n" + " " + e.stack + "\n";
  }
}

const startTask = function (tasker, taskId) {
    tasker.run(taskId);
    return JSON.stringify({status:"ok"});
  }

function pretty (date) {
  if (!date) return '--';
  const mdate = moment(date);
  return mdate.format('MMM D h:mma') + '<br/>(' + mdate.fromNow() + ')';
}

module.exports = startMonitor;
