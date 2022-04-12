"use strict";

const utils = require('ominto-utils');
const configs = require('../../../../configs.json');
const utilsDataClient = utils.restClient(configs.data_api);

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

  const result = yield utilsDataClient.get('/checkTransactionUpdates/' + affiliateName + '/' + status,
    {transactionIds: transactionIds});
  const validTranIds = result.body;
  if(validTranIds && validTranIds === 'Not Found')
    return stateCommissions;

  if(validTranIds && validTranIds.length === 0)
    return [];

  if(validTranIds && validTranIds.length > 0) {
    return commissions.filter(c => validTranIds.indexOf(c.transaction_id) > -1);
  }
  return stateCommissions;
}

module.exports = {
  removeAlreadyUpdatedCommissions: removeAlreadyUpdatedCommissions
}
