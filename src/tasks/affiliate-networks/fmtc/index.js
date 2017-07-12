"use strict";
const __basedir = ".";
var fs = require("fs");
var exec = require('child_process').exec;
var co = require('co');
var csvFilePath='deals.csv';
var csv = require('csvtojson');
const uuid = require('node-uuid');
// var events = require('events');
// var eventEmitter = new events.EventEmitter();
const noOfChildProcess = 10;
var utils = require('ominto-utils');
var merchantDealsData = [];
var merchantObj=[];
var FMTC_log = [];
var mode = process.argv[2];
console.log(process.argv[0]);
console.log(mode);
console.log("Process Started");
var cmdDeals='curl -o deals.csv "https://services.fmtc.co/v2/getDeals?key=53c69f61b7bda6a33cf455aef5293574&format=csv"';
if(mode != 'all'){
    cmdDeals='curl -o deals.csv "https://services.fmtc.co/v2/getDeals?key=53c69f61b7bda6a33cf455aef5293574&format=csv&incremental=1"';
}
//console.log(cmdDeals);

function getFmtcMerchantData() {
    var cmd2='curl -o merchants.csv "https://services.fmtc.co/v2/getMerchants?key=53c69f61b7bda6a33cf455aef5293574&format=csv"';
    var child = exec(cmd2,{maxBuffer: 1024 * 150000}, function(err, stdout, stderr) {
        if (err) throw err;
        else {
            console.log("Merchants Downloaded");
            csv()
                .fromFile('merchants.csv')
                .on('json',(jsonObj)=>{
                    merchantObj.push(jsonObj);
                })
                .on('end',(error)=>{
                    // //fs.unlink("merchants.csv",function(){
                    //     console.log("Deleted:merchants");
                    // });
                    getFmtcDealsData();

                });
        }
    });
}

function getFmtcDealsData() {

    console.log( " iam called in deals ");
    var cmd2='curl -o deals.csv "https://services.fmtc.co/v2/getDeals?key=53c69f61b7bda6a33cf455aef5293574&format=csv"';

    var child = exec(cmd2,{maxBuffer: 1024 * 15000}, function(err, stdout, stderr) {
        if (err) throw err;
        else {
            console.log("Deals Downloaded");
            executeChildProcess();
        }
    });

}


function executeChildProcess() {
    var dealsObj=[];
    console.log("Executing Child Process");
    csv()
        .fromFile('deals.csv')
        .on('json',(jsonObj)=>{
            dealsObj.push(jsonObj);
        })
        .on('end',(error)=>{
            //  fs.unlink("deals.csv",function(){
            //    console.log("Deleted:deals");
            //});
            merchantDealsData= merchantObj.map(function (mItem) {
                mItem.deals = dealsObj.filter(function(dItem){
                    return dItem.MerchantID == mItem.MerchantID;
                });
                return mItem;

            });
            console.log("Data Mapped");
            // console.log(merchantDealsData);
            var recPerPage = Math.round(merchantDealsData.length/noOfChildProcess);
            for(var i = merchantDealsData.length, j=1;i>=0;i=i-recPerPage,j++){
                console.log(" dividing the file to parts");
                var toJAONFile = merchantDealsData.splice(i, recPerPage);
                fs.writeFileSync('./md'+j+'.json', JSON.stringify(toJAONFile), 'utf-8');
            }
            // fs.writeFileSync('./md.json', JSON.stringify(merchantDealsData), 'utf-8');
            console.log(JSON.stringify(merchantDealsData[0]));

        });
}


var init = function () {
    getFmtcMerchantData();
};

init();
