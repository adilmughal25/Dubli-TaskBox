"use strict";

// legacy api for Optimise/OMGpm -- these URLs are their v2 api. Their v3 api
// currently has authentication issues because their mis-implementation of AES
// is broken in a way that node's openssl-based AES implementation doesn't allow

const _ = require('lodash');
const debug = require('debug')('omgpm:api-client');
const request = require('request-promise');
const jsonify = require('./jsonify-xml-body');
const querystring = require('querystring');
const check = require('ominto-utils').checkApiResponse;
const url = require('url');

const MERCHANT_FEED_URL = 'http://admin.optimisemedia.com/v2/Reports/Affiliate/ProgrammesExport.aspx?Agency=95&Country=0&Affiliate=808960&Search=&Sector=0&UidTracking=False&PayoutTypes=S&ProductFeedAvailable=False&Format=XML&AuthHash=93FD70005E94A58285948FB41785D135&AuthAgency=95&AuthContact=808960&ProductType=';
const COUPON_FEED_URL = 'https://admin.optimisemedia.com/v2/VoucherCodes/Affiliate/ExportVoucherCodes.ashx?Auth=95:808960:93FD70005E94A58285948FB41785D135&Status=Active&Format=Xml&Agency=95';

const ary = x => _.isArray(x) ? x : [x];

function createClient() {
  const client = request.defaults({
    resolveWithFullResponse: true,
  });

  client.getMerchants = function() {
    debug('GET '+MERCHANT_FEED_URL);
    return client
      .get(MERCHANT_FEED_URL)
      .then(check('2XX', 'Could not load merchants'))
      .then(jsonify)
      .then(resp => ary(_.get(resp, 'Report.table1.Detail_Collection.Detail')))
      .then(items => items.map(x => x.$).filter(isLive).filter(hasPercent));
  };

  client.getCoupons = function() {
    debug('GET '+COUPON_FEED_URL);
    return client
      .get(COUPON_FEED_URL)
      .then(check('2XX', 'Could not load coupons'))
      .then(jsonify)
      .then(resp => ary(_.get(resp, 'Items.Item')))
      .then(items => items.map(extractPid));
  };

  return client;
}

function isLive(o_merchant) {
  return o_merchant.ProgrammeStatus == 'Live';
}

function hasPercent(o_merchant) {
  return o_merchant.Commission.indexOf('%') > -1;
}

function extractPid(o_coupon) {
  try {
    var trackingUrl = o_coupon.TrackingUrl;
    var query = url.parse(trackingUrl).query;
    var programId = querystring.parse(query).PID;
    o_coupon.ProgramId = programId;
    return o_coupon;
  } catch(e) {
    return o_coupon;
  }
}

module.exports = createClient;
