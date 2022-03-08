'use strict';

const _ = require('lodash');
const request = require('request-promise');
const debug = require('debug')('tradedoubler:api-client');
const qs = require('querystring');

const FLYDUBAI_ORGANIZATION_ID = '2051324';
const FLYDUBAI_API_KEY = '23772cd706987befac6368959d5958ff';

const API_CFG = {
  baseUrl: 'https://api.tradedoubler.com/1.0/',
  baseUrlReports: 'https://reports.tradedoubler.com/pan/',
  baseUrlReportsV2: 'https://connect.tradedoubler.com/',
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

/**
 * TradeDoublerClient - client for making calls to fetch data from old report based API for commissions
 * and new merchant/vouchers API.
 * @param s_region region to look for merchants/vouchers
 * @param s_entity name of the tradedoubler customer
 * @returns {TradeDoublerClient}
 * @constructor
 */
const TradeDoublerClient = function(s_region, s_entity) {

  if (!(this instanceof TradeDoublerClient)) return new TradeDoublerClient(s_region, s_entity);
  if (!s_region) throw new Error('Missing required argument ' + s_region + '!');
  if (!s_entity) {
    debug('Warning no entity.');
    s_entity = API_CFG.defaultEntity;
  }

  debug('Create new client for entity: %s, region: %s', s_entity, s_region);

  const that = this;

  this.counter = 0;
  this.queues = {};
  this.entity = s_entity;
  this.region = s_region;

  /**
   * request client with defaults params
   */
  this.client = request.defaults({
    baseUrl: API_CFG.baseUrlReports,
    json: false,
    simple: true,
    resolveWithFullResponse: false,
    url: 'aReport3Key.action'
  });

  /**
   * Get a request client with extended params
   * @param params override/add default attributes
   */
  this.getTradedoublerClient = (params) => {

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

  this.getTradedoublerClientV2 = (url, params, headers) => {

    //changing 'organizationId' & 'key' params for flyDubai
    if(that.region === 'flyDubai'){
      params.qs.organizationId = FLYDUBAI_ORGANIZATION_ID;
      params.qs.key = FLYDUBAI_API_KEY;
    }
    const requestParams = _.extend({
      baseUrl: API_CFG.baseUrlReportsV2,
      json: false,
      simple: true,
      resolveWithFullResponse: false,
      url: url,
      headers: headers
    }, params);
    return request.defaults(requestParams);
  };

  // expose
  this.get = this.client.get;
};

module.exports = TradeDoublerClient;
