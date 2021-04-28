"use strict";

const _ = require('lodash');
const moment = require('moment');
const sendEvents = require('../support/send-events');
const singleRun = require('../support/single-run');
const debug = require('debug')('affiliatewindow:processor');

const AFFILIATE_NAME = 'affiliatewindow';

const taskCache = {};

const STATE_MAP = {
  'pending': 'initiated',
  'approved': 'confirmed',
  'declined': 'cancelled',
  'deleted': 'cancelled',
};
const DATE_MAP = {
  'pending': 'transactionDate',
  'approved': 'validationDate',
  'declined': 'validationDate',
  'deleted': 'validationDate'
};

const AffiliateWindowGenericApi = function(s_entity) {
  if (!(this instanceof AffiliateWindowGenericApi)) {
    debug("instantiating AffiliateWindowGenericApi for: %s", s_entity);
    return new AffiliateWindowGenericApi(s_entity);
  }

  const that = this;
  const entity = s_entity ? s_entity.toLowerCase() : 'ominto';
  const eventName = (entity !== 'ominto' ? entity + '-' : '') + 'affiliatewindow';

  if (taskCache[eventName]) return taskCache[eventName];

  var tasks = {
    client: require('./api')(entity),
    // region: region,
    entity: entity,
    eventName: eventName,
  };


  tasks.getMerchants = singleRun(function* () {
    // Delay function to add a delay to the api calls because of api call limit of awin
    const delay = function(time) {
      return function(f) {
        setTimeout(f, time)
      }
    }
    const rawMerchants = yield tasks.client.getMerchants();

    // Transforming the object keys with what the lambda merchants is expecting
    // This extra step has been added for quick prototyping as awin is going to disconnect the api soon
    /* TODO: Once the current api will start working update lambda merchant accordong
       to current object shape to get rid of extra step of mapping
    */
    const transformedMerchants = rawMerchants.map(merchant => merchantResultMapper(merchant));

    let merchants = [];

    // Pulling the coupons for each merchant
    for (let i = 0; i < transformedMerchants.length; i++) {
      merchants.push(yield that.getCoupons(transformedMerchants[i].merchant));
      // Added delay because AWIN API has a limit of 20 calls per minute
      yield delay(3500);
    }

    merchants = yield that.doApiDeals(merchants);
    return yield sendEvents.sendMerchants(tasks.eventName, merchants);
  });


  this.getCoupons = singleRun(function* (merchant) {
    let commissions = yield tasks.client.getCommissions({ advertiserId : merchant.iId })
    if (commissions.commissionGroups) {
      merchant.commissions = commissions.commissionGroups.map(commission => {
        return commissionResultMapper(commission);
      });
    }
    return { merchant: merchant };
  });

  this.doApiDeals = singleRun(function* (a_merchants){
    var promotions = yield tasks.client.getDeals();
    var results = [];
    for (var i = 0; i < a_merchants.length; i++) {
      let rec = a_merchants[i];
      let merchant = rec.merchant;
      promotions.forEach(p => {
        if(p["Advertiser ID"] == merchant.iId) {
          merchant.promotions.push(p);
        }
      });

      results.push({ merchant: merchant });
    }

    return results;
  });

  tasks.getCommissionDetails = singleRun(function* (merchant){
    const endDate = new Date(Date.now() - (60 * 1000));
    const startDate = moment().subtract(90, 'days').toDate();
    const transactionRanges = getRanges(startDate, endDate);
    const validationRanges = getRanges(startDate, endDate);
    let results = [];

    for (let i = 0; i < transactionRanges.length; i++) {
      let range = transactionRanges[i];
      debug("Getting transactions [type:transaction"+", page:"+ (1 + i) +
      "] for date range: " + startDate.toISOString() + "-" + endDate.toISOString());
      results = results.concat(yield tasks.client.getTransactions({
        startDate: range.start,
        endDate: range.end,
        type: 'transaction'
      }));
    }

    for (let i = 0; i < validationRanges.length; i++) {
      let range = validationRanges[i];
      results = results.concat(yield tasks.client.getTransactions({
        startDate: range.start,
        endDate: range.end,
        type: 'validation'
      }));
    }

    // const events = _.uniq(results, false, x => x.iId).map(prepareCommission);
    const events = _.uniq(results, false, x => x.id).map(prepareCommission);

    return yield sendEvents.sendCommissions(tasks.eventName, events);
  });

  taskCache[eventName] = tasks;

  return tasks;
}

const oneDay = 86400 * 1000;
const maxRange = 28 * oneDay;
function getRanges(startDate, endDate) {
  const diff = endDate.getTime() - startDate.getTime();
  if (diff < maxRange) return [{start:startDate, end:endDate}];
  const ranges = [];
  let remaining = diff;
  let curEnd = endDate;

  while (remaining > maxRange) {
    let curStart = new Date(curEnd.getTime() - maxRange);
    ranges.push({start:moment(curStart).format(), end:moment(curEnd).format()});
    remaining = (curStart.getTime() - startDate.getTime());
    curEnd = new Date(curStart.getTime() - 1);
  }

  ranges.push({start:moment(startDate).format(), end:moment(curEnd).format()});
  return ranges;
}

function commissionResultMapper(commission) {
  return  {
      sCommissionGroupCode: commission.groupCode,
      sCommissionGroupName: commission.groupName,
      mAmount: {},
      fPercentage: commission.percentage,
      type: commission.type,
      flat: commission.amount,
      currency: commission.currency,
    }
}


function merchantResultMapper(merchant) {
  const primaryRegionMapper = (primaryRegion, currencyCode) => (
    {
      sName: primaryRegion.name,
      sCountryCode: primaryRegion.countryCode,
      sCurrencyCode: currencyCode
    }
  );

  return {
    merchant: {
      iId: merchant.id,
      sName: merchant.name,
      sDisplayUrl: merchant.displayUrl,
      sClickThroughUrl: merchant.clickThroughUrl,
      sLogoUrl: merchant.logoUrl,
      oPrimaryRegion: primaryRegionMapper(merchant.primaryRegion, merchant.currencyCode),
      commissions: [],
      promotions: [],
    }
  }
}


function prepareCommission(transaction) {
    const event = {
      affiliate_name: AFFILIATE_NAME,
      merchant_name: '',
      merchant_id: transaction.advertiserId,
      transaction_id: transaction.id,
      order_id: transaction.id,
      outclick_id: transaction.clickRefs.clickRef,
      currency: transaction.commissionAmount.currency,
      purchase_amount: transaction.saleAmount.amount,
      commission_amount: transaction.commissionAmount.amount,
      cashback_id: transaction.transactionParts[0] &&
                   transaction.transactionParts[0].commissionGroupName ?
                   transaction.transactionParts[0].commissionGroupName : ""
    };

    if (transaction.paidToPublisher === true) {
      event.state = 'paid';
      event.effective_date = new Date(transaction.validationDate);
    } else {
      let dateField = DATE_MAP[transaction.commissionStatus];
      event.state = STATE_MAP[transaction.commissionStatus];
      event.effective_date = new Date(transaction[dateField]);
    }

    return event;
  }


module.exports = AffiliateWindowGenericApi;
