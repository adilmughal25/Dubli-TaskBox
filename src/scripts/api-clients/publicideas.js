"use strict";

// this will need to be generified soon; waiting for confirmation of this but it
// looks like we need to treat each site-id as if it's a wholly different account.
// api_key may or may not be the same for each.
const API_USERID = '45415';

const API_KEY = '322cf3a4b396a665d4d107d4ce6624b4';
const API_URLS = {
  // merchants: 'http://publisher.publicideas.com/xmlProgAff.php',
  commissions: 'http://api.publicidees.com/cb.php'
};
const MERCHANTS_URL = 'http://publisher.publicideas.com/xmlProgAff.php?partid=45415&key=322cf3a4b396a665d4d107d4ce6624b4';


const _ = require('lodash');
const request = require('request-promise');
const jsonify = require('./jsonify-xml-body');
const querystring = require('querystring');
const moment = require('moment');

const ary = x => _.isArray(x) ? x : [x];

function url (type, args) {
  const fullArgs = _.extend({}, args, { p: API_USERID, k: API_KEY });
  return API_URLS[type] + '?' + querystring.stringify(fullArgs);
}


const formatDate = d => moment(d).format('YYYY-MM-DD');
const isStringDate = d => _.isString(d) && /^\d{4}(-\d{2}){2}$/.test(d);
const getDate = d => {
  if (_.isDate(d)) return formatDate(d);
  if (isStringDate(d)) return d;
  throw new Error("Not a date: ",d);
};

//require('./src/scripts/api-clients/publicideas')().getPendingCommissions('2015-05-01','2015-08-17').then(x => console.log("res",x), e=>console.error("err",e))

// for merchants, at least, publicideas only has a very simple xml feed.
// luckily this feed includes all the details we'd normally grab about
// merchants/links/deals/coupons/etc
function createClient() {
  var client = request.defaults({
    resolveWithFullResponse: true
  });

  client.url = url;

  client.jsonify = jsonify;

  client.getMerchants = function() {
    // const requestUrl = this.url('merchants');
    const requestUrl = MERCHANTS_URL;
    console.log("URL", requestUrl);
    const promise = this.get(requestUrl)
      .then(this.jsonify)
      .then(data => ary(data.partner.program));
    return promise;
  };

  client.getCommissions = function(start, end, type) {
    const requestUrl = this.url('commissions', {
      td: type === 'pending' ? 'a' : 'v',
      dd: getDate(start),
      df: getDate(end)
    });
    console.log("URL", requestUrl);
    const promise = this.get(requestUrl)
      .then(x => {console.log(x.body); return x;})
      .then(this.jsonify);
      // this needs to be more robust -- i'm fairly certain that we get one
      // array of programs with an inner array of actions.. of course, since
      // this is coming from an xml2js parsing of the xml into json, we'll have
      // to correct each of these into arrays if they come back with a single
      // element.
      //
      // However, I have no data coming back from this API right now, despite
      // test purchases being made 10+ days ago. Support teams have been
      // dispatched to combat this problem.
      //
      // .then(data => ary(_.get(data, 'cashBack.programme.action') || []));
    return promise;
  };

  client.getPendingCommissions = function(start, end) {
    return this.getCommissions(start, end, 'pending');
  };

  client.getValidatedCommissions = function(start, end) {
    return this.getCommissions(start, end, 'validated');
  };

  return client;
}

module.exports = createClient;
