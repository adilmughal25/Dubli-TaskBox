"use strict";

const _ = require('lodash');
const co = require('co');
const denodeify = require('denodeify');
const soap = require('soap');
const debug = require('debug')('tradetracker:api-client');
const request = require('request-promise');
require('tough-cookie'); // for request's benefit

const API_SERVICE_WSDL  = 'http://ws.tradetracker.com/soap/affiliate?wsdl';
const API_LOCALE        = 'en_GB'; // Default locale; Possible values: nl_BE, fr_BE, cs_CZ, da_DK, de_DE, et_EE, en_GB, es_ES, fr_FR, it_IT, hu_HU, nl_NL, nb_NO, de_AT, pl_PL, fi_FI, sv_SE, ru_RU
const API_CREDENTIALS   = {
  ominto: {
    ae: {
      siteId: 279740,
      customerId: 120335,
      passphrase: '37e434fc026948c59b784514fdf4aec3bdb2793b',
      //locale: 'ar_SA'  //SR: need to find our what this would be and whether it's needed.
    },
    at: {
      siteId: 227197,
      customerId: 120335,
      passphrase: '0e06faa94f83ae2991270119ff1d7d82e39e356d',
      locale: 'de_AT'
    },
    be: {
      siteId: 227199,
      customerId: 120335,
      passphrase: '2ccaf53cccea6f2868c07febff6766de3f00729a',
      locale: 'fr_BE'
    },
    cz: {
      siteId: 227200,
      customerId: 120335,
      passphrase: 'f3157b03d2081e593b8c542549699761ce912e6b',
      locale: 'cs_CZ'
    },
    dk: {
      siteId: 227196,
      customerId: 120335,
      passphrase: '7cab414db73907ff37ffc8589cb627c8898767ce',
      locale: 'da_DK'
    },
    fi: {
      siteId: 227191,
      customerId: 120335,
      passphrase: '66ddd690b3ba5c36c2bb0d43a145cc9a8a000202',
      locale: 'fi_FI'
    },
    fr: {
      siteId: 227195,
      customerId: 120335,
      passphrase: '3ed27568f3a6f4355f746a7c22c5fa1f7519d739',
      locale: 'fr_FR'
    },
    de: {
      siteId: 227194,
      customerId: 120335,
      passphrase: '7441423cd4570bd131ee025c0bf70339d7475773',
      locale: 'de_DE'
    },
    it: {
      siteId: 227209,
      customerId: 120335,
      passphrase: 'd5fd1c833f3086da2ab9ae44a163768cfb3d6451',
      locale: 'it_IT'
    },
    mx: {
      siteId: 283298,
      customerId: 120335,
      passphrase: 'fcc6cc8acf3b9e72e4ff75a6a393588725cc56b0',
      locale: 'es_MX'
    },
    nl: {
      siteId: 227193,
      customerId: 120335,
      passphrase: '7c84a0c5e03e4e259e630a2986ac66ca736e1b71',
      locale: 'nl_NL'
    },
    no: {
      siteId: 227192,
      customerId: 120335,
      passphrase: '56d7c37a0fde4f3f538ad176c162da39a8e179d5',
      locale: 'nb_NO'
    },
    pl: {
      siteId: 227211,
      customerId: 120335,
      passphrase: '60b9f2462c37b79b2402c57cc713273a017a2682',
      locale: 'pl_PL'
    },
    es: {
      siteId: 227214,
      customerId: 120335,
      passphrase: '556c8504a92ef60d36d453cb8ff473f1d1c9608c',
      locale: 'es_ES'
    },
    se: {
      siteId: 227146,
      customerId: 120335,
      passphrase: '49b6a210c134cb10a4b692e2683f037759fb6c5b',
      locale: 'sv_SE'
    },
    ch: {
      siteId: 227216,
      customerId: 120335,
      passphrase: 'faa1d39c1d3be8bd05fcbe164cf6e526472be340',
    },
    gb: {
      siteId: 219065,
      customerId: 120335,
      passphrase: 'cb7c439c5c11f70590b9ae6b8b8032a7ebed624e',
      locale: 'en_GB'
    },
    ru: {
      siteId: 227212,
      customerId: 120335,
      passphrase: '1608b1c6888577a635d187019ae8d1ca6d89d6fa',
      locale: 'ru_RU'
    }
  },
  dubli: {
    ch: {
      siteId: 159664,
      customerId: 83573,
      passphrase: 'c8a67e584af520eca9ad1eb8b0c0b8b918e56cd7'
    },
    de: {
      siteId: 170366,
      customerId: 90204,
      passphrase: '0e2fe309198c84f78448aa33741b71693d115a48',
      locale: 'de_DE'
    },
    dk: {
      siteId: 169734,
      customerId: 89824,
      passphrase: '63e9b8cec1d2115d5e3d4efac6f3bd1e523f5bac',
      locale: 'da_DK'
    },
    at: {
      siteId: 159656,
      customerId: 83567,
      passphrase: '5877338f9519bae1e5fc62fc9e1840048d88e178',
      locale: 'de_AT'
    },
    ru: {
      siteId: 181114,
      customerId: 96906,
      passphrase: 'e121440ed81b78569c22c7b769dfd32554dc44fe',
      locale: 'ru_RU'
    }
  }
};

