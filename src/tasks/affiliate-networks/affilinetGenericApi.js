"use strict";

const _ = require('lodash');
const co = require('co');
const utils = require('ominto-utils');
const sendEvents = require('./support/send-events');
const singleRun = require('./support/single-run');
const moment = require('moment');
const merge = require('./support/easy-merge')('ProgramId', {
  links: 'ProgramId',
  coupons: 'ProgramId'
});
const exists = x => !!x;
const isDate = x => (/^\d{4}(-\d{2}){2}T(\d{2}:){2}\d{2}/).test(x);

const STATE_MAP = {
  'open': 'tracked',
  'confirmed': 'confirmed',
  'cancelled': 'cancelled'
};

function setup(s_regionId) {
  if (!s_regionId) throw new Error("Affili.net Generic API needs region id!");

  const client = require('./api-clients/affilinet')(s_regionId);
  const debug = require('debug')('affilinet:'+s_regionId+':processor');

  const getMerchants = singleRun(function*() {
    yield client.ensureLoggedIn();
    var results = yield {
      merchants: client.getPrograms(),
      coupons: client.getVouchers()
    };
    debug("merchants count: %d", results.merchants.length);
    debug("coupons count: %d", results.coupons.length);
    var ids = _.pluck(results.merchants, 'ProgramId');
    let links = [];
    for (let i = 0; i < ids.length; i += 50) {
      let group = ids.slice(i, i+50);
      links = links.concat(yield client.getCreatives({programIds:group}));
      debug("[%d of %d] %d links totals", i+1, ids.length, links.length);
    }
    results.links = links;
    debug("links count: %d", results.links.length);

    var merged = merge(results);
    yield sendEvents.sendMerchants('affilinet-'+s_regionId, merged);
  });

  function prepareCommission(o_obj) {
    let date = new Date(o_obj.RegistrationDate);
    if (typeof o_obj.CheckDate === 'string' && isDate(o_obj.CheckDate)) {
      date = new Date(o_obj.CheckDate);
    }
    const event = {
      transaction_id: o_obj.TransactionId,
      outclick_id: o_obj.SubId,
      purchase_amount: o_obj.NetPrice,
      commission_amount: o_obj.PublisherCommission,
      currency: (s_regionId === 'uk' ? 'gbp' : 'euro'),
      state: STATE_MAP[o_obj.TransactionStatus],
      effective_date: date
    };
    return event;
  }
  const getCommissionDetails = singleRun(function* () {
    yield client.ensureLoggedIn();
    const startDate = moment().subtract(30, 'days').format('YYYY-MM-DD');
    const endDate = moment().format('YYYY-MM-DD');
    const results = yield [
      client.getTransactions({startDate:startDate, endDate:endDate, valuationType:'DateOfRegistration'}),
      client.getTransactions({startDate:startDate, endDate:endDate, valuationType:'DateOfConfirmation'})
    ];
    const all = Array.prototype.concat.apply([], results);
    const events = all.map(prepareCommission).filter(exists);
    yield sendEvents.sendCommissions('affilinet-'+s_regionId, events);
  });

  return {
    getMerchants: getMerchants,
    getCommissionDetails: getCommissionDetails
  };
}

module.exports = setup;
