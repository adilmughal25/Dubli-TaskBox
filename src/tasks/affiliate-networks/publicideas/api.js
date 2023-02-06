"use strict";

const _ = require('lodash');
const request = require('axios');
const jsonify = require('../support/jsonify-xml-body');
const querystring = require('querystring');
const moment = require('moment');
const iconv = require('iconv-lite');

const API_CREDENTIALS = {
  es: {
    partnerId: '45415',
    key: '322cf3a4b396a665d4d107d4ce6624b4'
  },
  fr: {
    partnerId: '45627',
    key: 'a0f8cc107ca0778c9dd61d9948a7a893',
  },
  it: {
    partnerId: '45628',
    key: '7bd5fe616e0c2921845c151e2587b8c3',
  },
  latam: {
    partnerId: '45629',
    key: '7873c2e1862eb77a67c6f00d66f62244'
  },
  uk: {
    partnerId: '45626',
    key: '45caa809e2347d6b316860eab2ce943a'
  }
};
const API_URLS = {
  merchants: 'http://publisher.publicideas.com/xmlProgAff.php',
  commissions: 'http://api.publicidees.com/cb.php'
};

// helpers
const ary = x => x ? (_.isArray(x) ? x : [x]) : [];
const formatDate = d => moment(d).format('YYYY-MM-DD');
const isStringDate = d => _.isString(d) && /^\d{4}(-\d{2}){2}$/.test(d);
const getDate = d => {
  if (_.isDate(d)) return formatDate(d);
  if (isStringDate(d)) return d;
  throw new Error("Not a date: ",d);
};

// for merchants, at least, publicideas only has a very simple xml feed.
// luckily this feed includes all the details we'd normally grab about
// merchants/links/deals/coupons/etc
function createClient(s_region) {
  if (!s_region) s_region = 'es';
  if (!API_CREDENTIALS[s_region]) throw new Error("Unknown region: "+s_region);

  const creds = API_CREDENTIALS[s_region];
  const apiUser = creds.partnerId;
  const apiKey = creds.key;

  const client = request.extend({
    resolveBodyOnly: true
  });

  const url = client.url = function url (type, args) {
    const extraArgs = type === 'merchants' ?
      {partid:apiUser, key:apiKey} : {p:apiUser, k:apiKey};
    const fullArgs = _.extend({}, args, extraArgs);
    return API_URLS[type] + '?' + querystring.stringify(fullArgs);
  };

  client.jsonify = jsonify;

  client.getMerchants = function() {
    const requestUrl = this.url('merchants');
    console.log("URL", requestUrl);
    const promise = this.get(requestUrl, {encoding:'binary'})
      .then(data => iconv.decode(data.body, 'ISO-8859-1').toString('utf8'))
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
      .then(this.jsonify)
      .then(fixCommissions);
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

function fixCommissions(o_obj) {
  const root = o_obj.cashBack;
  root.programme = ary(root.programme);
  let actions = [];
  root.programme.forEach(p => actions = actions.concat(ary(p.action)));
  return actions.map(a => a.$);
}

module.exports = createClient;