/**
 * Wrapper Class to provide a Pool of clients exposed to our api client.
 * Allows us to instantiate multiple clients, 1 per Region.
 */
const TradeTrackerSoapClientPool = {
  activeClients: {},

  /**
   * Getting/Creating a new client for specified region. Creates new client, if no active client available.
   * @param {String} s_entity   The entity to fetch data for. "ominto", "dubli" as defined in API_CREDENTIALS[<entity>]
   * @param {String} s_region   The region to fetch data for. "asia", "sg" as defined in API_CREDENTIALS[<entity>][<region>]
   * @returns {Object} TradeTrackerSoapClient.client
   */
  getClient: co.wrap(function* (s_entity, s_region) {
    if (!s_entity) throw new Error("Missing required argument 's_entity'!");
    if (!s_region) s_region = Object.keys(API_CREDENTIALS[s_entity])[0];  // first defined region will be the default one
    if (!API_CREDENTIALS[s_entity]) throw new Error("Entity '"+s_entity+"' is not defined in API_CREDENTIALS.");
    if (!API_CREDENTIALS[s_entity][s_region]) throw new Error("Unknown TradeTracker region: " + s_region + " for entity: " + s_entity);

    let _tag = s_entity + '-' + s_region;
    if (this.activeClients[_tag]) {
      debug("Using active client for tag [%s]", _tag);
      return this.activeClients[_tag];
    }

    const client = new TradeTrackerSoapClient(s_entity, s_region);
    this.activeClients[_tag] = yield client.setup();

    return this.activeClients[_tag];
  })
};

/**
 * The actual SOAP client for TradeTracker - 1 per region
 * @param {String} s_entity   The entity to fetch data for. "ominto", "dubli" as defined in API_CREDENTIALS[<entity>]
 * @param {String} s_region   The geographical region we request data for - see API_CREDENTIALS[<entity>][<region>] for configured regions
 * @returns {Object} new instance of TradeTrackerSoapClient
 */
function TradeTrackerSoapClient(s_entity, s_region) {
  if (!(this instanceof TradeTrackerSoapClient)) return new TradeTrackerSoapClient(s_entity, s_region);
  debug("Create new client for entity [%s], region [%s]", s_entity, s_region);

  this.cfg = API_CREDENTIALS[s_entity][s_region];
  this._client = null;
  this.jar = request.jar();
  this.initialized = false;
}

/**
 * Setup function to prepare a single soap client, parsing the WSDL and preparing available api methods to call.
 * @returns {Object} a node-soap client
 */
TradeTrackerSoapClient.prototype.setup = co.wrap(function* () {
  if (!this.initialized) {
    debug("initializing SOAP client");

    let Client = this._client = yield init(this.jar);
    this._client.siteId = this.cfg.siteId;

    let methods = Object.keys(this._client.describe().AffiliateService.AffiliateBinding);
    methods.reduce( (self, method) => {
      // we do automatically (inject) our siteId for API method where its needed - no need to pass in as argument from ourside of that API client
      let fn = Client[method].bind(Client);
      let expectedInput = Client.describe().AffiliateService.AffiliateBinding[method].input;
      let newFn = fn;

      if( null !== expectedInput && 'affiliateSiteID' in expectedInput ) {
        newFn = (args, cb) => fn(_.merge({affiliateSiteID: Client.siteId}, args), cb);
      }

      //debug("registering api call %s", method);
      _.set(Client, method, denodeify(newFn));
    }, this);

    yield this._client.authenticate({
      customerID: this.cfg.customerId,
      passphrase: this.cfg.passphrase,
      demo: false,
      sandbox: false,
      locale: this.cfg.locale || API_LOCALE,
    });

    this.initialized = true;
  }

  return this._client;
});

function init(jar) {
  var rq = request.defaults({jar:jar});
  return new Promise(function(resolve, reject) {
    soap.createClient(API_SERVICE_WSDL, {request:rq}, function(error, client) {
      if (error) return reject(error);
      resolve(client);
    });
  });
}

module.exports = TradeTrackerSoapClientPool;
