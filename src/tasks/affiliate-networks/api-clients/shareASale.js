"use strict";
process.env.TZ = 'UTC'; // TODO; how can we ensure node is always running in UTC - server as well ofcourse.

/*
 * API Documentation: https://account.shareasale.com/a-apimanager.cfm
 * Documentation requires valid account credentials.
 *
 * !!! NOTE !!!
 * Currently the Account is setup to allow only 200 !!! API requests per *MONTHS* !
 */

const _ = require('lodash');
const co = require('co');
const request = require('request-promise');
const debug = require('debug')('shareasale:api-client');
const limiter = require('ominto-utils').promiseRateLimiter;
const crypto = require('crypto');
const jsonify = require('./jsonify-xml-body');
const moment = require('moment');
const ary = x => _.isArray(x) ? x : [x];

const API_CFG = {
  url: 'https://api.shareasale.com/x.cfm',
  // api request rate limiter - used to be based on making 200 req/mo (ie 7/day),
  // but we're just much more careful about how often we call it now rather than
  //  having this pause for 3.5 hours (ugh). still limit it somewhat though.
  limit: {req:1440, sec: 86400}, 
  ominto: {
    token: 'bUqdXM4gsQgiU5h2',
    secret: 'RVz8ts7d7PLcpc6wMMo4es0y0TQqkv1i',
    siteId: 1107596, // Site Id / Affiliate Id
  },
  dubli: {
    token: 'Sl1P6gT6qInPLy6T',
    secret: 'TAc3lx1p5GCfze1nCQm7kn0a5BMkqk1g',
    siteId: 775483,
  }
};

// XMLFormat:1
const API_TYPES = {
  merchantDataFeeds: {
    params: {
      version: '2.0',
      action: 'merchantDataFeeds',
      blnMemberOf: 1, // Pass in blnMemberOf=1 to view only merchants whose programs you are a member of. Default is 1.
    }
  },
  couponDeals: {
    params: {
      version: '2.0',
      action: 'couponDeals',
      current: 1, // Add current=1 to view only current deals. Default is 0
      // Valid date for which deals are filtered by date added or date edited
      modifiedSince: moment(new Date(Date.now() - (30 * 86400 * 1000))).format('MM/DD/YYYY'), // 08/25/2015
    }
  },
  merchantStatus: {
    params: {
      version: '2.0',
      action: 'merchantStatus',
      programStatus: 'online',
    }
  },
  activity: {
    params: {
      version: '2.0',
      action: 'activity',

      // mm/dd/yyyy - Valid date in which you would like the result set to start.
      // **If no dateEnd is included, the result set will be for 30 days from dateStart.
      dateStart: new Date(Date.now() - (30 * 86400 * 1000)),

      // mm/dd/yyyy - Valid date in which you would like the result set to end.
      // *dateEND must be within 90 days of dateStart.
      // **If no dateEnd is included, the result set will be for 30 days from dateStart.
      dateEnd: new Date(Date.now() - (60 * 1000)),
    }
  },
  ledger: {
    params: {
      version: '2.0',
      action: 'ledger',
      // mm/dd/yyyy - Valid date in which you would like the result set to start. ** default is 30 days before dateend;
      // If neither start or end date is passed the most recent 30 days of ledger activity will be returned.
      // The maximum range allowed between the start and end date is 90 days.
      dateStart: new Date(Date.now() - (30 * 86400 * 1000)),

      // mm/dd/yyyy - Valid date in which you would like the result set to end. ** default is the current date;
      // If neither start or end date is passed the most recent 30 days of ledger activity will be returned.
      // The maximum range allowed between the start and end date is 90 days
      dateEnd: new Date(Date.now() - (60 * 1000)),

      // 0 or 1 - If the specified API version is 1.8 or higher, passing includeOrderDetails=1 will append
      // the columns orderimpact and ordernumber.
      includeOrderDetails: 1,

      //  0 or 1 - If the specified API version is 1.8 or higher, passing includeMerchantDetails=1 will append
      // the columns merchantorganization, merchantwww, storename, and storewww.
      includeMerchantDetails: 1,
    }
  }
};

/**
 * New Class ShareASaleClient
 * @class
 */
function ShareASaleClient(s_entity) {
  if (!(this instanceof ShareASaleClient)) return new ShareASaleClient(s_entity);
  if (!s_entity) throw new Error("Missing required argument 's_entity'!");
  if (!API_CFG[s_entity]) throw new Error("Entity '"+s_entity+"' is not defined in API_CFG.");
  debug("Create new client for entity: %s", s_entity);

  this.cfg = API_CFG[s_entity];

	// default request options
	this.client = request.defaults({
    uri: API_CFG.url,
    json: false,
    simple: true,
    resolveWithFullResponse: false,
    qs: {
      affiliateId: this.cfg.siteId,
      token: this.cfg.token,
      XMLFormat: 1
    },
    headers: {}
  });

  limiter.request(this.client, API_CFG.limit.req, API_CFG.limit.sec).debug(debug);

  /**
   * Function to create the custom authentification header for Share A Sale API requests.
   * @param {String} actionVerb - the name of the API report/action we want to perform a request on
   * @returns {Object{x-ShareASale-Date:string, x-ShareASale-Authentication:string}}
   */
  this.getCustomHeaders = function(actionVerb) {
    let timestamp = moment(new Date()).format('ddd, DD MMM YYYY HH:mm:ss') + ' GMT';  // "Thu, 14 Apr 2011 22:44:22 GMT"
    let signature = this.cfg.token + ':' +
        timestamp + ':' +
        actionVerb + ':' +
        this.cfg.secret;

    let signatureHash = crypto.createHash('sha256').update(signature).digest('hex');

    const headers = {
      'x-ShareASale-Date': timestamp,
      'x-ShareASale-Authentication': signatureHash
    };
    debug('getCustomHeaders for %s: %o', actionVerb, headers);
    return headers;
  };
}

