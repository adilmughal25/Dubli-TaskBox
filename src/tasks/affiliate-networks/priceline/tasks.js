const sendEvents = require('../support/send-events');
const singleRun = require('../support/single-run');
const api = require('./api')();

const AFFILIATE_NAME = 'direct-partner';
const MERCHANT_NAME = 'priceline';

// OM-1929 VIP Lounge - Priceline
// 'ratecat' & 'is_hotel_transaction' are additional transaction fields in the commission
// object which are used to process Priceline CUG & Hotel purchases differently in
// lambda-transactions (other commission objects dont have these fields)
const prepareCommission = (o_obj) => {

  var is_hotel_transaction = false;
  if(o_obj.hotelid && o_obj.hotel_name)
    is_hotel_transaction = true;

  return {
    affiliate_name: AFFILIATE_NAME,
    merchant_name: MERCHANT_NAME,
    merchant_id: '',
    transaction_id: o_obj.air_offer_id || o_obj.requestid || o_obj.tripid,
    order_id: o_obj.id || o_obj.requestid || o_obj.tripid || o_obj.air_offer_id,
    outclick_id: o_obj.refclickid,
    purchase_amount: Number(o_obj.sub_total) || 0,
    commission_amount: Number(o_obj.commission) || 0,
    state: o_obj.transformedStatus,
    currency: o_obj.currency ? o_obj.currency.toLowerCase() : 'usd' ,
    effective_date: o_obj.date ? new Date(o_obj.date) : new Date(o_obj.reservation_date_time),
    ratecat: o_obj.ratecat || '',
    is_hotel_transaction: is_hotel_transaction
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
    // running the commissions for 90 days (making 6 calls of 15 days each)
    const getCommissionDetails = singleRun(function* () {

        var events = [];
        for(var itr=18;itr>0;itr--){
          events = events.concat(yield api.get(15, itr).map(prepareCommission));
        }

        return yield sendEvents.sendCommissions('priceline', events);
    });

    const tasks = {
        getCommissionDetails: getCommissionDetails
    };

    return tasks;
}

module.exports = PricelineApi
