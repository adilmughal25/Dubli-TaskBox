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

function PricelineClient() {
      if (!(this instanceof PricelineClient)) return new PricelineClient();

    this.get = (numberOfDays) => {
        const endDate = moment().startOf('date').format('YYYY-MM-DD_HH:mm:ss');
        const startDate = moment().subtract(numberOfDays, 'days').startOf('date').format('YYYY-MM-DD_HH:mm:ss');

        options.qs.time_start = startDate;
        options.qs.time_end = endDate;

        return rp(options)
            .then(function (response) {
                const data = response['getSharedTRK.Sales.Select'].results;
                const salesData = [];
                salesData.push(_.values(data.hotel_sales_data));
                salesData.push(_.values(data.car_sales_data));
                salesData.push(_.values(data.air_sales_data));
                salesData.push(_.values(data.vp_sales_data));
                return _.flatten(salesData);
            })
            .then(function (data) {
                console.log(data.length)
                return data;
            })
            .catch(function (err) {
                console.log(err)
            });
    }
}
module.exports = PricelineClient;
