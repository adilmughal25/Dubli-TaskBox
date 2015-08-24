"use strict";

var denodeify = require('denodeify');
var xml2js = require('xml2js');

var parseXml = denodeify(xml2js.parseString);

// helper promise to decode xml into json
function jsonify(response) {
  return parseXml(response.body || response, {explicitArray: false}); // this returns a promise
}

module.exports = jsonify;
