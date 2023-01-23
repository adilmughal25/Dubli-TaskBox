"use strict";

const _ = require('lodash');
const co = require('co');
//const utils = require('ominto-utils');
const configs = require('../../../../configs.json');
//const utilsDataClient = utils.restClient(configs.data_api);

const sendEvents = require('../support/send-events');

const merge = require('../support/easy-merge')('advertiser-id', {
  links: 'advertiser-id'
});

const CJImportDealsAPI = function() {
  if (!(this instanceof CJImportDealsAPI)) return new CJImportDealsAPI();

  var that = this;

  this.eventName = "commissionjunction-us";

  const debug = require('debug')('cjImportDeals' + ':processor');

  this.getMerchants = co.wrap(function* () {
    let merchants = [];
    let allLinks = [];
    //let subMerchants = yield utilsDataClient.get('/getImportDealsByAffiliate/' + that.eventName, true, this);

    for(let i=0; i<subMerchants.body.length; i++) {
      let subMerchant = subMerchants.body[i];
      debug('subMerchant ----> ', JSON.stringify(subMerchant));
      //let merchant = yield utilsDataClient.get('/getMerchantByAffiliateID/' + subMerchant.to_affiliate_id + '/' + subMerchant.affiliate_name);
      if(merchant && merchant.body)
        merchants.push(prepareMerchant(merchant.body));

      //let deals = yield utilsDataClient.get('/getDealsByMerchantIDAndName/' + subMerchant.parent_id + '/' + subMerchant.deal_name, true, this)
      deals.body.forEach(deal => {
        allLinks.push(prepareLink(merchant.body.affiliate_id, deal));
      });
    }

    const results = {
      merchants: merchants,
      links: allLinks
    };

    const data = merge(results);

    return yield sendEvents.sendMerchants(that.eventName, data);
  });
};

function prepareMerchant(merchant) {
  if(!merchant) return;

  return {
    "advertiser-id" : merchant.affiliate_id,
    "account-status": "Active",
    "advertiser-name": merchant.name,
    "program-url": merchant.display_url,
    "primary-category": {},
    "actions": {"action": []},
    "main_tracking_url": merchant.affiliate_tracking_url
  }
}

function prepareLink(affiliateID, link) {
  if(!link) return;

  return {
    "advertiser-id": affiliateID,
    "advertiser-name": link.name,
    "category": "",
    "click-commission": "0.0",
    "creative-height": "0",
    "creative-width": "0",
    "language": "English",
    "lead-commission": "",
    "link-code-html": "",
    "link-code-javascript": "",
    "description": link.description,
    "destination": link.display_url,
    "link-id": link.affiliate_id,
    "link-name": link.name,
    "link-type": "Text Link",
    "performance-incentive": "false",
    "promotion-end-date": link.end_date,
    "promotion-start-date": link.start_date,
    "promotion-type": "N/A",
    "coupon-code": "",
    "relationship-status": "joined",
    "sale-commission": "0.00%",
    "seven-day-epc": "N/A",
    "three-month-epc": "N/A",
    "clickUrl": link.affiliate_tracking_url
  }
}

module.exports = CJImportDealsAPI;
