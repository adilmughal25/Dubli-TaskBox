"use strict";
//const __basedir = ".";
var fs = require("fs");
//var exec = require('child_process').exec;
var co = require('co');
const uuid = require('node-uuid');
var mysql = require('mysql');

var connection = mysql.createConnection({
    host     : 'prod-aurora-1.cluster-c8u1gyohhq68.us-east-1.rds.amazonaws.com',
    user     : 'prod-data',
    password : 'Pqf!WE^=VJmXgFZp6h4k3Sm%wCr&Gf',
    database : 'data'
});
connection.connect();


//var utils = require('ominto-utils');


var configs = {
    "writer": {
        "host": "prod-aurora-1.cluster-c8u1gyohhq68.us-east-1.rds.amazonaws.com",
        "port": 3306,
        "user": "prod-data",
        "password": "Pqf!WE^=VJmXgFZp6h4k3Sm%wCr&Gf",
        "database": "data",
        "poolSize": 100,
        "ssl": "Amazon RDS"
    },env:"dev"
};
//const langs = ['da', 'de', 'en', 'es', 'fr', 'it', 'pt', 'ru', 'jp', 'ar'];
const FMTC_affiliate_name = ['LS','CJ','PJ','IR','ALC','AL','CF','PH','SAS','WG','DGM','AW','TD'];
const DB_affiliate_name = ['linkshare','commissionjunction-us','pepperjam','impactradius','avantlink-ca','avantlink-us','commissionfactory','performancehorizon','shareasale','webgains','apdperformance','zanox','tradedoubler'];
var merchantDealsData = [];

console.log("Importer Started");
var MysqlClient = (function(){
    /*globals configs */
    'use strict';
    const _ = require('lodash');
    const mysql = require('mysql');
    const env = configs.env || process.env.NODE_ENV || 'dev';

    const SPECIAL_TYPES = {
        CURRENT_TIMESTAMP: {value: 'CURRENT_TIMESTAMP'}
    };

    const SPECIAL_TYPE_VALUES = _.values(SPECIAL_TYPES);

// Was getting very weird things when using denodeify and transactions (ER_EMPTY_QUERY).
// So just made one that works.
    function _denodeify (obj) {
        var result = {};
        _.each(_.toArray(arguments).slice(1), name => {
            var fn = obj[name];
            result['$' + name] = function *() {
                var args = _.toArray(arguments);
                return yield new Promise(function (resolve, reject) {
                    args.push(function (err, result) {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(result);
                        }
                    });
                    fn.apply(obj, args);
                });
            };
        });
        return result;
    }

    function MysqlClient (config) {
        if (this.constructor !== MysqlClient) {
            return new MysqlClient(config);
        }
        if (!config.host || !config.port || !config.user) {
            throw new Error('MysqlClient requires an aurora config with host, port, and user');
        }

        if (config.cache) {
            this.configureCache(config.cache);
        }
        this.configureMysql(config);
    }

    MysqlClient.prototype.configureCache = function (config) {
        var cache = new Memcached(config.hosts, {
            poolSize: config.poolSize
        });

        _.extend(cache, _denodeify(cache, 'get', 'set', 'delete', 'flush'));

        this.cache = cache;
    };

    MysqlClient.prototype.configureMysql = function (config) {
        var _config = {
            host: config.host,
            port: config.port,
            user: config.user,
            password: config.password,
            database: config.database,
            ssl: config.ssl,
            connectionLimit: config.poolSize,
            waitForConnections: false,
            queueLimit: 1,
            acquireTimeout: 5000,
            connectTimeout: 5000,
            timezone: 'UTC',
            multipleStatements: true
        };

        _.each(_config, (value, key) => {
            if (_.isUndefined(value)) {
                throw new Error('config.' + key + ' was undefined when creating MysqlClient');
            }
        });

        this.mysql = mysql.createPool(_config);

        _.extend(this, _denodeify(this.mysql, 'query', 'getConnection'));
    };

    function _handleError (err, additionalInfo) {
        throw _.merge(err, {
            type: 'query'
        }, additionalInfo);
    }

    function _sanitize (value) {
        var result;
        if (_.isArray(value)) {
            result = '(' + _.map(value, function (subValue) {
                    return _sanitize.bind(this)(subValue);
                }.bind(this)).join(', ') + ')';
        } else {
            result = this.escape(value);
        }
        return result;
    }

    function _replaceValues (query, values) {
        var sanitized = _.transform(values, function (result, value, key) {
            result[key] = _sanitize.bind(this)(value);
        }.bind(this));
        var result = query;
        _.each(sanitized, function (value, key) { // eslint-disable-line
            result = result.replace(new RegExp(':' + key + '(?:\\b|$)', 'g'), () => value);
        }.bind(this));
        return result;
    }

    function _formatQuery (query, values) {
        var remaining = query;
        var result = '';
        var pattern = /['`"]/;
        var match;
        var holding = [];
        var i = 0;
        while ((match = pattern.exec(remaining)) != null) {
            result += remaining.substr(0, match.index + 1);
            remaining = remaining.substr(match.index + 1);
            var nextIndex = -1; // will be incremented to 0 on first iteration.
            do {
                nextIndex = remaining.indexOf(match[0], nextIndex + 1);
                if (nextIndex === -1) {
                    throw new Error('Mismatch in query [' + query + '] at [' + match[0] + remaining + ']');
                }
            } while (nextIndex > 0 && remaining[nextIndex - 1] === '\\');
            holding.push(remaining.substr(0, nextIndex));
            result += '__' + i++ + match[0];
            remaining = remaining.substr(nextIndex + 1);
        }

        result += remaining;
        result = _replaceValues.bind(this)(result, values);

        _.each(holding, (value, key) => {
            result = result.replace('__' + key, value);
        });

        return result;
    }

    function * _performQuery (formatted, query, values) {
        //  console.log('Performing query: ', JSON.stringify({
        //    query: query,
        //  values: JSON.stringify(values),
        //formatted: formatted
        //}, null, 2));

        try {
            return yield this.$query(formatted);
        } catch (err) {
            _handleError(err, {
                query: query,
                values: JSON.stringify(values),
                formatted: formatted
            });
        }
    }

    MysqlClient.prototype.query = function * (query, values, bypassCache, ttl) {
        var formatted = _formatQuery.bind(this.mysql)(query, values);
        return yield _performQuery.bind(this)(formatted, query, values);
    };

    MysqlClient.prototype.escape = function (value) {
        var result;
        if (_.isObject(value) && SPECIAL_TYPE_VALUES.indexOf(value) > -1) {
            result = value.value;
        } else {
            result = this.mysql.escape(value);
        }
        return result;
    };

    MysqlClient.prototype.SPECIAL_TYPES = SPECIAL_TYPES;

    return MysqlClient;
})();
console.log(process.argv[2]);
merchantDealsData = JSON.parse(fs.readFileSync('./'+process.argv[2]));
console.log("merchantDealsData-----------------",merchantDealsData.length);
if(merchantDealsData.length > 0){
    co(checkDealsMerchantTable()).catch(err => {
        console.log(err)
    });
}
else {
    process.exit(0);

}


