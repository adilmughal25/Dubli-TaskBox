"use strict";

module.exports = { init: init };

const amazonApi = require('./amazonApi');
const clixGaloreApi = require("./clixGaloreApi");
const impactRadiusProductFtp = require("./impactRadiusProductFtp");
const lomadeeApi = require('./lomadeeApi');
const tradedoublerApi = require('./tradedoublerApi');
const zanoxApi = require('./zanoxApi');

const adCellGenericApi = require('./adCellGenericApi');
const adCellApi = adCellGenericApi();
const adCellDubliApi = adCellGenericApi('dubli');

const admitadGenericApi = require('./admitadGenericApi');
const admitadApi = admitadGenericApi();
const admitadDubliApi = admitadGenericApi('dubli');

const affiliateGatewayGenericApi = require('./affiliateGatewayGenericApi');
const affiliateGatewayAsiaApi = affiliateGatewayGenericApi('asia');
const affiliateGatewaySgApi = affiliateGatewayGenericApi('sg');

const affiliatewindowGenericApi = require('./affiliatewindowGenericApi');
const affiliatewindowApi = affiliatewindowGenericApi();
const affiliatewindowDubliApi = affiliatewindowGenericApi('dubli');

const affilinetGenericApi = require('./affilinetGenericApi');
const affilinetAustriaApi = affilinetGenericApi('at');
const affilinetFranceApi = affilinetGenericApi('fr');
const affilinetGermanyApi = affilinetGenericApi('de');
const affilinetNetherlandsApi = affilinetGenericApi('nl');
const affilinetSpainApi = affilinetGenericApi('es');
const affilinetSwitzerlandApi = affilinetGenericApi('ch');
const affilinetUKApi = affilinetGenericApi('uk');
const affilinetDubliDEApi = affilinetGenericApi('de', 'dubli');
const affilinetDubliESApi = affilinetGenericApi('es', 'dubli');
const affilinetDubliUKApi = affilinetGenericApi('uk', 'dubli');
const affilinetDubliATApi = affilinetGenericApi('at', 'dubli');
const affilinetDubliCHApi = affilinetGenericApi('ch', 'dubli');

const avantLinkGenericApi = require('./avantLinkGenericApi');
const avantLinkCAApi = avantLinkGenericApi('ca');
const avantLinkUSApi = avantLinkGenericApi('us');
const avantLinkDubliCAApi = avantLinkGenericApi('ca', 'dubli');
const avantLinkDubliUSApi = avantLinkGenericApi('us', 'dubli');

const belboonGenericApi = require('./belboonGenericApi');
const belboonApi = belboonGenericApi();
const belboonDubliApi = belboonGenericApi('dubli');

const commissionfactoryGenericApi = require('./commissionfactoryGenericApi');
const commissionfactoryApi = commissionfactoryGenericApi();
const commissionfactoryDubliApi = commissionfactoryGenericApi('dubli');

const commissionJunctionGenericApi = require('./commissionJunctionGenericApi');
const commissionJunctionUSApi = commissionJunctionGenericApi('us');
const commissionJunctionEUApi = commissionJunctionGenericApi('eu');
const commissionJunctionDubliUSApi = commissionJunctionGenericApi('us', 'dubli');
const commissionJunctionDubliDEApi = commissionJunctionGenericApi('de', 'dubli');
const commissionJunctionDubliESApi = commissionJunctionGenericApi('es', 'dubli');
const commissionJunctionDubliGBApi = commissionJunctionGenericApi('gb', 'dubli');
const commissionJunctionDubliDKApi = commissionJunctionGenericApi('dk', 'dubli');
const commissionJunctionDubliITApi = commissionJunctionGenericApi('it', 'dubli');

const flipkartGenericApi = require('./flipkartGenericApi');
const flipkartApi = flipkartGenericApi();
const flipkartDubliApi = flipkartGenericApi('dubli');

const grouponGenericApi = require('./grouponGenericApi');
const grouponUSApi = grouponGenericApi('us'); //TODO: how about a/the EU account for Ominto?
const grouponDubliUSApi = grouponGenericApi('us', 'dubli');
const grouponDubliEUApi = grouponGenericApi('eu', 'dubli');

