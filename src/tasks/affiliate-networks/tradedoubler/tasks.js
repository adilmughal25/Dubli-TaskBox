'use strict';

const _ = require('lodash');
const co = require('co');
const debug = require('debug')('tradedoubler:processor');
const sendEvents = require('../support/send-events');
const singleRun = require('../support/single-run');
const moment = require('moment');
const request = require('request-promise');
const jsonify = require('../support/jsonify-xml-body');

const merge = require('../support/easy-merge')('programId', {
  coupons: 'programId'
});

const STATUS_MAP = {
  'P': 'initiated',
  'A': 'confirmed',
  'D': 'cancelled'
};

const ORGANIZATION_ID = '1984882';
const FLYDUBAI_ORGANIZATION_ID = '2051324';
const FLYDUBAI_API_KEY = '23772cd706987befac6368959d5958ff';

const API_CFG = {
  baseUrl: 'https://api.tradedoubler.com/1.0/',
  baseUrlReports: 'https://reports.tradedoubler.com/pan/',
  reportsToken: '508947a87aaea31b41d3ea73a69d6fb3',
  conversionsToken: 'C40C11CDF28A866D8353EEE9EB4FD246665364B8',
  commissionsToken: 'CC07D8283DF1724B138B2EBC76E20A553B5C07C6',
  defaultEntity: 'ominto',
  affiliateData: {
    ominto: {
      at: { voucherKey: '94159352368AF9E833C6647A624303E22F93A1D7', affiliateId: '2511389' },
      be: { voucherKey: '6AD8CA3628373B91F0EEEB2DD7EE0F78DF606C0A', affiliateId: '2511390' },
      dk: { voucherKey: 'F9622E9A4BDAE54C4241203B3B992D90AC41F8B1', affiliateId: '2511397' },
      fi: { voucherKey: 'C95DB0ED1DEC2A66099AAA4DD48BFD155BFA67AD', affiliateId: '2511402' },
      fr: { voucherKey: 'A970339A875BB7AADBF5B19678BD42AFEFFE004F', affiliateId: '2511403' },
      de: { voucherKey: '477973EDC594CDDB1F60507EC80C846EE7DB332F', affiliateId: '2506107' },
      ie: { voucherKey: '0A201457B0FE2F0E93271926782517120BE82338', affiliateId: '2511404' },
      it: { voucherKey: '8C1D779BD0498A1D35A63BA38DA825AE6F06E7FA', affiliateId: '2511405' },
      lt: { voucherKey: 'F9E007EDBF885213863EAF8B20879908431FA56C', affiliateId: '2511406' },
      nl: { voucherKey: '9684441724B1C0E4852CA1B0FD2159E95E4B976D', affiliateId: '2511408' },
      no: { voucherKey: '83316FE17C63827A1B16BF13DAF3E85CE24F05E4', affiliateId: '2511409' },
      pl: { voucherKey: '38A4217ABF33DE2231F1556BBD4B1EAF75A6EC4D', affiliateId: '2511410' },
      pt: { voucherKey: '80ED1478A1464AB2F2BC814A42712B4ED18E9FD1', affiliateId: '2511411' },
      ru: { voucherKey: '78001CD7256C5F78CE4285824991C2C3394F520B', affiliateId: '2511412' },
      es: { voucherKey: '30853B18B07F1DF176FD6632300EDE73D2DC8950', affiliateId: '2511413' },
      se: { voucherKey: '1CEAAB73B03961809BA66745EB02194EE8AD798F', affiliateId: '2511414' },
      ch: { voucherKey: '59EFF0B87382DB3A8D59EBD174B6C5691AECCF65', affiliateId: '2511415' },
      gb: { voucherKey: 'E4A255E27533E19A71DC816EBEA318F313DA0EFE', affiliateId: '2511416' },
      br: { voucherKey: '9F43FE1AAE6FD365BB8AE2AC23DDE2EA55459640', affiliateId: '2511417' },
      hk: { voucherKey: '4818E7A957B78042AC65B472CB1527A0AEF8D190', affiliateId: '2940115' },
      id: { voucherKey: '7D9674C79B1906E79B6127B66DC628D41EDFD353', affiliateId: '2940117' },
      my: { voucherKey: '340F17B69BBBC666380E86F83C1415E9480D6335', affiliateId: '2940118' },
      ph: { voucherKey: '34AF9DDD54BBC17950F448B9AD7BD7A63CADFF41', affiliateId: '2940139' },
      sg: { voucherKey: '840C65EC1585175A049C50FAC160577B97F5FADC', affiliateId: '2940140' },
      th: { voucherKey: '9DAAE46F1E06CDE865B95FC4D8F2CDE4E35AE4DC', affiliateId: '2940144' },
      au: { voucherKey: '72590F381B2CFDEC40199F5A8D6D629BB08EE09C', affiliateId: '2940148' },
      nz: { voucherKey: 'F9C3DC8C697DF5705ADCD7D69F85DAD20DE254A1', affiliateId: '2940150' },
      in: { voucherKey: '1E61E74C0AB3EDD0464EB3311A55C3FA0B1F78F9', affiliateId: '2942770' },
      flyDubai: {voucherKey: '5023327B3995A455E4F89C14FB5C49FDC8B1BCFD', affiliateId: '2822140', overrides: {
        key: '23772cd706987befac6368959d5958ff', region: 'ae'
      }}
    }
  }
};

