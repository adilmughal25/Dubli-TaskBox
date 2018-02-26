"use strict";

// legacy api for Optimise/OMGpm -- these URLs are their v2 api. Their v3 api
// currently has authentication issues because their mis-implementation of AES
// is broken in a way that node's openssl-based AES implementation doesn't allow

const _ = require('lodash');
const debug = require('debug')('omgpm:api-client');
const request = require('request-promise');
const moment = require('moment');
const jsonify = require('../support/jsonify-xml-body');
const querystring = require('querystring');
const utils = require('ominto-utils');
const check = utils.checkApiResponse;
const normalizeCurrency = utils.currency.getIntegerAmountForCurrency;

const url = require('url');

const ary = x => !!x ? (_.isArray(x) ? x : [x]) : [];

const MERCHANT_KEY     = 'Report.table1.Detail_Collection.Detail';
const COUPONS_KEY      = 'Items.Item';
const TRANSACTIONS_KEY = 'Report.Report.Report_Details_Group_Collection.Report_Details_Group';

// urls:
// IN: http://admin.optimisemedia.com/v2/Reports/Affiliate/ProgrammesExport.aspx?Agency=95&Country=0&Affiliate=808960&Search=&Sector=0&UidTracking=False&PayoutTypes=S&ProductFeedAvailable=False&Format=XML&AuthHash=93FD70005E94A58285948FB41785D135&AuthAgency=95&AuthContact=808960&ProductType=
// IN: https://admin.optimisemedia.com/v2/VoucherCodes/Affiliate/ExportVoucherCodes.ashx?Auth=95:808960:93FD70005E94A58285948FB41785D135&Status=Active&Format=Xml&Agency=95
// IN: https://admin.optimisemedia.com/v2/reports/affiliate/leads/leadsummaryexport.aspx?Contact=808960&Country=26&Agency=95&Status=-1&Year=2015&Month=8&Day=1&EndYear=2015&EndMonth=8&EndDay=18&DateType=0&Sort=CompletionDate&Login=93FD70005E94A58285948FB41785D135&Format=XML&RestrictURL=0
//
// UK: http://admin.optimisemedia.com/v2/Reports/Affiliate/ProgrammesExport.aspx?Agency=1&Country=0&Affiliate=835519&Search=&Sector=0&UidTracking=False&PayoutTypes=&ProductFeedAvailable=False&Format=XML&AuthHash=15911EC45848DB22ACCB62C0F951ED1B&AuthAgency=1&AuthContact=835519&ProductType=0
// UK: https://admin.optimisemedia.com/v2/reports/affiliate/leads/leadsummaryexport.aspx?Contact=71872&Country=20&Agency=1&Status=-1&Year=2015&Month=9&Day=1&DateType=0&Sort=CompletionDate&Login=75479e8a743aa64b1c0ec410b97ae55b&Format=XML&RestrictURL=0
//
// asia: http://admin.optimisemedia.com/v2/Reports/Affiliate/ProgrammesExport.aspx?Agency=118&Country=0&Affiliate=826495&Search=&Sector=0&UidTracking=False&PayoutTypes=&ProductFeedAvailable=False&Format=XML&AuthHash=6BB2810C48BADCA07378DC0819824992&AuthAgency=118&AuthContact=826495&ProductType=
// asia: https://admin.optimisemedia.com/v2/reports/affiliate/leads/leadsummaryexport.aspx?Contact=826495&Country=228&Agency=118&Status=-1&Year=2015&Month=9&Day=1&DateType=0&Sort=CompletionDate&Login=6BB2810C48BADCA07378DC0819824992&Format=XML&RestrictURL=0
// asia: https://admin.optimisemedia.com/v2/VoucherCodes/Affiliate/ExportVoucherCodes.ashx?Auth=118:826495:6BB2810C48BADCA07378DC0819824992&Status=Active&Format=Xml&Agency=118
//
// brazil: http://admin.optimisemedia.com/v2/Reports/Affiliate/ProgrammesExport.aspx?Agency=142&Country=0&Affiliate=835579&Search=&Sector=0&UidTracking=False&PayoutTypes=&ProductFeedAvailable=False&Format=XML&AuthHash=26E4FDB10EEF76851ABBBBB9FFC2DF4F&AuthAgency=142&AuthContact=835579&ProductType=
// brazil: https://admin.optimisemedia.com/v2/VoucherCodes/Affiliate/ExportVoucherCodes.ashx?Auth=142:835579:26E4FDB10EEF76851ABBBBB9FFC2DF4F&Status=Active&Format=Xml&Agency=142
// brazil: https://admin.optimisemedia.com/v2/reports/affiliate/leads/leadsummaryexport.aspx?Contact=816380&Country=56&Agency=142&Status=-1&Year=2015&Month=9&Day=1&DateType=0&Sort=CompletionDate&Login=683A45C61A2B9B0A77E631EF7AB301E1&Format=XML&RestrictURL=0
//
// aus: http://admin.optimisemedia.com/v2/Reports/Affiliate/ProgrammesExport.aspx?Agency=47&Country=0&Affiliate=835094&Search=&Sector=0&UidTracking=False&PayoutTypes=S&ProductFeedAvailable=False&Format=XML&AuthHash=DF1F0E5DD0AB1859FDF9C5583ECFB5FF&AuthAgency=47&AuthContact=835094&ProductType=
// aus: https://admin.optimisemedia.com/v2/VoucherCodes/Affiliate/ExportVoucherCodes.ashx?Auth=47:835094:DF1F0E5DD0AB1859FDF9C5583ECFB5FF&Status=Active&Format=Xml&Agency=47
// aus: https://admin.optimisemedia.com/v2/reports/affiliate/leads/leadsummaryexport.aspx?Contact=835094&Country=22&Agency=47&Status=-1&Year=2015&Month=9&Day=1&DateType=0&Sort=CompletionDate&Login=DF1F0E5DD0AB1859FDF9C5583ECFB5FF&Format=XML&RestrictURL=0

