"use strict";

const rp = require('request-promise');
const _ = require('lodash');
const moment = require('moment');

const options = {
    uri: "https://api.rezserver.com/api/shared/getTRK.Sales.Select",
    qs: {
        refid: 6975,
        api_key: "dfa4ed548299f0ed6438834464ac7819",
        format: "json",
        accountid_value: 6975
    },
    json: true
}

const setStatus = (sales, dateField, options) => {
    return _.values(sales).map((sale) => {
        if(sale.status === 'Cancelled') {
            sale.transformedStatus = 'cancelled';
            return sale;
        }
        const monthsToAdd = options[sale.ratecat] ? options[sale.ratecat] : options['*'];
        const statusDate = moment(sale[dateField]).add(monthsToAdd, 'months').toDate();
        if(statusDate > new Date()) {
            sale.transformedStatus = 'initiated';
        } else {
            sale.transformedStatus = 'confirmed';
        }
        return sale;
    });
}

const hotelSalesStatusMap = {
    MER: 1,
    PRF: 3,
    AGD: 1
}

function PricelineClient() {

    if (!(this instanceof PricelineClient)) return new PricelineClient();

    this.get = (numberOfDays, itr) => {

        const endDate = moment().subtract(numberOfDays * (itr - 1), 'days').startOf('date').format('YYYY-MM-DD_HH:mm:ss');
        const startDate = moment().subtract(numberOfDays * itr, 'days').startOf('date').format('YYYY-MM-DD_HH:mm:ss');

        console.log("Getting commissions from : " + startDate + " to : " + endDate);

        options.qs.time_start = startDate;
        options.qs.time_end = endDate;

        return rp(options)
            .then(function (response) {
                const data = response['getSharedTRK.Sales.Select'].results;
                const salesData = [];

                if(data) {
                  salesData.push(setStatus(data.hotel_sales_data, 'check_out_date_time', hotelSalesStatusMap));
                  salesData.push(setStatus(data.car_sales_data, 'dropoff_time', {'*': 1}));
                  salesData.push(setStatus(data.air_sales_data, 'reservation_date_time', {'*': 1}));
                  salesData.push(setStatus(data.vp_sales_data, 'reservation_date_time', {'*': 1}));
                }

                return _.flatten(salesData);
            })
            .then(function (data) {
                // console.log(data.length)
                return data;
            })
            .catch(function (err) {
                console.log(err)
            });
    }
}

module.exports = PricelineClient;
