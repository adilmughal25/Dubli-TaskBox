/**
 * Created by dhruva on 9/20/16.
 */
"use strict";

const configs = require('../../../../configs.json');
const utils = require('ominto-utils');
utils.clients.init(configs);
const singleRun = require('../support/single-run');
const directKinesisPut = require('../support/direct-kinesis-put');
const dataClient = utils.restClient(configs.data_api);

const sendVIPRenewalReminderApi = function() {

    if (!(this instanceof sendVIPRenewalReminderApi)) {
        return new sendVIPRenewalReminderApi();
    }

    this.sendEmailReminder = singleRun(function*() {
      // Send email reminder for VIP Customer when VIP expired in 1, 7 and 30 days before
      yield sendEmailToUser(30);
      yield sendEmailToUser(7);
      yield sendEmailToUser(1);
    });
}

function * sendEmailToUser (dateToExpiration) {
  let result = yield dataClient.get('/getAllUsersByVIPExpirationDate/' + dateToExpiration, {}, this);
  let userList = result.body;

  // trigger event to send email to each user in the list
  for (var i = 0; i < userList.length; i++) {
    yield directKinesisPut('user-consolidated', 'userDid:vipRenewalReminder', {
        user: {
          id: userList[i].id
        }
    }, null, "vip-renewal-reminder");
  }
}

module.exports = sendVIPRenewalReminderApi;