const API_CFG = {
  url: 'https://admin.optimisemedia.com/v2',
  ominto: {
    india: {
      agency: 95,
      affiliateId: 808960,
      authHash: '93FD70005E94A58285948FB41785D135',
      login: '93FD70005E94A58285948FB41785D135',
      transactionCountries: ['26', '228'],
    },
    uk: {
      agency: 1,
      affiliateId: 835519,
      authHash: '15911EC45848DB22ACCB62C0F951ED1B',
      login: '75479e8a743aa64b1c0ec410b97ae55b',
      transactionCountries: ['1', '2', '20'],
    },
    "uk-c": {
      agency: 1,
      affiliateId: 71872,
      authHash: '15911EC45848DB22ACCB62C0F951ED1B',
      login: '75479e8a743aa64b1c0ec410b97ae55b',
      transactionCountries: ['1', '2', '20'],
    },
    asia: {
      agency: 118,
      affiliateId: 826495,
      authHash: '6BB2810C48BADCA07378DC0819824992',
      login: '6BB2810C48BADCA07378DC0819824992',
      transactionCountries: ['228', '27', '110', '135', '170', '189', '205'],
    },
    brazil: {
      agency: 142,
      affiliateId: '835579',
      authHash: '26E4FDB10EEF76851ABBBBB9FFC2DF4F',
      login: '683A45C61A2B9B0A77E631EF7AB301E1',
      transactionCountries: ['56'],
    },
    "brazil-c": {
      agency: 142,
      affiliateId: '816380',
      authHash: '26E4FDB10EEF76851ABBBBB9FFC2DF4F',
      login: '683A45C61A2B9B0A77E631EF7AB301E1',
      transactionCountries: ['56'],
    },
    australia: {
      agency: 47,
      affiliateId: 835094,
      authHash: 'ADFE8EEF6BC1B23317644F4BE38A99D0',
      login: 'DF1F0E5DD0AB1859FDF9C5583ECFB5FF',
      transactionCountries: ['22', '24', '228']
    }
  },
  dubli: {
    india: {
      agency: 95,
      affiliateId: 629574,
      authHash: 'AA398ED0689EDB9B162B65CA3104A7D4',
      login: 'AA398ED0689EDB9B162B65CA3104A7D4',
      transactionCountries: ['26', '228'],
    },
  }
};

