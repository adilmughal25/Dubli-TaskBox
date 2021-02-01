"use strict";

const _ = require('lodash');
const debug = require('debug')('jumia:processor');
const sendEvents = require('../support/send-events');
const singleRun = require('../support/single-run');

const exists = x => !!x;

const AFFILIATE_NAME = 'jumia';

const STATE_MAP = {
  'pending': 'initiated',
  'approved': 'confirmed',
  'rejected': 'cancelled'
};

const JumiaSheetGenericApi = function (s_entity) {
  if (!(this instanceof JumiaSheetGenericApi)) {
    debug("instantiating JumiaSheetGenericApi for: %s", s_entity);
    return new JumiaSheetGenericApi(s_entity);
  }

  var that = this;

  this.entity = s_entity ? s_entity.toLowerCase() : '';
  that.client = require('./api')(this.entity);
  this.eventName = this.entity;


  /**
   * Retrieve all commission details (sales/transactions) from affiiate within given period of time.
   * @returns {undefined}
   */
  this.getCommissionDetails = singleRun(function* () {
    const event_conversions = yield that.client.getTransactions();
    const groupedOrders = groupBy(event_conversions, 'Order Nr');
    const events = prepareUniqueOrderId(groupedOrders).map(prepareCommission).filter(exists);
    return sendEvents.sendCommissions(that.eventName, events);

  });


}

// Group by to get each order ID transactions
var groupBy = function(xs, key) {
  return xs.reduce(function(rv, x) {
    (rv[x[key]] = rv[x[key]] || []).push(x);
    return rv;
  }, {});
};
/*
To Create our own rules to generate Unique Order Id
Add All Pending If no approved and rejected
Add All approved If no pending and rejected
Add All rejected If no pending and approved
Add Pending and Approved with State Initiated
Add Only Pending and Approved If it is also containing rejected. So rejected combination with approved and
rejected we are not sending rejected to our system.
 */
function prepareUniqueOrderId(groupedOrders) {
 try {
   const TransactionArray = [];
   for (let orderNum in groupedOrders) {
     const arr = groupedOrders[orderNum];
     if (arr.length === 1) {
       arr[0].Status = STATE_MAP[arr[0].Status];
       TransactionArray.push(arr[0]);
     } else {
       let pending = arr.filter(o => o.Status === 'pending');
       let approved = arr.filter(o => o.Status === 'approved');
       let rejected = arr.filter(o => o.Status === 'rejected');

       if (pending.length && !approved.length && !rejected.length)
         mergeArray(TransactionArray, formatArray(pending, 'initiated'));
       else if (approved.length && !pending.length && !rejected.length)
         mergeArray(TransactionArray, formatArray(approved, 'confirmed'));
       else if (rejected.length && !pending.length && !approved.length)
         mergeArray(TransactionArray, formatArray(rejected, 'cancelled'));
       else if (pending.length && approved.length){
         mergeArray(pending,approved);
         mergeArray(TransactionArray, formatArray(pending, 'initiated'));
       }
       else if (pending.length && rejected.length)
         mergeArray(TransactionArray, formatArray(pending, 'initiated'));
       else if (approved.length && rejected.length)
         mergeArray(TransactionArray, formatArray(approved, 'confirmed'));
     }
   }
   return TransactionArray;
 } catch (e) {
   console.log(e);
 }
}
 function mergeArray(array1, array2){
   Array.prototype.push.apply(array1,array2);
 }

// To Add Purchase Amount and Commission Amount For same Order Id
function formatArray(arr, status){
  let transactionObject = arr[0];
  let amountInEur = 0;
  let commissionAmountInEur = 0;
  for (let i=0; i <arr.length; i++){
    amountInEur += parseFloat(arr[i]['Amount in Eur']);
    commissionAmountInEur += parseFloat(arr[i]['Commission Amount in Eur']);
  }
  transactionObject.Status = status;
  transactionObject['Amount in Eur'] = amountInEur.toFixed(2);
  transactionObject['Commission Amount in Eur'] = commissionAmountInEur.toFixed(2);
  return [transactionObject];
}

function prepareCommission(obj) {
  const event = {
    affiliate_name: AFFILIATE_NAME,
    merchant_name: '',
    merchant_id: '',
    transaction_id: obj["Order Nr"],
    order_id: obj["Order Nr"],
    outclick_id: obj.Tags,
    currency: "eur",
    purchase_amount: obj["Amount in Eur"],
    commission_amount: obj["Commission Amount in Eur"],
    state: obj.Status,
    effective_date: obj["Created At"]
  };


  return event;
}

module.exports = JumiaSheetGenericApi;