/**
 * Generic API client function.
 * @memberof ShareASaleClient
 * @param {String} actionVerb - The "action" to call on the API. One of the defined API_TYPES. Example: "merchantDataFeeds" or "ledger",..
 * @param {Object} params - Optional params to pass onto the api call
 * @returns {Object}  Returns promise
 */
ShareASaleClient.prototype.getByAction = co.wrap(function* (actionVerb, params) {
  params = params || {};
  debug('getByAction %s with params %o', actionVerb, params);
  const apiCfg = API_TYPES[actionVerb];
	let arg = {
    headers: this.getCustomHeaders(apiCfg.params.action),
    qs: _.merge(apiCfg.params, params),
  };

  let response = {};

  if (process.env.NODE_ENV === 'Adev') {
    // for testing we do not perform live api requests - too low request limit
    response = yield devApiResponse(actionVerb).then(jsonify);
  } else {
    // LIVE API request
    response = yield this.client.get(arg).then(jsonify);
  }

	return response;
});

/**
 * For DEV only! mocks a api response.
 * @param {String} actionVerb
 * @returns {Object} returns a promise
 */
var devApiResponse = co.wrap(function* (actionVerb) {
  // for testing - live API has very low limit of requests per months! Careful!
  let testResponse = '';

  switch(actionVerb) {
    case 'merchantDataFeeds':
      testResponse = '<?xml version="1.0" encoding="UTF-8"?><datafeedlistreport xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.shareasale.com/XMLSchema/api/affiliate/2/schema.xsd"><datafeedlistreportrecord><merchantid>48382</merchantid><merchant>Steiner Sports</merchant><applystatus>Approved</applystatus><ftpstatus>0</ftpstatus><numberofproducts>12806</numberofproducts><lastupdated>08/31/2015</lastupdated></datafeedlistreportrecord><datafeedlistreportrecord><merchantid>47467</merchantid><merchant>Balsam Hill</merchant><applystatus>Approved</applystatus><ftpstatus>0</ftpstatus><numberofproducts>946</numberofproducts><lastupdated>08/31/2015</lastupdated></datafeedlistreportrecord><datafeedlistreportrecord><merchantid>50605</merchantid><merchant>WonderSlim.com</merchant><applystatus>Approved</applystatus><ftpstatus>0</ftpstatus><numberofproducts>106</numberofproducts><lastupdated>09/01/2015</lastupdated></datafeedlistreportrecord></datafeedlistreport>';
      break;
    case 'couponDeals':
      testResponse = '<?xml version="1.0" encoding="UTF-8"?><dealcouponlistreport xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.shareasale.com/XMLSchema/api/affiliate/2/schema.xsd"><dealcouponlistreportrecord><dealid>296344</dealid><merchantid>32431</merchantid><merchant>DealExtreme</merchant><startdate>2015-09-01 00:00:00.0</startdate><enddate>2015-09-30 00:00:00.0</enddate><publishdate>2015-08-27 03:28:50.587</publishdate><title>Exlusive 5% off for smart warable devices!</title><bigimage>http://</bigimage><trackingurl>http://www.shareasale.com/u.cfm?d=296344&amp;m=32431&amp;u=775483</trackingurl><smallimage>http://</smallimage><category></category><description>Live a smarter and more meaningful life!</description><restrictions></restrictions><keywords></keywords><couponcode>DXSEP01</couponcode><editdate>2015-09-01 04:31:20.633</editdate><storeid>0</storeid></dealcouponlistreportrecord><dealcouponlistreportrecord><dealid>296346</dealid><merchantid>32431</merchantid><merchant>DealExtreme</merchant><startdate>2015-09-01 00:00:00.0</startdate><enddate>2015-09-30 00:00:00.0</enddate><publishdate>2015-08-27 03:33:05.8</publishdate><title>Exlusive 5% off for mouting accessories!</title><bigimage>http://</bigimage><trackingurl>http://www.shareasale.com/u.cfm?d=296346&amp;m=32431&amp;u=775483</trackingurl><smallimage>http://</smallimage><category></category><description>Bring you more fun and convenience!</description><restrictions></restrictions><keywords></keywords><couponcode>DXSEP02</couponcode><editdate>2015-09-01 04:31:06.86</editdate><storeid>0</storeid></dealcouponlistreportrecord><dealcouponlistreportrecord><dealid>296349</dealid><merchantid>32431</merchantid><merchant>DealExtreme</merchant><startdate>2015-09-01 00:00:00.0</startdate><enddate>2015-09-30 00:00:00.0</enddate><publishdate>2015-08-27 03:35:20.517</publishdate><title>Exlusive 5% off for forscrew drivers!</title><bigimage>http://</bigimage><trackingurl>http://www.shareasale.com/u.cfm?d=296349&amp;m=32431&amp;u=775483</trackingurl><smallimage>http://</smallimage><category></category><description>No need?You will regret when you need them!</description><restrictions></restrictions><keywords></keywords><couponcode>DXSEP04</couponcode><editdate>2015-09-01 04:30:50.677</editdate><storeid>0</storeid></dealcouponlistreportrecord><dealcouponlistreportrecord><dealid>296351</dealid><merchantid>32431</merchantid><merchant>DealExtreme</merchant><startdate>2015-09-01 00:00:00.0</startdate><enddate>2015-09-30 00:00:00.0</enddate><publishdate>2015-08-27 03:37:02.633</publishdate><title>Exlusive 5% off for bubls&amp;strips!</title><bigimage>http://</bigimage><trackingurl>http://www.shareasale.com/u.cfm?d=296351&amp;m=32431&amp;u=775483</trackingurl><smallimage>http://</smallimage><category></category><description>Brighten your life with your beloved family!</description><restrictions></restrictions><keywords></keywords><couponcode>DXSEP05</couponcode><editdate>2015-09-01 04:30:28.757</editdate><storeid>0</storeid></dealcouponlistreportrecord><dealcouponlistreportrecord><dealid>296347</dealid><merchantid>32431</merchantid><merchant>DealExtreme</merchant><startdate>2015-09-01 00:00:00.0</startdate><enddate>2015-09-30 00:00:00.0</enddate><publishdate>2015-08-27 03:34:10.13</publishdate><title>Exlusive 5% off for bluetooth speakers!</title><bigimage>http://</bigimage><trackingurl>http://www.shareasale.com/u.cfm?d=296347&amp;m=32431&amp;u=775483</trackingurl><smallimage>http://</smallimage><category></category><description>The fantastic sound will surprise you!</description><restrictions></restrictions><keywords></keywords><couponcode>DXSEP03</couponcode><editdate>2015-09-01 04:30:18.877</editdate><storeid>0</storeid></dealcouponlistreportrecord><dealcouponlistreportrecord><dealid>296943</dealid><merchantid>32431</merchantid><merchant>DealExtreme</merchant><startdate>2015-08-31 00:00:00.0</startdate><enddate>2015-09-03 00:00:00.0</enddate><publishdate>2015-08-31 23:13:47.54</publishdate><title>Extra 50% OFF 5W LED Bulb, $2.5 Only</title><bigimage>http://img.dxcdn.com/productimages/sku_ 276606_1.jpg</bigimage><trackingurl>http://www.shareasale.com/u.cfm?d=296943&amp;m=32431&amp;u=775483</trackingurl><smallimage>http://img.dxcdn.com/productimages/sku_ 276606_1_small.jpg</smallimage><category>Lights &amp; Lighting </category><description>Extra 50% OFF 5W LED Bulb, $2.5 Only  (SKU 276606) + Free Shipping</description><restrictions></restrictions><keywords>50% OFF,  LED Bulb, Free Shipping</keywords><couponcode>Automatical Coupon</couponcode><editdate>2015-09-01 01:36:49.247</editdate><storeid>0</storeid></dealcouponlistreportrecord><dealcouponlistreportrecord><dealid>296935</dealid><merchantid>32431</merchantid><merchant>DealExtreme</merchant><startdate>2015-08-31 00:00:00.0</startdate><enddate>2015-09-03 00:00:00.0</enddate><publishdate>2015-08-31 22:59:28.177</publishdate><title>Extra 50% OFF Vido 7.0&amp;quot; Dual Core 3G Tablet,  $ 47.84 Only! </title><bigimage>http://img.dxcdn.com/productimages/sku_257388_1.jpg</bigimage><trackingurl>http://www.shareasale.com/u.cfm?d=296935&amp;m=32431&amp;u=775483</trackingurl><smallimage>http://img.dxcdn.com/productimages/sku_257388_1_small.jpg</smallimage><category>Alarm &amp; Protection</category><description>Extra 50% OFF Vido 7.0&amp;quot; Dual Core 3G Tablet,  $ 47.84 Only! (SKU257388) + Free Shipping</description><restrictions></restrictions><keywords>Vido Tablet, 50% Off</keywords><couponcode>Automatical Coupon</couponcode><editdate>2015-09-01 01:13:04.08</editdate><storeid>0</storeid></dealcouponlistreportrecord><dealcouponlistreportrecord><dealid>296929</dealid><merchantid>32431</merchantid><merchant>DealExtreme</merchant><startdate>2015-08-31 00:00:00.0</startdate><enddate>2015-10-31 00:00:00.0</enddate><publishdate>2015-08-31 22:17:55.027</publishdate><title>DX 10 years anniversary blow-out sales Extra 50% OFF. Last for 2 Monthes</title><bigimage>http://</bigimage><trackingurl>http://www.shareasale.com/u.cfm?d=296929&amp;m=32431&amp;u=775483</trackingurl><smallimage>http://</smallimage><category>10 years anniversary</category><description>DX 10 years anniversary celebration: Opening day sales 50% OFF(9.1-9.3),  5 to 20 dollars off!(9.6-9.14), 1.99$ (9.14-9.22), 10% for 2 items;15% for 3 items, 20% for 4 items(9.22-9.29), and more. Please stay tuned.</description><restrictions></restrictions><keywords>50% OFF, 10 years anniversary, 20 dollars off, Free Shipping</keywords><couponcode>Automatical Coupon</couponcode><editdate>2015-08-31 23:49:19.707</editdate><storeid>0</storeid></dealcouponlistreportrecord><dealcouponlistreportrecord><dealid>296963</dealid><merchantid>32431</merchantid><merchant>DealExtreme</merchant><startdate>2015-08-31 00:00:00.0</startdate><enddate>2015-09-03 00:00:00.0</enddate><publishdate>2015-08-31 23:45:30.44</publishdate><title>Extra 50% OFF PANNOVO 6-in1 Gopro Car Set Kit $10.16 Only</title><bigimage>http://img.dxcdn.com/productimages/sku_362927_1.jpg</bigimage><trackingurl>http://www.shareasale.com/u.cfm?d=296963&amp;m=32431&amp;u=775483</trackingurl><smallimage>http://img.dxcdn.com/productimages/sku_362927_1_small.jpg</smallimage><category>Cameras, Photo &amp; Video </category><description>Extra 50% OFF PANNOVO 6-in1 Gopro Car Set Kit $10.16 Only (SKU362927) + Free Shipping</description><restrictions></restrictions><keywords>50% OFF, Gopro, Free Shipping</keywords><couponcode>Automatical Coupon</couponcode><editdate>2015-08-31 23:45:30.44</editdate><storeid>0</storeid></dealcouponlistreportrecord><dealcouponlistreportrecord><dealid>296955</dealid><merchantid>32431</merchantid><merchant>DealExtreme</merchant><startdate>2015-08-31 00:00:00.0</startdate><enddate>2015-09-03 00:00:00.0</enddate><publishdate>2015-08-31 23:31:43.847</publishdate><title>Extra 50% OFF Z2 MTK6592 5.0&amp;quot; Octa-Core Phone, 78.94 only</title><bigimage>http://img.dxcdn.com/productimages/sku_312843_1.jpg</bigimage><trackingurl>http://www.shareasale.com/u.cfm?d=296955&amp;m=32431&amp;u=775483</trackingurl><smallimage>http://img.dxcdn.com/productimages/sku_312843_1_small.jpg</smallimage><category>Cell Phone</category><description>Extra 50% OFF Z2 MTK6592 5.0&amp;quot; Octa-Core Phone, 78.94 only  (SKU312843) + Free Shipping</description><restrictions></restrictions><keywords>50% OFF, Z2 Phone, Free Shipping</keywords><couponcode>Automatical Coupon</couponcode><editdate>2015-08-31 23:31:43.847</editdate><storeid>0</storeid></dealcouponlistreportrecord><dealcouponlistreportrecord><dealid>296953</dealid><merchantid>32431</merchantid><merchant>DealExtreme</merchant><startdate>2015-08-31 00:00:00.0</startdate><enddate>2015-09-03 00:00:00.0</enddate><publishdate>2015-08-31 23:30:45.607</publishdate><title>Extra 50% OFF Utime G7  4.5&amp;quot; Octa-Core Phone, $47.78 only</title><bigimage>http://img.dxcdn.com/productimages/sku_284528_1.jpg</bigimage><trackingurl>http://www.shareasale.com/u.cfm?d=296953&amp;m=32431&amp;u=775483</trackingurl><smallimage>http://img.dxcdn.com/productimages/sku_284528_1_small.jpg</smallimage><category>Cell Phone</category><description>Extra 50% OFF Utime G7  4.5&amp;quot; Octa-Core Phone, $47.78 only  (SKU284528) + Free Shipping</description><restrictions></restrictions><keywords>50% OFF, Z2 Phone, Free Shipping</keywords><couponcode>Automatical Coupon</couponcode><editdate>2015-08-31 23:30:45.607</editdate><storeid>0</storeid></dealcouponlistreportrecord><dealcouponlistreportrecord><dealid>296951</dealid><merchantid>32431</merchantid><merchant>DealExtreme</merchant><startdate>2015-08-31 00:00:00.0</startdate><enddate>2015-09-03 00:00:00.0</enddate><publishdate>2015-08-31 23:28:43.767</publishdate><title>Extra 50% OFF DOOGEE DG350 4.7&amp;quot; Octa-Core Phone, $56.48 only</title><bigimage>http://img.dxcdn.com/productimages/sku_307212_1.jpg</bigimage><trackingurl>http://www.shareasale.com/u.cfm?d=296951&amp;m=32431&amp;u=775483</trackingurl><smallimage>http://img.dxcdn.com/productimages/sku_307212_1_small.jpg</smallimage><category>Cell Phone</category><description>Extra 50% OFF DOOGEE DG350 4.7&amp;quot; Octa-Core Phone, $56.48 only  (SKU307212) + Free Shipping</description><restrictions></restrictions><keywords>50% OFF, DOOGEE Phone, Free Shipping</keywords><couponcode>Automatical Coupon</couponcode><editdate>2015-08-31 23:28:43.767</editdate><storeid>0</storeid></dealcouponlistreportrecord><dealcouponlistreportrecord><dealid>296944</dealid><merchantid>32431</merchantid><merchant>DealExtreme</merchant><startdate>2015-08-31 00:00:00.0</startdate><enddate>2015-09-03 00:00:00.0</enddate><publishdate>2015-08-31 23:15:16.663</publishdate><title>Extra 50% OFF MINIX NEO Z64 Windows 8.1 Mini PC, $79.95 Only!</title><bigimage>http://img.dxcdn.com/productimages/sku_374047_1.jpg</bigimage><trackingurl>http://www.shareasale.com/u.cfm?d=296944&amp;m=32431&amp;u=775483</trackingurl><smallimage>http://img.dxcdn.com/productimages/sku_374047_1_small.jpg</smallimage><category>Mini PC</category><description>Extra 50% OF MINIX NEO Z64 Windows 8.1 Mini PC, $79.95 Only  (SKU374047) + Free Shipping</description><restrictions></restrictions><keywords>50% OFF, MINIX NEO Z64, Free Shipping</keywords><couponcode>Automatical Coupon</couponcode><editdate>2015-08-31 23:15:16.663</editdate><storeid>0</storeid></dealcouponlistreportrecord><dealcouponlistreportrecord><dealid>296936</dealid><merchantid>32431</merchantid><merchant>DealExtreme</merchant><startdate>2015-08-31 00:00:00.0</startdate><enddate>2015-09-03 00:00:00.0</enddate><publishdate>2015-08-31 23:01:45.647</publishdate><title>Extra 50% OFF Amkov SJ50001HD WFi Sports Camera, $42.84 Only</title><bigimage>http://img.dxcdn.com/productimages/sku_339611_1.jpg</bigimage><trackingurl>http://www.shareasale.com/u.cfm?d=296936&amp;m=32431&amp;u=775483</trackingurl><smallimage>http://img.dxcdn.com/productimages/sku_339611_1_small.jpg</smallimage><category> Cameras, Photo &amp; Video </category><description>Extra 50% OFF Amkov SJ50001080P HD WFi Sports Camera, $42.84 Only  (SKU339611) + Free Shipping</description><restrictions></restrictions><keywords>Amkov SJ5000 Camera, 50% OFF, Free Shipping</keywords><couponcode>Automatical Coupon</couponcode><editdate>2015-08-31 23:01:45.647</editdate><storeid>0</storeid></dealcouponlistreportrecord><dealcouponlistreportrecord><dealid>276164</dealid><merchantid>47467</merchantid><merchant>Balsam Hill</merchant><startdate>2015-07-01 00:00:00.0</startdate><enddate>2015-09-30 00:00:00.0</enddate><publishdate>2015-06-29 08:35:13.94</publishdate><title>NEW! 10% off Wreaths and Garlands</title><bigimage>http://</bigimage><trackingurl>http://www.shareasale.com/u.cfm?d=276164&amp;m=47467&amp;u=775483</trackingurl><smallimage>http://</smallimage><category>Coupons</category><description>Receive 10% off Wreaths and Garlands (excluding clearance). Use Coupon Code BHSAS10OFF. Expires 9/30/2015.</description><restrictions></restrictions><keywords>coupon artificial christmas xmas tree trees classics prelit pre lit LED</keywords><couponcode>BHSAS10OFF</couponcode><editdate>2015-08-31 20:34:39.917</editdate><storeid>0</storeid></dealcouponlistreportrecord><dealcouponlistreportrecord><dealid>276163</dealid><merchantid>47467</merchantid><merchant>Balsam Hill</merchant><startdate>2015-07-01 00:00:00.0</startdate><enddate>2015-09-30 00:00:00.0</enddate><publishdate>2015-06-29 08:29:17.35</publishdate><title>NEW! $95 off orders $1299 or more</title><bigimage>http://</bigimage><trackingurl>http://www.shareasale.com/u.cfm?d=276163&amp;m=47467&amp;u=775483</trackingurl><smallimage>http://</smallimage><category>Coupons</category><description>Receive $95 off orders $1299 or more (excluding clearance). Use Coupon Code BH95OFFSAS. Expires 9/30/2015.</description><restrictions></restrictions><keywords>coupon artificial christmas xmas tree trees classics prelit pre lit LED</keywords><couponcode>BH95OFFSAS</couponcode><editdate>2015-08-31 20:33:29.78</editdate><storeid>0</storeid></dealcouponlistreportrecord><dealcouponlistreportrecord><dealid>276162</dealid><merchantid>47467</merchantid><merchant>Balsam Hill</merchant><startdate>2015-07-01 00:00:00.0</startdate><enddate>2015-09-30 00:00:00.0</enddate><publishdate>2015-06-29 08:26:30.73</publishdate><title>NEW! $75 off orders $899 or more</title><bigimage>http://</bigimage><trackingurl>http://www.shareasale.com/u.cfm?d=276162&amp;m=47467&amp;u=775483</trackingurl><smallimage>http://</smallimage><category>Coupons</category><description>Receive $75 off orders $899 or more (excluding clearance). Use Coupon Code BHSAS75OFFA. Expires 9/30/2015.</description><restrictions></restrictions><keywords>coupon artificial christmas xmas tree trees classics prelit pre lit LED</keywords><couponcode>BHSAS75OFFA</couponcode><editdate>2015-08-31 20:32:22.027</editdate><storeid>0</storeid></dealcouponlistreportrecord><dealcouponlistreportrecord><dealid>276161</dealid><merchantid>47467</merchantid><merchant>Balsam Hill</merchant><startdate>2015-07-01 00:00:00.0</startdate><enddate>2015-09-30 00:00:00.0</enddate><publishdate>2015-06-29 08:24:02.8</publishdate><title>NEW! $55 off orders $699 or more</title><bigimage>http://</bigimage><trackingurl>http://www.shareasale.com/u.cfm?d=276161&amp;m=47467&amp;u=775483</trackingurl><smallimage>http://</smallimage><category>Coupons</category><description>Receive $55 off orders $699 or more (excluding clearance). Use Coupon Code BHSAS55OFF. Expires 9/30/2015.</description><restrictions></restrictions><keywords>coupon artificial christmas xmas tree trees classics prelit pre lit LED</keywords><couponcode>BHSAS55OFF</couponcode><editdate>2015-08-31 20:31:38.94</editdate><storeid>0</storeid></dealcouponlistreportrecord></dealcouponlistreport>';
      break;
    case 'merchantStatus':
      testResponse = '<?xml version="1.0" encoding="UTF-8"?><merchantstatusreport xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.shareasale.com/XMLSchema/api/affiliate/2/schema.xsd"><merchantstatusreportrecord><merchantid>47467</merchantid><merchant>Balsam Hill</merchant><www>www.balsamhill.com/</www><programstatus>Online</programstatus><programcategory>Home &amp; Garden</programcategory><salecomm>2%</salecomm><leadcomm></leadcomm><hitcomm></hitcomm><approved>Yes</approved><linkurl>http://www.shareasale.com/r.cfm?b=482167&amp;u=775483&amp;m=47467</linkurl><storenames></storenames><storeids></storeids><storewwws></storewwws><storesalecomms></storesalecomms><storelinkurls></storelinkurls><rulecommissiondate>2015-06-11 05:19:24</rulecommissiondate><conversionlinedate></conversionlinedate></merchantstatusreportrecord><merchantstatusreportrecord><merchantid>21381</merchantid><merchant>Barcelo Hotels </merchant><www>scripts.affilired.com/?adnid=0002&amp;t=&amp;url=www.barcelo.com</www><programstatus>Online</programstatus><programcategory>tvl,rec</programcategory><salecomm>6%</salecomm><leadcomm></leadcomm><hitcomm></hitcomm><approved>Yes</approved><linkurl>http://www.shareasale.com/r.cfm?b=165833&amp;u=775483&amp;m=21381</linkurl><storenames></storenames><storeids></storeids><storewwws></storewwws><storesalecomms></storesalecomms><storelinkurls></storelinkurls><rulecommissiondate></rulecommissiondate><conversionlinedate></conversionlinedate></merchantstatusreportrecord><merchantstatusreportrecord><merchantid>47844</merchantid><merchant>Cherishables.com by Saturn Greetings</merchant><www>www.cherishables.com</www><programstatus>Online</programstatus><programcategory>Gifts</programcategory><salecomm>10%</salecomm><leadcomm></leadcomm><hitcomm></hitcomm><approved>Yes</approved><linkurl>http://www.shareasale.com/r.cfm?b=488821&amp;u=775483&amp;m=47844</linkurl><storenames></storenames><storeids></storeids><storewwws></storewwws><storesalecomms></storesalecomms><storelinkurls></storelinkurls><rulecommissiondate>2014-11-11 16:07:01</rulecommissiondate><conversionlinedate></conversionlinedate></merchantstatusreportrecord><merchantstatusreportrecord><merchantid>32431</merchantid><merchant>DealExtreme</merchant><www>dx.com</www><programstatus>Online</programstatus><programcategory>Computers/Electronics</programcategory><salecomm>5%</salecomm><leadcomm></leadcomm><hitcomm></hitcomm><approved>Yes</approved><linkurl>http://www.shareasale.com/r.cfm?b=302497&amp;u=775483&amp;m=32431</linkurl><storenames></storenames><storeids></storeids><storewwws></storewwws><storesalecomms></storesalecomms><storelinkurls></storelinkurls><rulecommissiondate>2013-10-11 11:11:24</rulecommissiondate><conversionlinedate></conversionlinedate></merchantstatusreportrecord><merchantstatusreportrecord><merchantid>55776</merchantid><merchant>Experts Exchange</merchant><www>www.experts-exchange.com</www><programstatus>Online</programstatus><programcategory>Computers/Electronics</programcategory><salecomm>$15</salecomm><leadcomm>$0.83</leadcomm><hitcomm></hitcomm><approved>Yes</approved><linkurl>http://www.shareasale.com/r.cfm?b=658693&amp;u=775483&amp;m=55776</linkurl><storenames></storenames><storeids></storeids><storewwws></storewwws><storesalecomms></storesalecomms><storelinkurls></storelinkurls><rulecommissiondate></rulecommissiondate><conversionlinedate></conversionlinedate></merchantstatusreportrecord><merchantstatusreportrecord><merchantid>7124</merchantid><merchant>Fanatics.com</merchant><www>www.fanatics.com/partnerid/2465/source/share-a-sale</www><programstatus>Online</programstatus><programcategory>Sports/Fitness</programcategory><salecomm>10%</salecomm><leadcomm></leadcomm><hitcomm></hitcomm><approved>Yes</approved><linkurl>http://www.shareasale.com/r.cfm?b=31196&amp;u=775483&amp;m=7124</linkurl><storenames></storenames><storeids></storeids><storewwws></storewwws><storesalecomms></storesalecomms><storelinkurls></storelinkurls><rulecommissiondate>2013-08-14 14:37:07</rulecommissiondate><conversionlinedate></conversionlinedate></merchantstatusreportrecord><merchantstatusreportrecord><merchantid>45646</merchantid><merchant>FansEdge</merchant><www>www.fansedge.com/source/afffe12-sas</www><programstatus>Online</programstatus><programcategory>Sports/Fitness</programcategory><salecomm>5.00%</salecomm><leadcomm></leadcomm><hitcomm></hitcomm><approved>Yes</approved><linkurl>http://www.shareasale.com/r.cfm?b=452676&amp;u=775483&amp;m=45646</linkurl><storenames></storenames><storeids></storeids><storewwws></storewwws><storesalecomms></storesalecomms><storelinkurls></storelinkurls><rulecommissiondate>2013-08-12 10:57:36</rulecommissiondate><conversionlinedate></conversionlinedate></merchantstatusreportrecord></merchantstatusreport>';
      break;
    case 'activity':
      testResponse = '<?xml version="1.0" encoding="UTF-8"?><activitydetailsreport xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.shareasale.com/XMLSchema/api/affiliate/2/schema.xsd"><activitydetailsreportrecord><transid>66201788</transid><userid>775483</userid><merchantid>7124</merchantid><transdate>08/30/2015 10:05:36 PM</transdate><transamount>24.65</transamount><commission>1.23</commission><comment>Sale - 21-2465-2148422483</comment><voided></voided><pendingdate></pendingdate><locked></locked><affcomment>TCTf-20briX</affcomment><bannerpage>http://us.mall.dubli.com/fwd/retailer?fwdUrl=%23&amp;retailer_id=3713</bannerpage><reversaldate></reversaldate><clickdate>2015-08-30 00:00:00.0</clickdate><clicktime>10:02:31 PM</clicktime><bannerid>34150</bannerid><skulist>2005471</skulist><quantitylist>1</quantitylist><lockdate>2015-09-20</lockdate><paiddate></paiddate><merchantorganization>Fanatics.com</merchantorganization><merchantwebsite>www.fanatics.com/partnerid/2465/source/share-a-sale</merchantwebsite></activitydetailsreportrecord><activitydetailsreportrecord><transid>66204755</transid><userid>775483</userid><merchantid>7124</merchantid><transdate>08/30/2015 11:25:36 PM</transdate><transamount>24.65</transamount><commission>1.23</commission><comment>Sale - 21-2465-2148424368</comment><voided></voided><pendingdate></pendingdate><locked></locked><affcomment>TCTf-20bwtX</affcomment><bannerpage>http://us.mall.dubli.com/fwd/retailer/nologin/0/retailer_id/3713</bannerpage><reversaldate></reversaldate><clickdate>2015-08-30 00:00:00.0</clickdate><clicktime>11:22:49 PM</clicktime><bannerid>34150</bannerid><skulist>2005471</skulist><quantitylist>1</quantitylist><lockdate>2015-09-20</lockdate><paiddate></paiddate><merchantorganization>Fanatics.com</merchantorganization><merchantwebsite>www.fanatics.com/partnerid/2465/source/share-a-sale</merchantwebsite></activitydetailsreportrecord><activitydetailsreportrecord><transid>01234567</transid><userid>775483</userid><merchantid>9999</merchantid><transdate>08/15/2015 11:59:59 PM</transdate><transamount>12.34</transamount><commission>1.23</commission><comment>Sale - 21-1234-123456789132</comment><voided></voided><pendingdate></pendingdate><locked></locked><affcomment>TCTf-123456</affcomment><bannerpage>http://de.mall.dubli.com/</bannerpage><reversaldate></reversaldate><clickdate>2015-08-15 00:00:00.0</clickdate><clicktime>11:59:59 PM</clicktime><bannerid>66666</bannerid><skulist>900900900</skulist><quantitylist>1</quantitylist><lockdate>2015-09-15</lockdate><paiddate></paiddate><merchantorganization>TEST.com</merchantorganization><merchantwebsite>www.example.com</merchantwebsite></activitydetailsreportrecord></activitydetailsreport>';
      break;
    case 'ledger':
      testResponse = '<?xml version="1.0" encoding="UTF-8"?><ledger xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.shareasale.com/XMLSchema/api/affiliate/2/schema.xsd"><ledgerrecord><ledgerid>T-66204755</ledgerid><dt>2015-08-30 23:25:36.0</dt><action>Transaction Created</action><transid>66204755</transid><transtype>Sale</transtype><impact>1.23</impact><afftrack>TCTf-20bwtX</afftrack><comment>Sale - 21-2465-2148424368</comment><merchantid>7124</merchantid><storeid></storeid><orderimpact>24.65</orderimpact><ordernumber>21-2465-2148424368</ordernumber><merchantorganization>Fanatics.com</merchantorganization><merchantwww>www.fanatics.com/partnerid/2465/source/share-a-sale</merchantwww><storename></storename><storewww></storewww></ledgerrecord><ledgerrecord><ledgerid>T-66201788</ledgerid><dt>2015-08-30 22:05:36.0</dt><action>Transaction Created</action><transid>66201788</transid><transtype>Sale</transtype><impact>1.23</impact><afftrack>TCTf-20briX</afftrack><comment>Sale - 21-2465-2148422483</comment><merchantid>7124</merchantid><storeid></storeid><orderimpact>24.65</orderimpact><ordernumber>21-2465-2148422483</ordernumber><merchantorganization>Fanatics.com</merchantorganization><merchantwww>www.fanatics.com/partnerid/2465/source/share-a-sale</merchantwww><storename></storename><storewww></storewww></ledgerrecord><ledgerrecord><ledgerid>T-66142020</ledgerid><dt>2015-08-28 22:35:13.0</dt><action>Transaction Created</action><transid>66142020</transid><transtype>Sale</transtype><impact>1.42</impact><afftrack>TCTf-205kpX</afftrack><comment>Sale - 21-2465-2148375026</comment><merchantid>7124</merchantid><storeid></storeid><orderimpact>28.45</orderimpact><ordernumber>21-2465-2148375026</ordernumber><merchantorganization>Fanatics.com</merchantorganization><merchantwww>www.fanatics.com/partnerid/2465/source/share-a-sale</merchantwww><storename></storename><storewww></storewww></ledgerrecord><ledgerrecord><ledgerid>T-66081534</ledgerid><dt>2015-08-27 10:04:54.0</dt><action>Transaction Created</action><transid>66081534</transid><transtype>Sale</transtype><impact>1.23</impact><afftrack>TCTf-200ofX</afftrack><comment>Sale - 21-2465-2148348470</comment><merchantid>7124</merchantid><storeid></storeid><orderimpact>24.65</orderimpact><ordernumber>21-2465-2148348470</ordernumber><merchantorganization>Fanatics.com</merchantorganization><merchantwww>www.fanatics.com/partnerid/2465/source/share-a-sale</merchantwww><storename></storename><storewww></storewww></ledgerrecord><ledgerrecord><ledgerid>T-66066606</ledgerid><dt>2015-08-26 20:28:11.0</dt><action>Transaction Created</action><transid>66066606</transid><transtype>Sale</transtype><impact>1.23</impact><afftrack>TCTf-1zyl7X</afftrack><comment>Sale - 21-2465-2148342239</comment><merchantid>7124</merchantid><storeid></storeid><orderimpact>24.65</orderimpact><ordernumber>21-2465-2148342239</ordernumber><merchantorganization>Fanatics.com</merchantorganization><merchantwww>www.fanatics.com/partnerid/2465/source/share-a-sale</merchantwww><storename></storename><storewww></storewww></ledgerrecord><ledgerrecord><ledgerid>T-66054927</ledgerid><dt>2015-08-26 14:40:05.0</dt><action>Transaction Created</action><transid>66054927</transid><transtype>Sale</transtype><impact>1.23</impact><afftrack>TCTf-1zxtyX</afftrack><comment>Sale - 21-2465-2148337198</comment><merchantid>7124</merchantid><storeid></storeid><orderimpact>24.65</orderimpact><ordernumber>21-2465-2148337198</ordernumber><merchantorganization>Fanatics.com</merchantorganization><merchantwww>www.fanatics.com/partnerid/2465/source/share-a-sale</merchantwww><storename></storename><storewww></storewww></ledgerrecord><ledgerrecord><ledgerid>T-65984342</ledgerid><dt>2015-08-24 19:45:00.0</dt><action>Transaction Created</action><transid>65984342</transid><transtype>Sale</transtype><impact>8.17</impact><afftrack>TCTf-1zonsX</afftrack><comment>Sale - 20-13670-2148365780</comment><merchantid>7124</merchantid><storeid></storeid><orderimpact>163.44</orderimpact><ordernumber>20-13670-2148365780</ordernumber><merchantorganization>Fanatics.com</merchantorganization><merchantwww>www.fanatics.com/partnerid/2465/source/share-a-sale</merchantwww><storename></storename><storewww></storewww></ledgerrecord><ledgerrecord><ledgerid>T-65966919</ledgerid><dt>2015-08-24 11:32:54.0</dt><action>Transaction Created</action><transid>65966919</transid><transtype>Sale</transtype><impact>1.23</impact><afftrack>TCTf-1zokxX</afftrack><comment>Sale - 20-2465-2148355723</comment><merchantid>7124</merchantid><storeid></storeid><orderimpact>24.65</orderimpact><ordernumber>20-2465-2148355723</ordernumber><merchantorganization>Fanatics.com</merchantorganization><merchantwww>www.fanatics.com/partnerid/2465/source/share-a-sale</merchantwww><storename></storename><storewww></storewww></ledgerrecord><ledgerrecord><ledgerid>T-65966505</ledgerid><dt>2015-08-24 11:21:09.0</dt><action>Transaction Created</action><transid>65966505</transid><transtype>Sale</transtype><impact>2.42</impact><afftrack>TCTf-1zoheX</afftrack><comment>Sale - 20-2465-2148355450</comment><merchantid>7124</merchantid><storeid></storeid><orderimpact>48.32</orderimpact><ordernumber>20-2465-2148355450</ordernumber><merchantorganization>Fanatics.com</merchantorganization><merchantwww>www.fanatics.com/partnerid/2465/source/share-a-sale</merchantwww><storename></storename><storewww></storewww></ledgerrecord><ledgerrecord><ledgerid>T-65942166</ledgerid><dt>2015-08-23 16:23:28.0</dt><action>Transaction Created</action><transid>65942166</transid><transtype>Sale</transtype><impact>1.23</impact><afftrack>TCTf-1zlueX</afftrack><comment>Sale - 20-2465-2148341551</comment><merchantid>7124</merchantid><storeid></storeid><orderimpact>24.65</orderimpact><ordernumber>20-2465-2148341551</ordernumber><merchantorganization>Fanatics.com</merchantorganization><merchantwww>www.fanatics.com/partnerid/2465/source/share-a-sale</merchantwww><storename></storename><storewww></storewww></ledgerrecord><ledgerrecord><ledgerid>T-65935933</ledgerid><dt>2015-08-23 12:48:09.0</dt><action>Transaction Created</action><transid>65935933</transid><transtype>Sale</transtype><impact>1.23</impact><afftrack>TCTf-1zlawX</afftrack><comment>Sale - 20-2465-2148337243</comment><merchantid>7124</merchantid><storeid></storeid><orderimpact>24.65</orderimpact><ordernumber>20-2465-2148337243</ordernumber><merchantorganization>Fanatics.com</merchantorganization><merchantwww>www.fanatics.com/partnerid/2465/source/share-a-sale</merchantwww><storename></storename><storewww></storewww></ledgerrecord><ledgerrecord><ledgerid>T-65839218</ledgerid><dt>2015-08-20 11:19:49.0</dt><action>Transaction Created</action><transid>65839218</transid><transtype>Sale</transtype><impact>1.23</impact><afftrack>TCTf-1zbnjX</afftrack><comment>Sale - 20-2465-2148286547</comment><merchantid>7124</merchantid><storeid></storeid><orderimpact>24.65</orderimpact><ordernumber>20-2465-2148286547</ordernumber><merchantorganization>Fanatics.com</merchantorganization><merchantwww>www.fanatics.com/partnerid/2465/source/share-a-sale</merchantwww><storename></storename><storewww></storewww></ledgerrecord><ledgerrecord><ledgerid>T-65828811</ledgerid><dt>2015-08-20 02:15:00.0</dt><action>Payment</action><transid>65828811</transid><transtype>Affiliate Payment</transtype><impact>-182.66</impact><afftrack></afftrack><comment>Payment 7/1 - 7/31 Commissions - ACH Deposit Sent August 20</comment><merchantid>47</merchantid><storeid></storeid><orderimpact>0</orderimpact><ordernumber></ordernumber><merchantorganization>shareasale.com</merchantorganization><merchantwww>www.shareasale.com</merchantwww><storename></storename><storewww></storewww></ledgerrecord></ledger>';
      break;
  }

  return yield Promise.resolve(testResponse);
});

