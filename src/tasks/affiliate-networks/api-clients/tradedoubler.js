"use strict";

const _ = require('lodash');
const co = require('co');
const debug = require('debug')('tradedoubler:api-client');
const denodeify = require('denodeify');
const querystring = require('querystring');
const request = require('request-promise');
const jsonify = require('./jsonify-xml-body');
// debugging the requests || TODO: remove after finishing implementation
//require('request-promise').debug = true; 

const API_BASEURL = 'http://reports.tradedoubler.com/pan/';
const API_KEY = '1cd41e04394f400298de770f33b4edec';

const API_PARAMS_DEFAULT = {
  key: API_KEY,
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
 * New Class TradeDoublerClient
 * @class
 */
function TradeDoublerClient() {
	if (!(this instanceof TradeDoublerClient)) return new TradeDoublerClient();
  debug("Create new client");

	// default request options
	this.client = request.defaults({
    baseUrl: API_BASEURL,
    json: false,
    simple: true,
    resolveWithFullResponse: false,
    headers: {
      accept: "text/xml"
    }
  });
}

TradeDoublerClient.prototype.getMerchants = co.wrap(function* (key) {
  key = key || 'report.matrix[1].rows.row'; // default attribute path of all merchants
	let response, body, 
      arg = {
        url: 'aReport3Key.action',
        qs: API_PARAMS_DEFAULT
      };

	body = yield this.client.get(arg).then(jsonify);
  response = _.get(body, 'report.matrix[1].rows.row', []);

	return response;
});

module.exports = TradeDoublerClient;
