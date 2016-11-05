const sendEvents = require('../support/send-events');
const singleRun = require('../support/single-run');

const api = require('./api')();

const STATUS_MAP = {
    Active: 'initiated',
    Cancelled: 'cancelled'
}

const prepareCommission = (o_obj) => {
  return {
    transaction_id: o_obj.air_offer_id || o_obj.requestid || o_obj.tripid,
    order_id: o_obj.id || o_obj.requestid || o_obj.tripid || o_obj.air_offer_id,
    outclick_id: o_obj.refclickid,
    purchase_amount: Number(o_obj.total) || 0,
    commission_amount: Number(o_obj.commission) || 0,
    state: STATUS_MAP[o_obj.status],
    currency: o_obj.currency ? o_obj.currency.toLowerCase() : 'usd' ,
    effective_date: o_obj.date ? new Date(o_obj.date) : new Date(o_obj.reservation_date_time)
  };
}

function PricelineApi() {
    if (!(this instanceof PricelineApi)) return new PricelineApi();

    const getCommissionDetails = singleRun(function* () {
        const events = yield api.get(30).map(prepareCommission);
        return yield sendEvents.sendCommissions('priceline', events);
    });

    const tasks = {
        getCommissionDetails: getCommissionDetails
    };
    return tasks;
}

module.exports = PricelineApi