const API_PARAMS_MERCHANTS = {
  key: API_CFG.reportsToken,
  reportName: 'aAffiliateMyProgramsReport',
  showAdvanced: 'true',
  showFavorite: 'false',
  interval: 'MONTHS',
  includeWarningColumn: 'true',
  programAffiliateStatusId: 3,
  sortBy: 'orderDefault',
  columns: ['programId',
    'programTariffAmount',
    'programTariffCurrency',
    'programTariffPercentage',
    'event',
    'eventIdView',
    'eventLastModified',
    'segmentID',
    'segmentName',
    'lastModified',
    'affiliateId',
    'applicationDate',
    'status'],
  autoCheckbox: 'useMetricColumn',
  'metric1.midOperator': '%2F',
  'metric1.columnName1': 'programId',
  'metric1.operator1': '%2F',
  'metric1.columnName2': 'programId',
  'metric1.lastOperator': '%2F',
  'metric1.summaryType': 'NONE',
  format: 'XML'
};

const API_PARAMS_COMMISSIONS = {
  event_id: '0',
  filterOnTimeHrsInterval: 'false',
  format: 'XML',
  key: API_CFG.reportsToken,
  reportName: 'aAffiliateEventBreakdownReport',
  reportTitleTextKey : 'REPORT3_SERVICE_REPORTS_AAFFILIATEEVENTBREAKDOWNREPORT_TITLE', //
  breakdownOption: '1',
  pending_status: '1',
  includeMobile: '1',
  includeWarningColumn: 'true',
  latestDayToExecute: '0',
  dataSelectionType: '1',
  currencyId: 'USD',
  setColumns: 'true',
  sortBy: 'timeOfEvent',
  organizationId: ORGANIZATION_ID,
  columns: ['orderValue',
    'pendingReason',
    'orderNR',
    'link',
    'affiliateCommission',
    'device',
    'vendor',
    'browser',
    'os',
    'deviceType',
    'voucher_code',
    'open_product_feeds_name',
    'open_product_feeds_id',
    'productValue',
    'productNrOf',
    'productNumber',
    'productName',
    'graphicalElementId',
    'graphicalElementName',
    'siteId',
    'siteName',
    'pendingStatus',
    'eventId',
    'eventName',
    'epi1',
    'lastModified',
    //'timeInSession',
    'timeOfEvent',
    //'timeOfVisit',
    'programId'
  ],
  'metric1.midOperator': '%2F',
  'metric1.columnName1': 'orderValue',
  'metric1.operator1': '%2F',
  'metric1.columnName2': 'orderValue',
  'metric1.lastOperator': '%2F',
  'metric1.summaryType': 'NONE'
};

/**
 * Retrieve a generic Tradedoubler API client by setting region and entity dynamically
 * @param s_region country code
 * @param s_entity customer name, default 'ominto'
 * @returns {TradedoublerGenericApi}
 * @constructor
 */
