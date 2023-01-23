"use strict";

//const utils = require('ominto-utils');
const configs = require('../../../../configs.json');
//const utilsDataClient = utils.restClient(configs.data_api);
const _ = require('lodash');

function * removeAlreadyUpdatedCommissions(commissions, affiliateName) {
  let newCommissions = [];
  newCommissions = newCommissions.concat(yield getCommissionsToUpdate(commissions, 'initiated', affiliateName));
  newCommissions = newCommissions.concat(yield getCommissionsToUpdate(commissions, 'confirmed', affiliateName));
  newCommissions = newCommissions.concat(yield getCommissionsToUpdate(commissions, 'cancelled', affiliateName));
  newCommissions = newCommissions.concat(yield getCommissionsToUpdate(commissions, 'paid', affiliateName));
  return newCommissions;
}

function * getCommissionsToUpdate(commissions, status, affiliateName) {
  const stateCommissions = commissions.filter(c => c.state === status);
  let transactionIds = stateCommissions.map(c => c.transaction_id);

  if(transactionIds.length === 0)
    return stateCommissions;

  const chunkArr = _.chunk(transactionIds, 20);

  const result = yield chunkArr.map(t => callDataClient(affiliateName, status, t));

  let validTranIds = [];
  result.map(r => {
    validTranIds = validTranIds.concat(r.body)
  });

  if(validTranIds && validTranIds === 'Not Found')
    return stateCommissions;

  if(validTranIds && validTranIds.length === 0)
    return [];

  if(validTranIds && validTranIds.length > 0) {
    return commissions.filter(c => validTranIds.indexOf(c.transaction_id) > -1);
  }
  return stateCommissions;
}

function * callDataClient(affiliateName, status, t) {
  //return yield utilsDataClient.get('/checkTransactionUpdates/' + affiliateName + '/' + status,
    //{transactionIds: t});
}

module.exports = {
  removeAlreadyUpdatedCommissions: removeAlreadyUpdatedCommissions
}