const impactRadiusGenericApi = require('./impactRadiusGenericApi');
const apdPerformanceApi = impactRadiusGenericApi('apdperformance');
const impactRadiusApi = impactRadiusGenericApi('impactradius');
const impactRadiusDubliUSApi = impactRadiusGenericApi('impactradius', 'us', 'dubli');
const impactRadiusDubliCAApi = impactRadiusGenericApi('impactradius', 'ca', 'dubli');
const dgmDubliAUApi = impactRadiusGenericApi('dgm', 'au', 'dubli');

const hasoffersGenericApi = require('./hasoffersGenericApi');
const snapdealApi = hasoffersGenericApi('snapdeal');
const vcommissionApi = hasoffersGenericApi('vcommission');
const shopstylers = hasoffersGenericApi('shopstylers');
const vcommissionDubliApi = hasoffersGenericApi('vcommission', 'dubli');
const bestsellerDubliApi = hasoffersGenericApi('bestseller', 'dubli');

const linkShareGenericApi = require("./linkShareGenericApi");
const linkShareApi = linkShareGenericApi();
const linkShareDubliUSApi = linkShareGenericApi('us', 'dubli');
const linkShareDubliCAApi = linkShareGenericApi('ca', 'dubli');
const linkShareDubliGBApi = linkShareGenericApi('gb', 'dubli');

const omgpmGenericApi = require('./omgpmGenericApi');
const omgpmIndiaApi = omgpmGenericApi('india');
const omgpmUKApi = omgpmGenericApi('uk');
const omgpmAsiaApi = omgpmGenericApi('asia');
const omgpmBrazilApi = omgpmGenericApi('brazil');
const omgpmAustraliaApi = omgpmGenericApi('australia');

const partnerAdsGenericApi = require('./partnerAdsGenericApi');
const partnerAdsApi = partnerAdsGenericApi();
const partnerAdsDubliApi = partnerAdsGenericApi('dubli');
const pepperjamGenericApi = require('./pepperjamGenericApi');
const pepperjamApi = pepperjamGenericApi();
const pepperjamDubliApi = pepperjamGenericApi('dubli');
const performanceHorizonGenericApi = require('./performanceHorizonGenericApi');
const performanceHorizonApi = performanceHorizonGenericApi();
const performanceHorizonDubliAppleApi = performanceHorizonGenericApi('dubli_apple');
const performanceHorizonDubliItunesApi = performanceHorizonGenericApi('dubli_itunes');
const performanceHorizonDubliBAApi = performanceHorizonGenericApi('dubli_ba');
const performanceHorizonDubliWWApi = performanceHorizonGenericApi('dubli_ww');
const publicideasGenericApi = require('./publicideasGenericApi');
const publicideasESApi = publicideasGenericApi('es');
const publicideasFRApi = publicideasGenericApi('fr');
const publicideasITApi = publicideasGenericApi('it');
const publicideasLATAMApi = publicideasGenericApi('latam');
const publicideasUKApi = publicideasGenericApi('uk');

const shareASaleGenericApi = require('./shareASaleGenericApi');
const shareASaleApi = shareASaleGenericApi();
const shareASaleDubliApi = shareASaleGenericApi('dubli');

const tradetrackerGenericApi = require('./tradetrackerGenericApi');
const tradetrackerATApi = tradetrackerGenericApi('at');
const tradetrackerBEApi = tradetrackerGenericApi('be');
const tradetrackerCHApi = tradetrackerGenericApi('ch');
const tradetrackerCZApi = tradetrackerGenericApi('cz');
const tradetrackerDEApi = tradetrackerGenericApi('de');
const tradetrackerDKApi = tradetrackerGenericApi('dk');
const tradetrackerESApi = tradetrackerGenericApi('es');
const tradetrackerFIApi = tradetrackerGenericApi('fi');
const tradetrackerFRApi = tradetrackerGenericApi('fr');
const tradetrackerGBApi = tradetrackerGenericApi('gb');
const tradetrackerITApi = tradetrackerGenericApi('it');
const tradetrackerNLApi = tradetrackerGenericApi('nl');
const tradetrackerNOApi = tradetrackerGenericApi('no');
const tradetrackerRUApi = tradetrackerGenericApi('ru');
const tradetrackerSEApi = tradetrackerGenericApi('se');
const tradetrackerDubliCHApi = tradetrackerGenericApi('ch', 'dubli');
const tradetrackerDubliDEApi = tradetrackerGenericApi('de', 'dubli');
const tradetrackerDubliDKApi = tradetrackerGenericApi('dk', 'dubli');
const tradetrackerDubliATApi = tradetrackerGenericApi('at', 'dubli');
const tradetrackerDubliRUApi = tradetrackerGenericApi('ru', 'dubli');

