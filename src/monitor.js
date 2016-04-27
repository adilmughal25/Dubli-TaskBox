"use strict";

const http = require('http');
const _ = require('lodash');
const path = require('path');
const Handlebars = require('handlebars');
const fs = require('fs');
const moment = require('moment');

function startMonitor(tasker) {
  // this will be made prettier soon, but for now even just having this status report will be good
  // later we could even pretty easily add a button that calls an ajax which triggers tasker.run(taskid)
  // to force a task to run.
  var server = http.createServer(function (request, response) {

    const match = /^\/start\?([a-zA-Z0-9-]+)$/.exec(request.url);
    if (match) {
      const taskId = match[1];
      tasker.run(taskId);
      response.writeHead(200, {"Content-Type":"application/json"});
      response.end(JSON.stringify({status:"ok"}));
      return;
    }

    tasker.report()
    .catch(e => {
      response.writeHead(200, {"Content-Type": "text/plain"});
      response.end("Received Error "+e+"\n" + " " + e.stack + "\n" );
    })
    .then(function(report) {
      response.writeHead(200, {"Content-Type": "text/html"});
      const tpl = template();
      report = report.map(x => {
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
      const html = tpl({ report: report });
      response.end(html);
    });
  });

  // Listen on port 8000, IP defaults to 127.0.0.1
  server.listen(8000);
}

let compiledTemplate;
function template() {

  if (!compiledTemplate) {
    let t = fs.readFileSync(path.join(__dirname, 'monitor.hbs'), 'utf8');
    compiledTemplate = Handlebars.compile(t);
  }
  return compiledTemplate;
}

function pretty (date) {
  if (!date) return '--';
  const mdate = moment(date);
  return mdate.format('MMM D h:mma') + '<br/>(' + mdate.fromNow() + ')';
}

module.exports = startMonitor;
