'use strict';

const _ = require('lodash');
const co = require('co');
const request = require('request-promise');
const moment = require('moment');
const jsonify = require('../support/jsonify-xml-body');
const debug = require('debug')('tradedoubler:api-client');

const ORGANIZATION_ID = '1984882';
const FLYDUBAI_ORGANIZATION_ID = '2051324';
const FLYDUBAI_API_KEY = '23772cd706987befac6368959d5958ff';
const STATUS_MAP = {
  'P': 'initiated',
  'A': 'confirmed',
  'D': 'cancelled'
};
const API_ACTIONS = {
  merchants: { internal: 'merchants', api: '' },
  coupons: { internal: 'coupons', api: 'vouchers' },
  commissions: { internal: 'commissions', api: 'claims' }
};
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
    }
  }
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

/**
 * Tradedoubler client for making calls to the old report based API and the new Vouchers API.
 * Different customers need to be setup in API_CFG. Currently there is ominto only
 * @param s_entity name of the tradedoubler customer
 * @param s_region region to look for merchants/vouchers
 * @returns {Tradedoubler}
 * @constructor
 */
const Tradedoubler = function(s_region, s_entity) {
  if (!(this instanceof Tradedoubler)) return new Tradedoubler(s_region, s_entity);
  if (!s_region) throw new Error('Missing required argument ' + s_region + '!');
  if (!s_entity) {
    debug('Warning no entity.');
    s_entity = API_CFG.defaultEntity;
  }

  debug('Create new client for entity: %s, region: %s', s_entity, s_region);

  this.counter = 0;
  this.queues = {};
  this.entity = s_entity;
  this.region = s_region;

  const that = this;

  /**
   * Call any api method defined in API_ACTIONS
   * @param s_action action to be called merchants/coupons/commissions
   * @returns {Object/json}
   */
  this.apiCall = (s_action) => {
    let requestParams = { qs: {} };
    if(!_.get(API_ACTIONS, s_action)) {
      throw new Error('Action ' + s_action + ' not supported!');
    }
    let apiMethod = _.get(API_ACTIONS, s_action + '.api' );

    switch (s_action) {
      case API_ACTIONS.merchants.internal:
        return getMerchants();
      case API_ACTIONS.coupons.internal:
        requestParams.baseUrl = API_CFG.baseUrl;
        requestParams.json = true;
        requestParams.qs.token = _.get(API_CFG, 'affiliateData.' + that.entity + '.' + that.region + '.voucherKey', '');
        break;
      case API_ACTIONS.commissions.internal:
        return getCommissions();
      default:
        requestParams.qs.token = _.get(API_CFG, 'commissionsToken');
    }

    requestParams.url = apiMethod + '.json';
    const client = getTradedoublerClient(requestParams);
    return client.get()
        .then(
          response => {
            return response && response.length > 0 ? response : [];
          });
  };


  /**
   * Retrieve all merchants for the region
   * @returns {Promise.<TResult>}
   */
  const getMerchants = () => {
    const affiliateIdFilter = { affiliateId: _.get(API_CFG, 'affiliateData.' + that.entity + '.' + that.region + '.affiliateId') };
    const requestParams = {
      qs: _.extend(API_PARAMS_MERCHANTS, affiliateIdFilter)
    };
    const client = getTradedoublerClient(requestParams);
    return client.get()
        .then((response) => {
          return (response.indexOf("<?xml") != -1 ? jsonify(response) : '');
        })
        .then((response) => {
          let merchants = _.get(response, 'report.matrix[1].rows.row', []);
          return merchants;
        });
  };

  /**
   * Retrieve all commissions for the last 90 days
   * @returns {Promise.<TResult>}
   */
  const getCommissions = () => {
    const affiliateIdFilter = { affiliateId: _.get(API_CFG, 'affiliateData.' + that.entity + '.' + that.region + '.affiliateId') };
    let requestParams = {
      qs: _.extend(API_PARAMS_COMMISSIONS, affiliateIdFilter)
    };
    requestParams.qs.startDate = moment().subtract(90, 'days').format('MM/DD/YYYY');
    requestParams.qs.endDate = moment().format('MM/DD/YYYY');
    debug("getting commissions from report api for duration - " + requestParams.qs.startDate + " to " + requestParams.qs.endDate);
    const client = getTradedoublerClient(requestParams);
    return client.get()
        .then(response => {
          return (response.indexOf("<?xml") != -1 ? jsonify(response) : '');
        })
        .then(response => {
          const events = _.get(response, 'report.matrix.rows.row', []);
          return events.map(prepareCommission);
        });
  };

  /**
   * Get the commission data into the required data structure
   * @param o_obj commission event from api
   * @returns {Object} commission event with correct data structure
   */
  const prepareCommission = (o_obj) => {
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

  /**
   * Get a request client with the possibility to extend and change defaults by setting the params
   * @param params override/add default attributes
   */
  const getTradedoublerClient = (params) => {
    //changing 'organizationId' & 'key' params for flyDubai
    if(that.region === 'flyDubai'){
      params.qs.organizationId = FLYDUBAI_ORGANIZATION_ID;
      params.qs.key = FLYDUBAI_API_KEY;
    }
    const requestParams = _.extend({
      baseUrl: API_CFG.baseUrlReports,
      json: false,
      simple: true,
      resolveWithFullResponse: false,
      url: 'aReport3Key.action'
    }, params);
    return request.defaults(requestParams);
  };

};



module.exports = Tradedoubler;
module.exports.Tradedoubler = Tradedoubler;
