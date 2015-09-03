"use strict";

const request = require('request-promise');
const querystring = require('querystring');

const PHG_API_KEY  = 'p3tew145y3tag41n';
const PHG_USER_KEY = 'xElyiP16';
const PUBLISHER_ID = '1101l317';

// dubli/Apple credentials, helpful for testing transactions
// const PHG_API_KEY  = 'idj0NgJhMQ';
// const PHG_USER_KEY = 'TyJQtS0J';
// const PUBLISHER_ID = '305368';


function createClient() {
  var baseUrl = 'https://' + PHG_API_KEY + ':' +
    PHG_USER_KEY + '@api.performancehorizon.com/';

  var client = request.defaults({
    baseUrl: baseUrl,
    simple: true,
    json: true
  });

  client.publisherId = PUBLISHER_ID;

  client.url = getUrl;


  return client;
}

function getUrl(type, params) {
  if (!params) params = {};

  if (type === 'merchants') {
    const url = [
      'user', 'publisher', this.publisherId, 'campaign', 'approved.json'
    ].join('/');

    return url;
  }

  if (type === 'transactions') {
    let page = params.page ? params.page - 1 : 0;
    let perpage = 300;
    let offset = page * perpage;
    const url = [
      'reporting', 'report_publisher', 'publisher', this.publisherId, 'conversion.json'
    ].join('/') + '?' + querystring.stringify({
      start_date: params.start,
      end_date: params.end,
      'statuses[]': ((!params.status) || params.status === 'all') ? 'approved mixed pending rejected'.split(' ') : params.status,
      limit: perpage,
      offset: offset
    });
    return url;
  }

  throw new Error("Can't build "+type+", "+JSON.stringify(params));
}

module.exports = createClient;


/*

"Apple=> username=idj0NgJhMQ, password=TyJQtS0J, PublisherId=305368, ApiSubdomain=api
iTunes=> username=yyit5mqdd1, password=l1n3cpqj, PublisherId=10l9362, ApiSubdomain=itunes-api
BritishAirways=> username=gb3KsZwx2p, password=8zEBlCr7, PublisherId=100l1328, ApiSubdomain=api
WoolWorth=> username=SOEABGW9XY, password=oJT95Guj, PublisherId=1100l183, ApiSubdomain=api
"

*/