/**
 * Function alias.
 * @memberof ShareASaleClient
 */
ShareASaleClient.prototype.getMerchants = (params) => {
  debug('running getMerchants with %o', params);
  return this.getByAction('merchantDataFeeds', params)
    .then(data => data.datafeedlistreport.datafeedlistreportrecord)
    .then(data => {
      if (!data) return [];
      return ary(data);
    })
  ;
};

/**
 * Function alias.
 * @memberof ShareASaleClient
 */
ShareASaleClient.prototype.getDeals = (params) => {
  debug('running getDeals with %o', params);
  return this.getByAction('couponDeals', params)
    .then(data => data.dealcouponlistreport.dealcouponlistreportrecord)
    .then(data => {
      if (!data) return [];
      return ary(data);
    })
  ;
};

/**
 * Function alias.
 * @memberof ShareASaleClient
 */
ShareASaleClient.prototype.getMerchantStatus = (params) => {
  debug('running getMerchantStatus with %o', params);
  return this.getByAction('merchantStatus', params)
    .then(data => data.merchantstatusreport.merchantstatusreportrecord)
    .then(data => {
      if (!data) return [];
      return ary(data);
    })
  ;
};

/**
 * Function alias.
 * @memberof ShareASaleClient
 * @param {Object} params   - Params object
 * @param {Date} params.dateStart   - Date start filter
 * @param {Date} params.dateEnd   - Date end filter
 */
