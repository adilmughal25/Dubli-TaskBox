const sendEvents = require('../support/send-events');
const singleRun = require('../support/single-run');

const api = require('./api')();

const prepareCommission = (o_obj) => {
  return {
    transaction_id: o_obj.air_offer_id || o_obj.requestid || o_obj.tripid,
    order_id: o_obj.id || o_obj.requestid || o_obj.tripid || o_obj.air_offer_id,
    outclick_id: o_obj.refclickid,
    purchase_amount: Number(o_obj.total) || 0,
    commission_amount: Number(o_obj.commission) || 0,
    state: o_obj.transformedStatus,
    currency: o_obj.currency ? o_obj.currency.toLowerCase() : 'usd' ,
    effective_date: o_obj.date ? new Date(o_obj.date) : new Date(o_obj.reservation_date_time)
  };
}

function PricelineApi() {
    if (!(this instanceof PricelineApi)) return new PricelineApi();

    // changing the numberOfDays from 30 to 29, as the api sends the following reponse for 30 days
    /*
    { error:
      { status: 'date range must be no greater than 1 month',
        status_code: 3178,
        time: '0.4601 (#) 282699712'
      }
    }
    */
    // numberOfDays for > 30 days for feb/march overlay is throwing error [even if it is less than 29 days]
    // changing it to 27 days to cover the difference in number of days
    const getCommissionDetails = singleRun(function* () {
        const events = yield api.get(27).map(prepareCommission);
        return yield sendEvents.sendCommissions('priceline', events);
    });

    const tasks = {
        getCommissionDetails: getCommissionDetails
    };
    return tasks;
}

module.exports = PricelineApi
