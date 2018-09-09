/**
 * Created by dhruva on 9/20/16.
 */
"use strict";

const configs = require('../../../../configs.json');
const utils = require('ominto-utils');
utils.clients.init(configs);
const singleRun = require('../support/single-run');
const dataClient = utils.restClient(configs.data_api);

const request = require('request-promise');

const addReferralPropertiesApi = function() {

    if (!(this instanceof addReferralPropertiesApi)) {
        return new addReferralPropertiesApi();
    }

    this.addReferralProperties = singleRun(function*() {

        let newInvitedUsers= yield dataClient.get('/getNewInvitedFriends',false,this);
        let getNewInvitedSocialFriends= yield dataClient.get('/getNewInvitedSocialFriends',false,this);
        let getOtherFriends= yield dataClient.get('/getOtherFriends',false,this);
    });

    this.addReferralAmount=singleRun(function* () {
        let addReferralAmountForAvailableBalance = yield dataClient.get('/addReferralAmountForAvailableBalance',false,this);
        //let VipReferralAmount = yield dataClient.get('/VipReferralAmount',false,this);
    })

    this.addVipReferralAmount=singleRun(function* () {
        //let addReferralAmountForAvailableBalance = yield dataClient.get('/addReferralAmountForAvailableBalance',false,this);
        let VipReferralAmount = yield dataClient.get('/VipReferralAmount',false,this);
    })
}

module.exports = addReferralPropertiesApi;
