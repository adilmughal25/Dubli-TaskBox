"use strict";

const handlebars = require('handlebars');
const fs = require('fs-promise');
const co = require('co');
const path = require('path');

const _endsHbs = /\.hbs$/;

function loadAll() {
  const results = {};
  const files = fs.readdirSync(__dirname).filter(x => _endsHbs.test(x));
  for (let i = 0; i < files.length; i++) {
    const filepath = path.resolve(__dirname, files[i]);
    const filename = files[i].replace(_endsHbs, '');
    const contents = fs.readFileSync(filepath, 'utf8');
    const compiled = handlebars.compile(contents);
    results[filename] = compiled;
  }
  return results;
}

module.exports = loadAll();