const _clientCache = {};
function OmgPmLegacyApiClient(s_entity, s_region) {
  if (!s_entity) throw new Error("Missing required argument 's_entity'!");
  if (!s_region) s_region = 'india';
  if (!API_CFG[s_entity]) throw new Error("Entity '"+s_entity+"' is not defined in API_CFG.");
  if (!API_CFG[s_entity][s_region]) throw new Error("Region '"+s_region+"' for entity '"+s_entity+"' is not defined in API_CFG.");

  const _tag = s_entity + '-' + s_region;

  if (_clientCache[_tag]) return _clientCache[_tag];

  const creds = API_CFG[s_entity][s_region];
  const client = request.defaults({
    resolveWithFullResponse: true,
  });
  client.credentials = creds;
  client.url = getUrl;

  client.getMerchants = function() {
    const apiUrl = client.url('merchants');
    debug('GET '+apiUrl);

    return client.get(apiUrl)
      .then(check('2XX', 'Could not load merchants'))
      .then(jsonify)
      .then(resp => ary(_.get(resp, MERCHANT_KEY)))
      .then(items => items.map(x => x.$).filter(isLive).map(fixFlatRates.bind(null, s_region)));
  };

  client.getCoupons = function() {
    const apiUrl = client.url('coupons');
    debug('GET '+apiUrl);

    return client.get(apiUrl)
      .then(check('2XX', 'Could not load coupons'))
      .then(jsonify)
      .then(resp => ary(_.get(resp, COUPONS_KEY)))
      .then(items => items.map(extractPid));
  };

  client.getTransactionsByCountry = function(country, start, end) {
    const apiUrl = client.url('transactions', {
      country : country,
      start   : start,
      end     : end,
    });
    debug('GET '+apiUrl);
    console.log(apiUrl)
    return client.get(apiUrl)
      .then(check('2XX', 'Could not load transactions for '+country+' ('+url+')'))
      .then(jsonify)
      .then(resp => ary(_.get(resp, TRANSACTIONS_KEY)))
      .then(items => items.map(x => x.$));
  };

  // promises are effing cool.
  client.getTransactions = function(start, end) {
    const proc = country => client.getTransactionsByCountry(country, start, end);
    const promises = client.credentials.transactionCountries.map(proc);

    return Promise.all(promises).then(_.flatten);
  };

  _clientCache[_tag] = client;
  return client;
}

function getUrl(urlType, params) {
  const creds = this.credentials;

  if (!params) params = {};

  if (urlType === 'merchants') {
    let url = API_CFG.url + '/Reports/Affiliate/ProgrammesExport.aspx?' + querystring.stringify({
      Agency: creds.agency,
      Country: '0',
      Affiliate: creds.affiliateId,
      Search: '',
      Sector: '0',
      UidTracking: 'False',
      PayoutTypes: 'S',
      ProductFeedAvailable: 'False',
      Format: 'XML',
      AuthHash: creds.authHash,
      AuthAgency: creds.agency,
      AuthContact: creds.affiliateId,
      ProductType: ''
    });

    return url;
  }

  if (urlType === 'coupons') {
    let url = API_CFG.url + '/VoucherCodes/Affiliate/ExportVoucherCodes.ashx?' + querystring.stringify({
      Auth: [creds.agency, creds.affiliateId, creds.authHash].join(':'),
      Status: 'Active',
      Format: 'Xml',
      Agency: creds.agency
    });

    return url;
  }

  if (urlType === 'transactions') {
    let _start = dateComponents(params.start);
    let _end = dateComponents(params.end);
    let url = API_CFG.url + '/reports/affiliate/leads/leadsummaryexport.aspx?' + querystring.stringify({
      Contact: creds.affiliateId,
      Country: params.country,
      Agency: creds.agency,
      Status: '-1',
      Year: _start.year,
      Month: _start.month,
      Day: _start.day,
      EndYear: _end.year,
      EndMonth: _end.month,
      EndDay: _end.day,
      DateType: '0',
      Sort: 'CompletionDate',
      Login: creds.login,
      Format: 'XML',
      RestrictURL: '0'
    });

    return url;
  }

  throw new Error("unknown url type "+urlType);
}

function dateComponents(date) {
  const parts = moment(date).format('YYYY-M-D').split('-');
  return {
    year  : parts[0],
    month : parts[1],
    day   : parts[2]
  };
}

function isLive(o_merchant) {
  return o_merchant.ProgrammeStatus == 'Live';
}

function fixFlatRates(region, o_merchant) {
  if (o_merchant.Commission.indexOf('%') > -1) return o_merchant;

  var amts = _.uniq(o_merchant.Commission.replace(/£/g, '').split(/\s+-\s+/g)).map(x => Number(x));

  var properCurrency = (
    region === 'india' ? 'inr' :
    region === 'uk' ? 'gbp' :
    region === 'australia' ? 'aud' :
    region === 'brazil' ? 'brl' :
    region === 'asia' ? 'sgd' :
    'unknown');

  // delete o_merchant.Commission;
  if (properCurrency === 'unknown') {
    o_merchant.CommissionFlat = amts.join(', ');
    o_merchant.CommissionCurrency = 'xxx';
  } else {
    o_merchant.CommissionFlat = amts.map(x => normalizeCurrency(x, properCurrency)).join(', ');
    o_merchant.CommissionCurrency = properCurrency;
  }

  return o_merchant;
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

module.exports = OmgPmLegacyApiClient;


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
