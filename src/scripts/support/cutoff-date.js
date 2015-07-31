"use strict";

const co = require('co');
const CUTOFF_EPOCH = new Date(1430463600000);
const o_configs = require('../../../configs.json');
const utils = require('ominto-utils');
const check = utils.checkApiResponse;
const dataClient = utils.getDataClient(o_configs.data_api.url, o_configs.data_api.auth);

module.exports = {
  get: co.wrap(getCutoffDate),
  set: co.wrap(setCutoffDate)
};

function keyUrl(s_key) {
  return '/key-val/commissions-cutoff-date:' + s_key;
}

function* getCutoffDate(s_key) {
  const url = keyUrl(s_key);
  const resp = yield dataClient.get(url);
  if (resp.statusCode != 200) return CUTOFF_EPOCH;
  const val = Number(resp.body);
  if (!val) return CUTOFF_EPOCH;
  const date = new Date(val);
  if (date.getTime() < CUTOFF_EPOCH.getTime()) return CUTOFF_EPOCH;
  return date;
}

function* setCutoffDate(s_key, o_date) {
  const url = keyUrl(s_key);
  const time = String(o_date.getTime());
  yield dataClient.put({
    url: url,
    body: {
      value: time
    }
  }).then(check('2XX', 'could not set cutoff date'));
}
