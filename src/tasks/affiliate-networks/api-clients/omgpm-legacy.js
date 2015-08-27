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

/*
 * NOTES (as of 08/18/2015)
 *
 * transactions exports:
 *    https://admin.optimisemedia.com/v2/reports/affiliate/leads/leadsummaryexport.aspx?Contact=808960&Country=228&Agency=95&Status=-1&Year=2015&Month=8&Day=1&EndYear=2015&EndMonth=8&EndDay=18&DateType=0&Sort=CompletionDate&Login=93FD70005E94A58285948FB41785D135&Format=XML&RestrictURL=0
 *    https://admin.optimisemedia.com/v2/reports/affiliate/leads/leadsummaryexport.aspx?Contact=808960&Country=26&Agency=95&Status=-1&Year=2015&Month=8&Day=1&EndYear=2015&EndMonth=8&EndDay=18&DateType=0&Sort=CompletionDate&Login=93FD70005E94A58285948FB41785D135&Format=XML&RestrictURL=0
 * i got these urls from:
 *    https://admin.optimisemedia.com/v2/reports/affiliate/leads/leadSummaryExportUrl.aspx
 * data looks like this:
 *    <Report xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="LeadSummary" xsi:schemaLocation="LeadSummary http://83.142.224.99/ReportServer?%2fRelational+Reports%2fLeadSummary&rs%3aFormat=XML&rc%3aSchema=True" Name="LeadSummary">
 *      <Report>
 *        <Report_Details_Group_Collection>
 *          <Report_Details_Group Row="1" ClickTime="2015-08-06T17:26:35" TransactionTime="2015-08-06T17:37:42" TransactionId="35443304" MerchantRef="AL20150806-376396" MID="752994" Merchant="Archies Online" PID="14418" Product="Cost Per Sale " SR="27.60" VR="27.60" NVR="27.60" Status="Validated" Paid="" Completed="2015-08-06T17:37:42" UKey="457713968173742" TransactionValue="345.00" Ex1="" Ex2="" Ex3="" Ex4="" Ex5=""/>
 *        </Report_Details_Group_Collection>
 *      </Report>
 *    </Report>
 * field translations:
 *   TransactionId - becomes transaction_id when it goes to lambda
 *   SR/VR/NVR - these seem to be commissions and bound for our commission_amount field. SR is "Standard Rate", which is their base/lowest commission rate, while VR is "validated rate", which may be higher because of tiering. NVR is undocumented.
 *   TransactionValue - this is our purchase_amount
 *   Ex1, Ex2, Ex3, Ex4, Ex5 - At first I thought this was the SubId, because OMG gives us UID,UID2,UID3,UID4,UID5 fields for SubId. However the report under "Reporting->Transactions" in their UI lists both Ex[1-5] AND UID[1-5] in its report.
 *   Status - the only sample value I have is 'Validated'. I don't know what the other fields mean.
 *   [Currency] - in brackets because they don't have a currency field. Could be EUR, could be INR, could be EUR-when-global+INR-when-india, i'm not sure.
 *   Paid - this status seems to indicate whether or not the commission has been paid to us. This is lovely, however it's just an empty string here and i'm not sure what the value will be when an item is paid. It might be a Date, or it might be a boolean value of some kind, it could be something else. i'm not sure.
 *   ClickTime/TransactionTime/Completed - dates. Completed seems to be equal to TransactionTime, and I'm not sure what the difference between the two is. We can probably ignore ClickTime.
 *
 * We've reached out to OMG for more info on these fields, as this information is almost entirely undocumented on their site.
 */


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