const webgainsGenericApi = require('./webgainsGenericApi');
const webgainsApi = webgainsGenericApi();
const webgainsDubliDEApi = webgainsGenericApi('dubli-de');
const webgainsDubliDKApi = webgainsGenericApi('dubli-dk');
const webgainsDubliESApi = webgainsGenericApi('dubli-es');
const webgainsDubliGBApi = webgainsGenericApi('dubli-gb');
const webgainsDubliITApi = webgainsGenericApi('dubli-it');

/*
 * some thoughts by Rando:
 *
 *   The 24 Hour cycle for merchants and 6 hour cycle for commissions that most
 *   of these tasks stick to is arbitrary and only an optimistic best attempt at
 *   running without too stupid of a delay before things show up in our system.
 *
 *   If a network can't handle that much, just use the main createTask() function
 *   to set up a regular cron-type schedule.
 *
 *   The createGroup() function is just for convenience, to sprinkle a bunch of
 *   tasks around an X-hour period in a shuffled yet deterministic and consistent
 *   order, but they were written quickly and off-hand just to keep me from having
 *   to try to manually manage task cron timings :)
 */

function init(createTask) {
  initializeMerchantImporters(createTask);
  initializeCommissionsProcessors(createTask);

  initializeCommissionsDubliProcessors(createTask);
}

function initializeMerchantImporters(createTask) {
  // run each of these every 24 hours
  createTask.createGroup(24, {
    "APD Performance Merchants": apdPerformanceApi.getMerchants,
    "AdCell Merchants": adCellApi.getMerchants,
    "Admitad Merchants": admitadApi.getMerchants,
    "Affili.Net (Austria) Merchants": affilinetAustriaApi.getMerchants,
    "Affili.Net (France) Merchants": affilinetFranceApi.getMerchants,
    "Affili.Net (Germany) Merchants": affilinetGermanyApi.getMerchants,
    "Affili.Net (Netherlands) Merchants": affilinetNetherlandsApi.getMerchants,
    "Affili.Net (Spain) Merchants": affilinetSpainApi.getMerchants,
    "Affili.Net (Switzerland) Merchants": affilinetSwitzerlandApi.getMerchants,
    "Affili.Net (UK) Merchants": affilinetUKApi.getMerchants,
    "AffiliateWindow Merchants": affiliatewindowApi.getMerchants,
    "AvantLink (CA) Merchants": avantLinkCAApi.getMerchants,
    "AvantLink (US) Merchants": avantLinkUSApi.getMerchants,
    "Belboon Merchants": belboonApi.getMerchants,
    "CommissionJunction (EU) Merchants": commissionJunctionEUApi.getMerchants,
    "CommissionJunction (US) Merchants": commissionJunctionUSApi.getMerchants,
    // "ClixGalore Merchants": clixGaloreApi.getMerchants,
    "CommissionFactory Merchants": commissionfactoryApi.getMerchants,
    "ImpactRadius Merchants": impactRadiusApi.getMerchants,
    "LinkShare Merchants": linkShareApi.getMerchants,
    "Lomadee Merchants": lomadeeApi.getMerchants,
    "OMG (India) Merchants": omgpmIndiaApi.getMerchants,
    "OMG (UK) Merchants": omgpmUKApi.getMerchants,
    "OMG (Asia) Merchants": omgpmAsiaApi.getMerchants,
    "OMG (Brazil) Merchants": omgpmBrazilApi.getMerchants,
    "OMG (Australia) Merchants": omgpmAustraliaApi.getMerchants,
    "PartnerAds Merchants": partnerAdsApi.getMerchants,
    "PepperJam Merchants": pepperjamApi.getMerchants,
    "PerformanceHorizon Merchants": performanceHorizonApi.getMerchants,
    "PublicIdeas (ES) Merchants": publicideasESApi.getMerchants,
    "PublicIdeas (FR) Merchants": publicideasFRApi.getMerchants,
    "PublicIdeas (IT) Merchants": publicideasITApi.getMerchants,
    "PublicIdeas (LATAM) Merchants": publicideasLATAMApi.getMerchants,
    "PublicIdeas (UK) Merchants": publicideasUKApi.getMerchants,
    "ShopStylers Merchants": shopstylers.getMerchants,
    "SnapDeal Merchants": snapdealApi.getMerchants,
    "TradeDoubler Merchants": tradedoublerApi.getMerchants,
    "TradeTracker (AT) Merchants": tradetrackerATApi.getMerchants,
    "TradeTracker (BE) Merchants": tradetrackerBEApi.getMerchants,
    "TradeTracker (CH) Merchants": tradetrackerCHApi.getMerchants,
    "TradeTracker (CZ) Merchants": tradetrackerCZApi.getMerchants,
    "TradeTracker (DE) Merchants": tradetrackerDEApi.getMerchants,
    "TradeTracker (DK) Merchants": tradetrackerDKApi.getMerchants,
    "TradeTracker (ES) Merchants": tradetrackerESApi.getMerchants,
    "TradeTracker (FI) Merchants": tradetrackerFIApi.getMerchants,
    "TradeTracker (FR) Merchants": tradetrackerFRApi.getMerchants,
    "TradeTracker (GB) Merchants": tradetrackerGBApi.getMerchants,
    "TradeTracker (IT) Merchants": tradetrackerITApi.getMerchants,
    "TradeTracker (NL) Merchants": tradetrackerNLApi.getMerchants,
    "TradeTracker (NO) Merchants": tradetrackerNOApi.getMerchants,
    "TradeTracker (RU) Merchants": tradetrackerRUApi.getMerchants,
    "TradeTracker (SE) Merchants": tradetrackerSEApi.getMerchants,
    "VCommission Merchants": vcommissionApi.getMerchants,
    "Webgains Merchants": webgainsApi.getMerchants,
    "Zanox Merchants": zanoxApi.getMerchants
  });

  // also temporarily hacked to be faster
  createTask('ShareASale Merchants', shareASaleApi.getMerchants, {/*hour:12, */minute:0 /*, dayOfWeek:0 */}); // every sunday at 12:00
}