ShareASaleClient.prototype.getActivityDetails = (params) => {
  debug('running getActivityDetails with %o', params);

  // ensure we have some dates to work with
  params = params || {};
  params.dateStart = params.dateStart ? params.dateStart : API_TYPES.activity.params.dateStart;
  params.dateEnd = params.dateEnd ? params.dateEnd : API_TYPES.activity.params.dateEnd;
  // format dates to API expected format
  params.dateStart = moment(params.dateStart).format('MM/DD/YYYY');
  params.dateEnd = moment(params.dateEnd).format('MM/DD/YYYY');

  return this.getByAction('activity', params)
    .then(data => data.activitydetailsreport.activitydetailsreportrecord)
    .then(data => {
      if (!data) return [];
      return ary(data);
    })
  ;
};

/**
 * Function alias.
 * @memberof ShareASaleClient
 * @param {Object} params   - Params object
 * @param {Date} params.dateStart   - Date start filter
 * @param {Date} params.dateEnd   - Date end filter
 */
ShareASaleClient.prototype.getLedgerReport = (params) => {
  debug('running getLedgerReport with %o', params);

  // ensure we have some dates to work with
  params = params || {};
  params.dateStart = params.dateStart ? params.dateStart : API_TYPES.ledger.params.dateStart;
  params.dateEnd = params.dateEnd ? params.dateEnd : API_TYPES.ledger.params.dateEnd;
  // format dates to API expected format
  params.dateStart = moment(params.dateStart).format('MM/DD/YYYY');
  params.dateEnd = moment(params.dateEnd).format('MM/DD/YYYY');

  return this.getByAction('ledger', params)
    .then(data => data.ledger.ledgerrecord)
    .then(data => {
      if (!data) return [];
      return ary(data);
    })
  ;
};

module.exports = ShareASaleClient;
