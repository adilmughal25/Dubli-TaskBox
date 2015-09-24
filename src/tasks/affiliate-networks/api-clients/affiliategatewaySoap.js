"use strict";

/*
 * The Affiliate Gateway (TAG) provides a SOAP API.
 *  https://www.tagpm.com/ws/AffiliateSOAP.wsdl (UK)
 *  https://www.tagadmin.com.au/ws/AffiliateSOAP.wsdl (AU)
 *  https://www.tagadmin.asia/ws/AffiliateSOAP.wsdl (Asia)
 *  https://www.tagadmin.sg/ws/AffiliateSOAP.wsdl (SG)
 *
 * For Authentication send username & APIkey..
 *	-- username is a valid TAG account username
 *	-- APIkey use the account password
 *
 * API provides Sales data only - "GetSalesData"
 */

const _ = require('lodash');
const co = require('co');
const denodeify = require('denodeify');
const soap = require('soap');
const debug = require('debug')('affiliategatewaySoap:api-client');
const request = require('request-promise');
require('tough-cookie'); // for request's benefit

const API_CREDENTIALS = {
  asia: {
    endpoint: 'https://www.tagadmin.asia/ws/AffiliateSOAP.wsdl',
    authUser: 'merchants@ominto.com',
    authPass: 'Minty789',
  },
  sg: {
    endpoint: 'https://www.tagadmin.sg/ws/AffiliateSOAP.wsdl',
    authUser: 'merchants@ominto.com',
    authPass: 'Minty789',
  },
  /* // not yet in use - no accounts
  uk: {
    endpoint: 'https://www.tagpm.com/ws/AffiliateSOAP.wsdl',
    authUser: '',
    authPass: '',
  },
  au: {
    endpoint: 'https://www.tagadmin.com.au/ws/AffiliateSOAP.wsdl',
    authUser: '',
    authPass: '',
  }
  */
};

/**
 * Wrapper Class to provide a Pool of clients exposed to our api client.
 * Allows us to instantiate multiple clients per Region.
 */
const AffiliateGatewaySoapClientPool = {
  activeClients: {},

  /**
   * Getting/Creating a new client for specified region. Creates new client, if no active client available.
   * @param {String} s_region   The region to fetch data for. "asia", "sg" as defined in API_CREDENTIALS[<region>]
   * @returns {Object} AffiliateGatewaySoapClient.client
   */
  getClient: co.wrap(function* (s_region) {
    if (!s_region) s_region = Object.keys(API_CREDENTIALS)[0];  // first defined region will be the default one
    if (!API_CREDENTIALS[s_region]) throw new Error("Unknown AffiliateGateway region: " + s_region);

    if (this.activeClients[s_region]) {
      debug("Using active client for region [%s]", s_region);
      return this.activeClients[s_region];
    }

    const client = new AffiliateGatewaySoapClient(s_region);
    this.activeClients[s_region] = yield client.setup();

    return this.activeClients[s_region];
  })
};

/**
 * The actual SOAP client for Affiliate Gateway - 1 per region
 * @param {String} s_region   The geographical region we request data for - see API_CREDENTIALS[<region>] for configured regions
 * @returns {Object} new instance of AffiliateGatewaySoapClient
 */
function AffiliateGatewaySoapClient(s_region) {
  if (!(this instanceof AffiliateGatewaySoapClient)) return new AffiliateGatewaySoapClient(s_region);
  debug("Create new client for region [%s]", s_region);

  this.cfg = API_CREDENTIALS[s_region];
  this._client = null;
  this.jar = request.jar();
  this.initialized = false;
}

/**
 * Setup function to prepare a single soap client, parsing the WSDL and preparing available api methods to call.
 * @returns {Object} a node-soap client
 */
AffiliateGatewaySoapClient.prototype.setup = co.wrap(function* () {
  if (!this.initialized) {
    debug("initializing SOAP client");
    let Client = this._client = yield init(this.jar, this.cfg);

    let authArgs = {Authentication: {
      username: this.cfg.authUser,
      apikey: this.cfg.authPass
    }};

    let methods = Object.keys(this._client.describe().TAGDataService.TAGDataPort);
    methods.reduce( (self, method) => {
      let fn = Client[method].bind(Client);
      // always inject the Authentication params into functions request parameters
      let newMethod = (args, cb) => fn(_.merge(authArgs, args), cb);
      _.set(self._client, method, denodeify(newMethod));
      debug("registering api call %s", method);
    }, this);

    this.initialized = true;
  }

  return this._client;
});

function init(jar, clientCfg) {
  var rq = request.defaults({jar:jar});
  return new Promise(function(resolve, reject) {
    soap.createClient(clientCfg.endpoint, {request:rq}, function(error, client) {
      if (error) return reject(error);
      resolve(client);
    });
  });
}

module.exports = AffiliateGatewaySoapClientPool;