function initializeCommissionsProcessors(createTask) {
  // run each of these every 6 hours
  createTask.createGroup(6, {
    "APD Performance Commissions": apdPerformanceApi.getCommissionDetails,
    "AdCell Commissions": adCellApi.getCommissionDetails,
    "Admitad Commissions": admitadApi.getCommissionDetails,
    "Affili.Net (Austria) Commissions": affilinetAustriaApi.getCommissionDetails,
    "Affili.Net (France) Commissions": affilinetFranceApi.getCommissionDetails,
    "Affili.Net (Germany) Commissions": affilinetGermanyApi.getCommissionDetails,
    "Affili.Net (Netherlands) Commissions": affilinetNetherlandsApi.getCommissionDetails,
    "Affili.Net (Spain) Commissions": affilinetSpainApi.getCommissionDetails,
    "Affili.Net (Switzerland) Commissions": affilinetSwitzerlandApi.getCommissionDetails,
    "Affili.Net (UK) Commissions": affilinetUKApi.getCommissionDetails,
    "Affiliate Gateway (Asia) Commissions": affiliateGatewayAsiaApi.getCommissionDetails,
    "Affiliate Gateway (SG) Commissions": affiliateGatewaySgApi.getCommissionDetails,
    "AffiliateWindow Commissions": affiliatewindowApi.getCommissionDetails,
    // "Amazon (IN) Commissions": amazonApi.getCommissionDetails, // problems w/ amazon.in
    "AvantLink (CA) Commissions": avantLinkCAApi.getCommissionDetails,
    "AvantLink (US) Commissions": avantLinkUSApi.getCommissionDetails,
    "Belboon Commissions": belboonApi.getCommissionDetails,
    "CommissionJunction (EU) Commissions": commissionJunctionEUApi.getCommissionDetails,
    "CommissionJunction (US) Commissions": commissionJunctionUSApi.getCommissionDetails,
    // "ClixGalore Commissions": clixGaloreApi.getCommissionDetails,
    "CommissionFactory Commissions": commissionfactoryApi.getCommissionDetails,
    "Flipkart Commissions": flipkartApi.getCommissionDetails,
    "Groupon (US) Commissions": grouponUSApi.getCommissionDetails,
    "ImpactRadius Commissions": impactRadiusApi.getCommissionDetails,
    "LinkShare Commissions": linkShareApi.getCommissionDetails,
    "Lomadee Commissions": lomadeeApi.getCommissionDetails,
    "OMG (India) Commissions": omgpmIndiaApi.getCommissionDetails,
    "OMG (UK) Commissions": omgpmUKApi.getCommissionDetails,
    "OMG (Asia) Commissions": omgpmAsiaApi.getCommissionDetails,
    "OMG (Brazil) Commissions": omgpmBrazilApi.getCommissionDetails,
    "OMG (Australia) Commissions": omgpmAustraliaApi.getCommissionDetails,
    "PartnerAds Commissions": partnerAdsApi.getCommissionDetails,
    "PepperJam Commissions": pepperjamApi.getCommissionDetails,
    "PerformanceHorizon Commissions": performanceHorizonApi.getCommissionDetails,
    // PI still has issues
    "PublicIdeas (ES) Commissions": publicideasESApi.getCommissionDetails,
    "PublicIdeas (FR) Commissions": publicideasFRApi.getCommissionDetails,
    "PublicIdeas (IT) Commissions": publicideasITApi.getCommissionDetails,
    "PublicIdeas (LATAM) Commissions": publicideasLATAMApi.getCommissionDetails,
    "PublicIdeas (UK) Commissions": publicideasUKApi.getCommissionDetails,
    "ShopStylers Commissions": shopstylers.getCommissionDetails,
    "SnapDeal Commissions": snapdealApi.getCommissionDetails,
    "TradeTracker (AT) Commissions": tradetrackerATApi.getCommissionDetails,
    "TradeTracker (BE) Commissions": tradetrackerBEApi.getCommissionDetails,
    "TradeTracker (CH) Commissions": tradetrackerCHApi.getCommissionDetails,
    "TradeTracker (CZ) Commissions": tradetrackerCZApi.getCommissionDetails,
    "TradeTracker (DE) Commissions": tradetrackerDEApi.getCommissionDetails,
    "TradeTracker (DK) Commissions": tradetrackerDKApi.getCommissionDetails,
    "TradeTracker (ES) Commissions": tradetrackerESApi.getCommissionDetails,
    "TradeTracker (FI) Commissions": tradetrackerFIApi.getCommissionDetails,
    "TradeTracker (FR) Commissions": tradetrackerFRApi.getCommissionDetails,
    "TradeTracker (GB) Commissions": tradetrackerGBApi.getCommissionDetails,
    "TradeTracker (IT) Commissions": tradetrackerITApi.getCommissionDetails,
    "TradeTracker (NL) Commissions": tradetrackerNLApi.getCommissionDetails,
    "TradeTracker (NO) Commissions": tradetrackerNOApi.getCommissionDetails,
    "TradeTracker (RU) Commissions": tradetrackerRUApi.getCommissionDetails,
    "TradeTracker (SE) Commissions": tradetrackerSEApi.getCommissionDetails,
    "VCommission Commissions": vcommissionApi.getCommissionDetails,
    "Webgains Commissions": webgainsApi.getCommissionDetails,
    "Zanox Commissions": zanoxApi.getCommissionDetails,
  });

  createTask('ShareASale Commissions', shareASaleApi.getCommissionDetails, {hour:12, minute:30});   // once a day at 12:30

  // disabled for now:
  //createTask("ImpactRadius Product FTP": impactRadiusProductFtp.getProducts, {minute:35});
}

