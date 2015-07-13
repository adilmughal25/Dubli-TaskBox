"use strict";

const MERCHANTS_URL = 'http://publisher.publicideas.com/xmlProgAff.php?partid=45415&key=322cf3a4b396a665d4d107d4ce6624b4';

var _ = require('lodash');
var request = require('request-promise');
var jsonify = require('./jsonify-xml-body');

var ary = x => _.isArray(x) ? x : [x];

// for merchants, at least, publicideas only has a very simple xml feed.
// luckily this feed includes all the details we'd normally grab about
// merchants/links/deals/coupons/etc
function createClient() {
  var client = request.defaults({});
  client.jsonify = jsonify;
  client.getMerchants = function() {
    var promise = this.get(MERCHANTS_URL)
      .then(this.jsonify)
      .then(data => ary(data.partner.program));
    return promise;
  };
  return client;
}

module.exports = createClient;
