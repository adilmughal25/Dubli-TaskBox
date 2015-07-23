"use strict";

const _ = require('lodash');
const co = require('co');
const utils = require('ominto-utils');
const sendEvents = require('./support/send-events');
const singleRun = require('./support/single-run');
const merge = require('./support/easy-merge')('ProgramId', {
  links: 'ProgramId',
  coupons: 'ProgramId'
});

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
    var ids = _.pluck(results.merchants, 'ProgramId');
    _.extend(results, yield {
      links: client.getCreatives({programIds:ids}),
    });

    var merged = merge(results);
    yield sendEvents.sendMerchants('affilinet-'+s_regionId, merged);
  });

  return {
    getMerchants: getMerchants
  };
}

module.exports = setup;