function initializeCommissionsDubliProcessors(createTask) {
  // run each of these every 24 hours
  createTask.createGroup(24, {
    "AdCell DubLi Commissions": adCellDubliApi.getCommissionDetails,
    "Admitad DubLi Commissions": admitadDubliApi.getCommissionDetails,
    "Affili.Net DubLi (DE) Commissions": affilinetDubliDEApi.getCommissionDetails,
    "Affili.Net DubLi (ES) Commissions": affilinetDubliESApi.getCommissionDetails,
    "Affili.Net DubLi (UK) Commissions": affilinetDubliUKApi.getCommissionDetails,
    "Affili.Net DubLi (AT) Commissions": affilinetDubliATApi.getCommissionDetails,
    "Affili.Net DubLi (CH) Commissions": affilinetDubliCHApi.getCommissionDetails,
    "AffiliateWindow DubLi Commissions": affiliatewindowDubliApi.getCommissionDetails,
    "AvantLink DubLi (CA) Commissions": avantLinkDubliCAApi.getCommissionDetails,
    "AvantLink DubLi (US) Commissions": avantLinkDubliUSApi.getCommissionDetails,
    "Belboon DubLi Commissions": belboonDubliApi.getCommissionDetails,
    "BestSeller DubLi Commissions": bestsellerDubliApi.getCommissionDetails,
    "CommissionFactory DubLi Commissions": commissionfactoryDubliApi.getCommissionDetails,
    "CommissionJunction DubLi (US) Commissions": commissionJunctionDubliUSApi.getCommissionDetails,
    "CommissionJunction DubLi (DE) Commissions": commissionJunctionDubliDEApi.getCommissionDetails,
    "CommissionJunction DubLi (ES) Commissions": commissionJunctionDubliESApi.getCommissionDetails,
    "CommissionJunction DubLi (GB) Commissions": commissionJunctionDubliGBApi.getCommissionDetails,
    "CommissionJunction DubLi (DK) Commissions": commissionJunctionDubliDKApi.getCommissionDetails,
    "CommissionJunction DubLi (IT) Commissions": commissionJunctionDubliITApi.getCommissionDetails,
    "DGM DubLi (AU) Commissions": dgmDubliAUApi.getCommissionDetails,
    "Flipkart DubLi Commissions": flipkartDubliApi.getCommissionDetails,
    "Groupon DubLi (US) Commissions": grouponDubliUSApi.getCommissionDetails,
    "Groupon DubLi (EU) Commissions": grouponDubliEUApi.getCommissionDetails,
    "ImpactRadius DubLi (US) Commissions": impactRadiusDubliUSApi.getCommissionDetails,
    "ImpactRadius DubLi (CA) Commissions": impactRadiusDubliCAApi.getCommissionDetails,
    "LinkShare DubLi (US) Commissions": linkShareDubliUSApi.getCommissionDetails,
    "LinkShare DubLi (CA) Commissions": linkShareDubliCAApi.getCommissionDetails,
    "LinkShare DubLi (GB) Commissions": linkShareDubliGBApi.getCommissionDetails,
    "PartnerAds DubLi Commissions": partnerAdsDubliApi.getCommissionDetails,
    "PepperJam DubLi Commissions": pepperjamDubliApi.getCommissionDetails,
    "PerformanceHorizon DubLi-Apple Commissions": performanceHorizonDubliAppleApi.getCommissionDetails,
    "PerformanceHorizon DubLi-iTunes Commissions": performanceHorizonDubliItunesApi.getCommissionDetails,
    "PerformanceHorizon DubLi-BritishAirways Commissions": performanceHorizonDubliBAApi.getCommissionDetails,
    "PerformanceHorizon DubLi-WoolWorth Commissions": performanceHorizonDubliWWApi.getCommissionDetails,
    "ShareASale DubLi Commissions": shareASaleDubliApi.getCommissionDetails,
    "TradeTracker DubLi (CH) Commissions": tradetrackerDubliCHApi.getCommissionDetails,
    "TradeTracker DubLi (DE) Commissions": tradetrackerDubliDEApi.getCommissionDetails,
    "TradeTracker DubLi (DK) Commissions": tradetrackerDubliDKApi.getCommissionDetails,
    "TradeTracker DubLi (AT) Commissions": tradetrackerDubliATApi.getCommissionDetails,
    "TradeTracker DubLi (RU) Commissions": tradetrackerDubliRUApi.getCommissionDetails,
    "VCommission DubLi Commissions": vcommissionDubliApi.getCommissionDetails,
    "Webgains DubLi (DE) Commissions": webgainsDubliDEApi.getCommissionDetails,
    "Webgains DubLi (DK) Commissions": webgainsDubliDKApi.getCommissionDetails,
    "Webgains DubLi (ES) Commissions": webgainsDubliESApi.getCommissionDetails,
    "Webgains DubLi (GB) Commissions": webgainsDubliGBApi.getCommissionDetails,
    "Webgains DubLi (IT) Commissions": webgainsDubliITApi.getCommissionDetails,
  });
}