function * checkDealsMerchantTable() {
    var mysqlLocal = new MysqlClient(configs.writer);
    var clients = [mysqlLocal];

    for (var i = 0; i < merchantDealsData.length; i++) {
        var mysql = clients[0];
        var deal_insert = [];
        var deal_detail_insert=[];
        console.log(" merchant loop ", i,"deals",merchantDealsData[i].deals.length);

        if (merchantDealsData[i].deals.length != 0) {
            var affiliate_name = merchantDealsData[i].deals[0].Network;
            var merchant_id = merchantDealsData[i].MerchantID;
            var affiliate_id = merchantDealsData[i].NetworkID;
            var DB_affiliate_name1 = "";

            for (var a = 0; a < FMTC_affiliate_name.length; a++) {

                if (affiliate_name === FMTC_affiliate_name[a]) {

                    DB_affiliate_name1 = DB_affiliate_name[a];

                }

            }

            var db_merchantID ;
            var db_merchantID_count;

            if (DB_affiliate_name1 == "zanox") {

                db_merchantID_count = yield mysql.query(
                    'select count(*) as db_merchantID_count,id as db_merchantID FROM merchant where affiliate_id = :affiliate_id AND affiliate_name in ( "affiliatewindow","zanox")', {
                        affiliate_id: affiliate_id
                    },
                    true
                );

                db_merchantID = db_merchantID_count[0].db_merchantID;


            } else {
                db_merchantID_count = yield mysql.query(
                    'select count(*) as db_merchantID_count,id as db_merchantID FROM merchant where affiliate_id = :affiliate_id  AND affiliate_name =  :DB_affiliate_name1 ', {
                        affiliate_id: affiliate_id,
                        DB_affiliate_name1: DB_affiliate_name1
                    },
                    true
                );

                db_merchantID = db_merchantID_count[0].db_merchantID;

            }
            console.log("affiliate_name ", affiliate_name,"DB_affiliate_name1", DB_affiliate_name1,"affiliate_id",affiliate_id,"DB Merchant id ", db_merchantID);

            if(db_merchantID && db_merchantID !=30128 && db_merchantID !=6468){

                for (var j = 0; j < merchantDealsData[i].deals.length; j++) {
                    console.log("deal loop ", j);


                    var dealsArr = merchantDealsData[i].deals[j];
                    var tempDeals = dealsArr.CouponID;
                    var old_id = null;
                    var unique_hash = '';
                    var affiliate_tracking_url = (dealsArr.AffiliateURL).replace(/'/g, "\\'");
                    var start_date1 = new Date(dealsArr.StartDate).toUTCString();
                    var start_date = new Date(start_date1).toISOString();
                    var end_date1 = new Date(dealsArr.EndDate).toUTCString();
                    var end_date = new Date(end_date1).toISOString();
                    var end_date2 = "2037-12-31T23:59:59.000Z";

                    if (end_date2 < end_date) {
                        end_date = new Date(new Date(end_date2).toUTCString()).toISOString();
                    }

                    var imp_overridden_fields = '';
                    var created = new Date(new Date(dealsArr.Created).toUTCString()).toISOString();
                    var last_updated = dealsArr.LastUpdated;
                    var deal_source = 'FMTC';
                    var source_couponID = dealsArr.CouponID;

                    var name = (dealsArr.Label).replace(/'/g, "\\'");
                    var description = (dealsArr.Label).replace(/'/g, "\\'");
                    var code = dealsArr.CouponCode;
                    var country = merchantDealsData[i].ShipsToCountries;
                    var region = [];
                    region = country.split(',');
                    var restriction = (dealsArr.Restrictions).replace(/'/g, "\\'");
                    var reviewed = 0;
                    var active = dealsArr.Status;
                    if (active == "active") {
                        active = 0;
                    }
                    else {
                        if (active == "deleted") {
                            active = -1;
                        }
                    }
                    unique_hash = uuid.v4();

                    var deal_merchantID = dealsArr.MerchantID;



                    //affiliate_tracking_url = utils.addSubIdToTrackingUrl(DB_affiliate_name1, affiliate_tracking_url) || affiliate_tracking_url;
                    affiliate_tracking_url = affiliate_tracking_url.replace(/'/g, "\\'");

                    if (deal_merchantID == merchant_id) {
                        //   count++;


                        var db_db_display_url_count = yield mysql.query(
                            'select count(*) as db_display_url_count,display_url as db_display_url FROM merchant_detail where merchant_id = :db_merchantID ', {
                                db_merchantID: db_merchantID
                            },
                            true
                        );

                        if (db_db_display_url_count[0].db_display_url_count == 0) {
                            console.log("count for display url2", db_db_display_url_count[0].db_display_url_count);
                            var db_display_url = null;
                            console.log("count for display url3", db_db_display_url_count[0].db_display_url_count);

                        } else {
                            db_display_url = db_db_display_url_count[0].db_display_url;


                        }


                        var resultD = yield mysql.query(
                            'select count(*) as item_count from merchant_deal Where source_couponID =  :source_couponID ', {
                                source_couponID: source_couponID
                            },
                            true
                        );
                        console.log("db_merchantID",db_merchantID,"resultD" , resultD[0].item_count);

                        if (resultD[0].item_count == 0 && db_merchantID) {
                            var deal_params = [
                                db_merchantID,
                                unique_hash,
                                affiliate_id,
                                affiliate_tracking_url,
                                start_date,
                                end_date,
                                new Date(last_updated).toISOString(),
                                deal_source,
                                source_couponID
                            ];

                            deal_insert.push(deal_params);

                        }
                        var resultDD = yield mysql.query(
                            'select count(*) as item_count from merchant_deal_detail Where source_couponID =  :source_couponID ', {
                                source_couponID: source_couponID
                            },
                            true
                        );

                        console.log("db_merchantID",db_merchantID,"resultDD" , resultDD[0].item_count);

                        if (resultDD[0].item_count == 0 && db_merchantID) {

                            var deal_detail_params = [
                                0,
                                'en',
                                'zz',
                                name,
                                description,
                                db_display_url,
                                code,
                                restriction,
                                reviewed,
                                active,
                                last_updated,
                                deal_source,
                                source_couponID
                            ];

                            deal_detail_insert.push(deal_detail_params);

                        }


                        if (db_merchantID && resultDD[0].item_count > 0 && resultD[0].item_count > 0){
                            var resultUpdate = yield mysql.query(
                                " SELECT (case when count(*) = 0 then 0  when count(*) <> 0 then imp_overridden_fields  end) as over_ride FROM merchant_deal where deal_source = :deal_source"
                                + " AND source_lastupdated < TIMESTAMP( :last_updated ) AND source_couponID =  :source_couponID  ", {
                                    deal_source: 'FMTC',
                                    last_updated: last_updated,
                                    source_couponID: source_couponID
                                },
                                true
                            );
                            console.log("over_ride", resultUpdate[0].over_ride);
                            var over_ride = [];
                            if (resultUpdate[0].over_ride != null && resultUpdate[0].over_ride != 0) {
                                over_ride = (resultUpdate[0].over_ride).split(",");
                            }
                            if (resultUpdate[0].over_ride == null && resultUpdate[0].over_ride != 0) {
                                mysql.query(
                                    " UPDATE merchant_deal SET  affiliate_tracking_url= :affiliate_tracking_url , start_date=TIMESTAMP( :start_date ), end_date=TIMESTAMP( :end_date ),"
                                    + "last_updated=current_timestamp(),source_lastupdated=TIMESTAMP( :last_updated ), created=current_timestamp() where deal_source = :deal_source "
                                    + " AND source_lastupdated < TIMESTAMP( :last_updated ) AND source_couponID = :source_couponID  ", {
                                        affiliate_tracking_url: affiliate_tracking_url,
                                        start_date: start_date,
                                        end_date: end_date,
                                        last_updated: last_updated,
                                        deal_source: 'FMTC',
                                        source_couponID: source_couponID
                                    },
                                    true
                                );

                                mysql.query(
                                    "UPDATE merchant_deal_detail SET source_lastupdated = TIMESTAMP( :last_updated ), name = :name ,description = :description ,"
                                    + "code= :code ,display_url = :db_display_url ,restriction= :restriction ,created=current_timestamp() where deal_source = :deal_source"
                                    + " AND source_lastupdated < TIMESTAMP( :last_updated ) AND source_couponID = :source_couponID ", {
                                        name: name,
                                        description: description,
                                        code: code,
                                        db_display_url: db_display_url,
                                        restriction: restriction,
                                        deal_source: 'FMTC',
                                        last_updated: last_updated,
                                        source_couponID: source_couponID
                                    },
                                    true
                                );


                            }
                            else if (resultUpdate[0].over_ride != null && resultUpdate[0].over_ride != 0) {
                                var noOfUPDATECols = 0;
                                var sqlQ = "UPDATE merchant_deal SET ";
                                if (over_ride.indexOf('affiliate_tracking_url') == -1) {
                                    noOfUPDATECols++;
                                    sqlQ += " affiliate_tracking_url= :affiliate_tracking_url ,";
                                }
                                if (over_ride.indexOf('start_date') == -1) {
                                    noOfUPDATECols++;
                                    sqlQ += " start_date=TIMESTAMP( :start_date ),";
                                }
                                if (over_ride.indexOf('end_date') == -1) {
                                    noOfUPDATECols++;
                                    sqlQ += " end_date=TIMESTAMP( :end_date ),";
                                }
                                if (over_ride.indexOf('last_updated') == -1) {
                                    noOfUPDATECols++;
                                    sqlQ += " last_updated=current_timestamp(),";
                                }
                                if (over_ride.indexOf('created') == -1) {
                                    noOfUPDATECols++;
                                    sqlQ += " created=current_timestamp(),";
                                }
                                sqlQ += " source_lastupdated=TIMESTAMP( :last_updated )";
                                sqlQ += " where deal_source = :deal_source "
                                    + " AND source_lastupdated < TIMESTAMP( :last_updated ) AND source_couponID =   :source_couponID ";
                                sqlQ = sqlQ.trim(",");
                                if (noOfUPDATECols > 0)
                                    mysql.query(sqlQ, {
                                            affiliate_tracking_url: affiliate_tracking_url,
                                            start_date: start_date,
                                            end_date: end_date,
                                            deal_source: 'FMTC',
                                            last_updated: last_updated,
                                            source_couponID: source_couponID
                                        },
                                        true
                                    );
                                console.log("over_ride", resultUpdate[0].over_ride);
                                noOfUPDATECols = 0;
                                var sqlQ2 = "UPDATE merchant_deal_detail SET ";
                                if (over_ride.indexOf('name') == -1) {
                                    noOfUPDATECols++;
                                    sqlQ2 += " name = :name,";
                                }
                                if (over_ride.indexOf('description') == -1) {
                                    noOfUPDATECols++;
                                    sqlQ2 += " description= :description ,";
                                }
                                if (over_ride.indexOf('code') == -1) {
                                    noOfUPDATECols++;
                                    sqlQ2 += " code= :code ";
                                }
                                if (over_ride.indexOf('display_url') == -1) {
                                    noOfUPDATECols++;
                                    sqlQ2 += " display_url = :db_display_url ,";
                                }
                                if (over_ride.indexOf('restriction') == -1) {
                                    noOfUPDATECols++;
                                    sqlQ2 += " restriction = :restriction ,";
                                }
                                if (over_ride.indexOf('created') == -1) {
                                    noOfUPDATECols++;
                                    sqlQ2 += " created=current_timestamp(),";
                                }
                                sqlQ2 += " source_lastupdated=TIMESTAMP( :last_updated )";
                                sqlQ2 += " where deal_source = :deal_source "
                                    + " AND source_lastupdated < TIMESTAMP( :last_updated ) AND source_couponID = :source_couponID ";
                                sqlQ2 = sqlQ2.trim(",");
                                if (noOfUPDATECols > 0)
                                    mysql.query(sqlQ2, {
                                            name: name,
                                            description: description,
                                            code: code,
                                            db_display_url: db_display_url,
                                            restriction: restriction,
                                            deal_source: 'FMTC',
                                            last_updated: last_updated,
                                            source_couponID: source_couponID
                                        },
                                        true
                                    );

                            }

                        }


                    }


                }

                if (deal_insert && deal_insert.length > 0 && deal_insert[0][0]) {

                    var temparray=[],chunk = 5000, step=0;
                    for ( var x=0, k=deal_insert.length; x < k; x+=chunk) {
                        step++;
                        temparray[step] = deal_insert.slice(x,x+chunk);
                        // do whatever
                        connection.query({
                            sql: 'Insert into merchant_deal (merchant_id, unique_hash, affiliate_id,affiliate_tracking_url, start_date, end_date,source_lastupdated, deal_source, source_couponID) VALUES ?',
                            values: [temparray[step]]
                        });
                    }

                }

                if (deal_detail_insert && deal_detail_insert.length > 0 && db_merchantID) {

                    while (true) {
                        var deal_count = yield mysql.query(
                            'select count(*) as insert_count from merchant_deal Where merchant_id = :merchant_id and deal_source = "FMTC"   ', {
                                merchant_id: db_merchantID
                            }, true
                        );                 //   if (i === 3) { break; }

                        var deal_detail_count = yield mysql.query(
                            'select count(*) as insert_count from merchant_deal_detail mdd join merchant_deal md on md.id=mdd.deal_id Where md.merchant_id =  :merchant_id and md.deal_source = "FMTC"  ', {
                                merchant_id: db_merchantID
                            }, true
                        );
                        if (deal_count[0].insert_count == deal_detail_count[0].insert_count + deal_detail_insert.length ) {
                            break;
                        }
                    }
                }


                if (deal_detail_insert && deal_detail_insert.length > 0 ) {

                    for (var dd = 0; dd < deal_detail_insert.length; dd++) {
                        var ddId = yield mysql.query(
                            'select id from merchant_deal Where source_couponID =  :source_couponID ', {
                                source_couponID: deal_detail_insert[dd][12]
                            },
                            true
                        );
                        deal_detail_insert[dd][0] = ddId[0].id;
                    }

                    temparray=[];
                    chunk = 5000;
                    step=0;

                    if(deal_detail_insert.length> 5000){
                        for (var t=0, p=deal_detail_insert.length; t < p; t+=chunk) {
                            step++;
                            temparray[step] = deal_detail_insert.slice(t,t+chunk);
                            // do whatever

                            connection.query({
                                sql: 'Insert into merchant_deal_detail (deal_id,lang,region,name,description,display_url,code,restriction,reviewed,active,source_lastupdated,deal_source,source_couponID) VALUES ?',
                                values: [temparray[step]]
                            });
                        }
                    }
                    else{

                        var deal_insert_query= connection.query({
                            sql: 'Insert into merchant_deal_detail (deal_id,lang,region,name,description,display_url,code,restriction,reviewed,active,source_lastupdated,deal_source,source_couponID) VALUES ?',
                            values: [deal_detail_insert]
                        });
                    }



                }


                connection.query(
                    ' update merchant_deal set source_lastupdated=TIMESTAMP(source_lastupdated) where deal_source="FMTC"',
                    true
                );

                connection.query(
                    ' update merchant_deal_detail set source_lastupdated=TIMESTAMP(source_lastupdated) where deal_source="FMTC" ',
                    true
                );


            }
        }
    }


    process.exit(0);
    connection.end();

}