const TradeDoublerGenericApi = function(s_region, s_entity) {

  if (!(this instanceof TradeDoublerGenericApi)) {
    debug('instantiating TradeDoublerGenericApi for: %s', s_entity);
    return new TradeDoublerGenericApi(s_region, s_entity);
  }

  var that = this;

  this.region = s_region || 'global';
  this.entity = s_entity ? s_entity.toLowerCase() : 'ominto';
  this.client = require('./api')(this.region, this.entity);
  this.eventName = (this.entity !== 'ominto' ? this.entity + '-' : '') + 'tradedoubler' + (this.region !== 'global' ? '-' + this.region : '');

  /**
  * Retrieve all merchant information from tradedoubler
  */
  this.getMerchants = singleRun(function * () {

    debug('running get merchants with %s', that.region);
    var results = yield {
      merchants: that.getMerchantData(),
      coupons: that.getCouponsData()
    };
    var merged = merge(results);
    return yield sendEvents.sendMerchants(that.eventName, merged);
  });

  /**
   * Retrieve all merchant details for the region
   */
  this.getMerchantData = singleRun(function* () {

    const affiliateIdFilter = { affiliateId: _.get(API_CFG, 'affiliateData.' + that.entity + '.' + that.region + '.affiliateId') };
    const overrides = _.get(API_CFG, ['affiliateData', that.entity, that.region, 'overrides']);
    const requestParams = {
      qs: _.extend(API_PARAMS_MERCHANTS, affiliateIdFilter, overrides)
    };

    var client = that.client.getTradedoublerClient(requestParams);
    return client.get()
    .then((response) => {
      return (response.indexOf("<?xml") != -1 ? jsonify(response) : '');
    })
    .then((response) => {
      var merchants = _.get(response, 'report.matrix[1].rows.row', []);
      return merchants.map((merchant) => { merchant.region = overrides && overrides.region; return merchant });
    });
  });

  /**
   * Retrieve all deals/coupons for the merchant/region
   */
  this.getCouponsData = singleRun(function* () {

    var requestParams = { qs: {} };
    requestParams.baseUrl = API_CFG.baseUrl;
    requestParams.json = true;
    requestParams.qs.token = _.get(API_CFG, 'affiliateData.' + that.entity + '.' + that.region + '.voucherKey', '');
    requestParams.url = 'vouchers.json';

    var client = request.defaults(requestParams)
    return client.get()
    .then((response) => {
      return response && response.length > 0 ? response : [];
    });
  });

  /**
   * Retrieve all commissions information from tradedoubler
   */
  this.getCommissionDetails = singleRun(function* () {

    debug('running get commissions with %s', that.region);
    var response = yield that.getCommissionData();
    return yield sendEvents.sendCommissions(that.eventName, response);
  });

  /**
   * Retrieve all commissions for the last 90 days
   */
  this.getCommissionData = co.wrap(function* (){

    const affiliateIdFilter = { affiliateId: _.get(API_CFG, 'affiliateData.' + that.entity + '.' + that.region + '.affiliateId') };
    let requestParams = {
      qs: _.extend(API_PARAMS_COMMISSIONS, affiliateIdFilter)
    };
    requestParams.qs.startDate = moment().subtract(90, 'days').format('MM/DD/YYYY');
    requestParams.qs.endDate = moment().format('MM/DD/YYYY');

    debug("getting commissions from report api for duration - " + requestParams.qs.startDate + " to " + requestParams.qs.endDate);

    var client = that.client.getTradedoublerClient(requestParams);
    return client.get()
    .then(response => {
      return (response.indexOf("<?xml") != -1 ? jsonify(response) : '');
    })
    .then(response => {
      const events = _.get(response, 'report.matrix.rows.row', []);
      return events.map(prepareCommission);
    });
  });
};

/**
 * Get the commission data into the required data structure
 * @param o_obj commission event from api
 * @returns {Object} commission event with correct data structure
 */
function prepareCommission(o_obj) {
  const event = {
    transaction_id: o_obj.orderNR,
    order_id: o_obj.orderNR,
    outclick_id: o_obj.epi1,
    purchase_amount: o_obj.orderValue,
    commission_amount: o_obj.affiliateCommission,
    currency: API_PARAMS_COMMISSIONS.currencyId.toLowerCase(),
    state: STATUS_MAP[o_obj.pendingStatus],
    effective_date: o_obj.timeOfEvent
  };
  return event;
};

module.exports = TradeDoublerGenericApi;
