"use strict";

var handlebars = require('handlebars');
var fs = require('fs-promise');
var co = require('co');
var path = require('path');

var _endsHbs = /\.hbs$/;

function loadAll() {
  var results = {};
  var files = fs.readdirSync(__dirname).filter(x => _endsHbs.test(x));
  for (var i = 0; i < files.length; i++) {
    var filepath = path.resolve(__dirname, files[i]);
    var filename = files[i].replace(_endsHbs, '');
    var contents = fs.readFileSync(filepath, 'utf8');
    var compiled = handlebars.compile(contents);
    results[filename] = compiled;
  }
  return results;
}

module.exports = loadAll();
