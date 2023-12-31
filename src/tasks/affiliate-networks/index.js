"use strict";

module.exports = { init: init };
const clixGaloreApi = require("./clix-galore/tasks");
const impactRadiusProductFtp = require("./impact-radius/ftp-tasks");
//const lomadeeApi = require('./lomadee/tasks');

const adserviceGenericApi = require('./adservice/tasks');
const adserviceDenmarkApi = adserviceGenericApi('dk');
const adserviceSweedenkApi = adserviceGenericApi('se');
const adserviceFinlandApi = adserviceGenericApi('fi');
const adserviceNorwayApi = adserviceGenericApi('no');
const adserviceGermanyApi = adserviceGenericApi('de');

const aliexpressGenericApi = require('./aliexpress/tasks');
const aliexpressApi = aliexpressGenericApi();

const AmazonIndiaGenericApi = require('./amazon/tasks');
const amazonApi = AmazonIndiaGenericApi();

const tradedoublerGenericApi = require('./tradedoubler/tasks');
const tradedoublerApi = tradedoublerGenericApi();
const tradedoublerGermanyApi = tradedoublerGenericApi('de');
const tradedoublerAustriaApi = tradedoublerGenericApi('at');
const tradedoublerBelgiumApi = tradedoublerGenericApi('be');
const tradedoublerDenmarkApi = tradedoublerGenericApi('dk');
const tradedoublerFinnlandApi = tradedoublerGenericApi('fi');
const tradedoublerFranceApi = tradedoublerGenericApi('fr');
const tradedoublerIrelandApi = tradedoublerGenericApi('ie');
const tradedoublerItalyApi = tradedoublerGenericApi('it');
const tradedoublerLithuaniaApi = tradedoublerGenericApi('lt');
const tradedoublerNetherlandsApi = tradedoublerGenericApi('nl');
const tradedoublerNorwayApi = tradedoublerGenericApi('no');
const tradedoublerPolandApi = tradedoublerGenericApi('pl');
const tradedoublerPortugalApi = tradedoublerGenericApi('pt');
const tradedoublerRussiaApi = tradedoublerGenericApi('ru');
const tradedoublerSpainApi = tradedoublerGenericApi('es');
const tradedoublerSwedenApi = tradedoublerGenericApi('se');
const tradedoublerSwitzerlandApi = tradedoublerGenericApi('ch');
const tradedoublerEnglandApi = tradedoublerGenericApi('gb');
const tradedoublerBrazilApi = tradedoublerGenericApi('br');
const tradedoublerHongKongApi = tradedoublerGenericApi('hk');
const tradedoublerIndonesiaApi = tradedoublerGenericApi('id');
const tradedoublerMalaysiaApi = tradedoublerGenericApi('my');
const tradedoublerPhilippinesApi = tradedoublerGenericApi('ph');
const tradedoublerSingaporeApi = tradedoublerGenericApi('sg');
const tradedoublerThailandApi = tradedoublerGenericApi('th');
const tradedoublerAustraliaApi = tradedoublerGenericApi('au');
const tradedoublerNewZealandApi = tradedoublerGenericApi('nz');
const tradedoublerIndiaApi = tradedoublerGenericApi('in');
const tradedoublerFlyDubaiApi = tradedoublerGenericApi('flyDubai');

// const a8GenericApi = require('./a8/tasks');
// const a8Api = a8GenericApi();

const adCellGenericApi = require('./ad-cell/tasks');
const adCellApi = adCellGenericApi();
const adCellDubliApi = adCellGenericApi('dubli');

const admitadGenericApi = require('./admitad/tasks');
const admitadApi = admitadGenericApi();
const admitadDubliApi = admitadGenericApi('dubli');
const admitadDubliIndiaApi = admitadGenericApi('', 'in');

const affiliateGatewayGenericApi = require('./affiliate-gateway/tasks');
// const affiliateGatewayAsiaApi = affiliateGatewayGenericApi('asia');
// const affiliateGatewaySgApi = affiliateGatewayGenericApi('sg');

const affiliatewindowGenericApi = require('./affiliate-window/tasks');
const affiliatewindowApi = affiliatewindowGenericApi();
const affiliatewindowDubliApi = affiliatewindowGenericApi('dubli');

//const affilinetGenericApi = require('./affilinet/tasks');
// const affilinetAustriaApi = affilinetGenericApi('at');
// const affilinetFranceApi = affilinetGenericApi('fr');
// const affilinetGermanyApi = affilinetGenericApi('de');
// const affilinetNetherlandsApi = affilinetGenericApi('nl');
// const affilinetSpainApi = affilinetGenericApi('es');
// const affilinetSwitzerlandApi = affilinetGenericApi('ch');
// const affilinetUKApi = affilinetGenericApi('uk');
//const affilinetDubliDEApi = affilinetGenericApi('de', 'dubli');
// const affilinetDubliESApi = affilinetGenericApi('es', 'dubli');
// const affilinetDubliUKApi = affilinetGenericApi('uk', 'dubli');
// const affilinetDubliATApi = affilinetGenericApi('at', 'dubli');
// const affilinetDubliCHApi = affilinetGenericApi('ch', 'dubli');

const avantLinkGenericApi = require('./avantlink/tasks');
// const avantLinkCAApi = avantLinkGenericApi('ca');
const avantLinkUSApi = avantLinkGenericApi('us');
const avantLinkDubliCAApi = avantLinkGenericApi('ca', 'dubli');
const avantLinkDubliUSApi = avantLinkGenericApi('us', 'dubli');

const belboonGenericApi = require('./belboon/tasks');
const belboonApi = new belboonGenericApi();
const belboonDubliApi = new belboonGenericApi('dubli');

const commissionfactoryGenericApi = require('./commission-factory/tasks');
const commissionfactoryApi = commissionfactoryGenericApi();
const commissionfactoryDubliApi = commissionfactoryGenericApi('dubli');

const commissionJunctionGenericApi = require('./commission-junction/tasks');
const commissionJunctionUSApi = commissionJunctionGenericApi('us');
// const commissionJunctionEUApi = commissionJunctionGenericApi('eu');
const commissionJunctionDubliUSApi = commissionJunctionGenericApi('us', 'dubli');
const commissionJunctionDubliDEApi = commissionJunctionGenericApi('de', 'dubli');
const commissionJunctionDubliESApi = commissionJunctionGenericApi('es', 'dubli');
const commissionJunctionDubliGBApi = commissionJunctionGenericApi('gb', 'dubli');
const commissionJunctionDubliDKApi = commissionJunctionGenericApi('dk', 'dubli');
const commissionJunctionDubliITApi = commissionJunctionGenericApi('it', 'dubli');

const CJImportDealsAPI = require('./cj-import-deals/tasks');
const cjImportDeals = CJImportDealsAPI();

const flipkartGenericApi = require('./flipkart/tasks');
const flipkartApi = flipkartGenericApi();
const flipkartDubliApi = flipkartGenericApi('dubli');

const grouponGenericApi = require('./groupon/tasks');
const grouponUSApi = grouponGenericApi('us');
const grouponROWApi = grouponGenericApi('row');

const impactRadiusGenericApi = require('./impact-radius/tasks');
const apdPerformanceApi = impactRadiusGenericApi('apdperformance');
const impactRadiusApi = impactRadiusGenericApi('impactradius');
const impactRadiusDubliUSApi = impactRadiusGenericApi('impactradius', 'us', 'dubli');
const impactRadiusDubliCAApi = impactRadiusGenericApi('impactradius', 'ca', 'dubli');
const dgmDubliAUApi = impactRadiusGenericApi('dgm', 'au', 'dubli');

const hasoffersGenericApi = require('./hasoffers/tasks');
// const arabyadsApi = hasoffersGenericApi('arabyads');
// const vcommissionApi = hasoffersGenericApi('vcommission');
// const shopstylers = hasoffersGenericApi('shopstylers');
//const vcommissionDubliApi = hasoffersGenericApi('vcommission', 'dubli');

// const lazadaPhApi = hasoffersGenericApi('lazada-ph');
// const lazadaMyApi = hasoffersGenericApi('lazada-my');
// const lazadaSgApi = hasoffersGenericApi('lazada-sg');
// const lazadaThApi = hasoffersGenericApi('lazada-th');
// const lazadaVnApi = hasoffersGenericApi('lazada-vn');
// const lazadaIdApi = hasoffersGenericApi('lazada-id');

const linkPriceGenericApi = require('./linkprice/tasks');
const linkpriceApi = linkPriceGenericApi('linkprice');

// const lomadeeGenericApi = require('./lomadee/tasks');
// const lomadeeApi = lomadeeGenericApi('linkprice');

const linkShareGenericApi = require("./linkshare/tasks");
const linkShareApi = linkShareGenericApi();
const linkShareDubliCAApi = linkShareGenericApi('ca', 'dubli');
const linkShareDubliGBApi = linkShareGenericApi('gb', 'dubli');

const linkShareDubliFRApi = linkShareGenericApi('fr', 'dubli');
const linkShareDubliBRApi = linkShareGenericApi('br', 'dubli');
const linkShareDubliDEApi = linkShareGenericApi('de', 'dubli');
const linkShareDubliAUApi = linkShareGenericApi('au', 'dubli');


const omgpmGenericApi = require('./omgpm/tasks');
const omgpmIndiaApi = omgpmGenericApi('india');
// const omgpmUKApi = omgpmGenericApi('uk');
// const omgpmUKCommissionsApi = omgpmGenericApi('uk-c');
const omgpmAsiaApi = omgpmGenericApi('asia');
const omgpmBrazilApi = omgpmGenericApi('brazil');
const omgpmBrazilCommissionsApi = omgpmGenericApi('brazil-c');
// const omgpmAustraliaApi = omgpmGenericApi('australia');
const omgpmDubliIndiaApi = omgpmGenericApi('india', 'dubli');

const partnerAdsGenericApi = require('./partner-ads/tasks');
const partnerAdsApi = partnerAdsGenericApi();
const partnerAdsDubliApi = partnerAdsGenericApi('dubli');

const pepperjamGenericApi = require('./pepperjam/tasks');
const pepperjamApi = pepperjamGenericApi();
const pepperjamDubliApi = pepperjamGenericApi('dubli');

const performanceHorizonGenericApi = require('./performance-horizon/tasks');
const performanceHorizonApi = performanceHorizonGenericApi();
const performanceHorizonDubliAppleApi = performanceHorizonGenericApi('dubli_apple');
const performanceHorizonDubliItunesApi = performanceHorizonGenericApi('dubli_itunes');
const performanceHorizonDubliBAApi = performanceHorizonGenericApi('dubli_ba');
const performanceHorizonDubliWWApi = performanceHorizonGenericApi('dubli_ww');

// const publicideasGenericApi = require('./publicideas/tasks');
// const publicideasESApi = publicideasGenericApi('es');
// const publicideasFRApi = publicideasGenericApi('fr');
// const publicideasITApi = publicideasGenericApi('it');
// const publicideasLATAMApi = publicideasGenericApi('latam');
// const publicideasUKApi = publicideasGenericApi('uk');

const shareASaleGenericApi = require('./share-a-sale/tasks');
const shareASaleApi = shareASaleGenericApi();
const shareASaleDubliApi = shareASaleGenericApi('dubli');


//const fanGenericApi = require('./fan/tasks');
//const fanApi = fanGenericApi('fan');

// const jumiaGenericApi = require('./jumia/tasks');
// const jumiaApi = jumiaGenericApi('jumia');

const JumiaSheetGenericApi = require('./jumiaSheet/tasks');
const JumiaSheetApi = JumiaSheetGenericApi('jumiaSheet');


// const snapdealGenericApi = require('./snapdeal/tasks');
// const snapdealApi = snapdealGenericApi();

const tradetrackerGenericApi = require('./tradetracker/tasks');
const tradetrackerAEApi = tradetrackerGenericApi('ae');
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
const tradetrackerMXApi = tradetrackerGenericApi('mx');
const tradetrackerNLApi = tradetrackerGenericApi('nl');
const tradetrackerNOApi = tradetrackerGenericApi('no');
const tradetrackerPLApi = tradetrackerGenericApi('pl');
const tradetrackerRUApi = tradetrackerGenericApi('ru');
const tradetrackerSEApi = tradetrackerGenericApi('se');
const tradetrackerBRApi = tradetrackerGenericApi('br');
const tradetrackerINApi = tradetrackerGenericApi('in');
const tradetrackerDubliCHApi = tradetrackerGenericApi('ch', 'dubli');
const tradetrackerDubliDEApi = tradetrackerGenericApi('de', 'dubli');
const tradetrackerDubliDKApi = tradetrackerGenericApi('dk', 'dubli');
const tradetrackerDubliATApi = tradetrackerGenericApi('at', 'dubli');
const tradetrackerDubliRUApi = tradetrackerGenericApi('ru', 'dubli');

const webgainsGenericApi = require('./webgains/tasks');
const webgainsApi = webgainsGenericApi();

// const zanoxGenericApi = require('./zanox/tasks');
// const zanoxApi = zanoxGenericApi();
// const zanoxDubliDEApi = zanoxGenericApi('de', 'dubli');
// const zanoxDubliESApi = zanoxGenericApi('es', 'dubli');
// const zanoxDubliAUApi = zanoxGenericApi('au', 'dubli');
// const zanoxDubliDKApi = zanoxGenericApi('dk', 'dubli');
// const zanoxDubliSEApi = zanoxGenericApi('se', 'dubli');
// const zanoxDubliNOApi = zanoxGenericApi('no', 'dubli');
// const zanoxDubliGlobalApi = zanoxGenericApi('global', 'dubli');
//const shooglooGenericApi = require('./shoogloo/tasks');
//const shooglooApi = shooglooGenericApi('shoogloo');
const addReferralPropertiesApi = require('./user-referrals/tasks');
const userReferralApi = addReferralPropertiesApi();
const pricelineApi = require('./priceline/tasks')();
const adtractionGenericApi = require('./adtraction/tasks');
const adtractionApi = adtractionGenericApi();

function init(tasker) {
  initializeMerchantImporters(tasker);
  initializeCommissionsProcessors(tasker);
  // disabling dubli commission processors [11/7/2016]
  // initializeCommissionsDubliProcessors(tasker);
  intializeUserReferrals(tasker);
  initializeNotificationProcessor(tasker);
  initializeCommissionsProcessorsDaily(tasker);
  initializeAvantlinkMerchantProcessor(tasker);
}

function initializeAvantlinkMerchantProcessor(tasker) {
  tasker.createGroup('3d +/- 1d', {
    "AvantLink (US) Merchants": avantLinkUSApi.getMerchants
  });
}

function initializeCommissionsProcessorsDaily(tasker) {
  // run each of these every 24 hours
  tasker.createGroup('2d +/- 1d', {
    "AvantLink (US) Commissions": avantLinkUSApi.getCommissionDetails,
    "AvantLink DubLi (US) Commissions": avantLinkDubliUSApi.getCommissionDetails
  });
}

function initializeNotificationProcessor(tasker) {
  tasker.createTask('Taskbox Notifications', '2d +/- 1d', require('./notification').generateP);
}

function initializeMerchantImporters(tasker) {
  // run each of these every 24 hours

  tasker.createGroup('2d +/- 1d', {
    "Adservice(dk) Merchants": adserviceDenmarkApi.getMerchants,
    "Adservice(se) Merchants": adserviceSweedenkApi.getMerchants,
    "Adservice(fi) Merchants": adserviceFinlandApi.getMerchants,
    "Adservice(no) Merchants": adserviceNorwayApi.getMerchants,
    "Adservice(de) Merchants": adserviceGermanyApi.getMerchants,

    "APD Performance Merchants": apdPerformanceApi.getMerchants,
    "AdCell Merchants": adCellApi.getMerchants,
    "Admitad Merchants": admitadApi.getMerchants,
    "Admitad India Merchants": admitadDubliIndiaApi.getMerchants,
    "Adtraction Merchants": adtractionApi.getMerchants,
    // "Affili.Net (Austria) Merchants": affilinetAustriaApi.getMerchants,
    // "Affili.Net (France) Merchants": affilinetFranceApi.getMerchants,
    // "Affili.Net (Germany) Merchants": affilinetGermanyApi.getMerchants,
    // "Affili.Net (Netherlands) Merchants": affilinetNetherlandsApi.getMerchants,
    // "Affili.Net (Spain) Merchants": affilinetSpainApi.getMerchants,
    // "Affili.Net (Switzerland) Merchants": affilinetSwitzerlandApi.getMerchants,
    // "Affili.Net (UK) Merchants": affilinetUKApi.getMerchants,
    // "Affiliate Gateway (Asia) Merchants": affiliateGatewayAsiaApi.getMerchants,

    "Ali Express Commisions": aliexpressApi.getCommissionDetails,
    //"Affiliate Gateway (Sg) Merchants": affiliateGatewaySgApi.getMerchants, //TODO LM to be implemented
    "AffiliateWindow Merchants": affiliatewindowApi.getMerchants,
    // "ArabyAds Merchants" : arabyadsApi.getMerchants,
    // "AvantLink (CA) Merchants": avantLinkCAApi.getMerchants,
    "Belboon Merchants": belboonApi.getMerchants,
    // "CommissionJunction (EU) Merchants": commissionJunctionEUApi.getMerchants,
    "CommissionJunction (US) Merchants": commissionJunctionUSApi.getMerchants,
    "CJ Import Deals": cjImportDeals.getMerchants,
    "CommissionFactory Merchants": commissionfactoryApi.getMerchants,
    //"Fan Merchants": fanApi.getMerchants,
    "ImpactRadius Merchants": impactRadiusApi.getMerchants,
    // "Jumia Merchants": jumiaApi.getMerchants,
    "Linkprice Merchants": linkpriceApi.getMerchants,
    "LinkShare Merchants": linkShareApi.getMerchants,
    //"Lomadee Merchants": lomadeeApi.getMerchants,
    "OMG (India) Merchants": omgpmIndiaApi.getMerchants,
    // "OMG (UK) Merchants": omgpmUKApi.getMerchants,
    "OMG (Asia) Merchants": omgpmAsiaApi.getMerchants,
    "OMG (Brazil) Merchants": omgpmBrazilApi.getMerchants,
    // "OMG (Australia) Merchants": omgpmAustraliaApi.getMerchants,
    "PartnerAds Merchants": partnerAdsApi.getMerchants,
    "PepperJam Merchants": pepperjamApi.getMerchants,
    "PerformanceHorizon Merchants": performanceHorizonApi.getMerchants,
    // "PublicIdeas (ES) Merchants": publicideasESApi.getMerchants,
    // "PublicIdeas (FR) Merchants": publicideasFRApi.getMerchants,
    // "PublicIdeas (IT) Merchants": publicideasITApi.getMerchants,
    // "PublicIdeas (LATAM) Merchants": publicideasLATAMApi.getMerchants,
    // "PublicIdeas (UK) Merchants": publicideasUKApi.getMerchants,
    //"Shoogloo Merchants": shooglooApi.getMerchants,
    // "ShopStylers Merchants": shopstylers.getMerchants,
    "TradeDoubler (AT) Merchants": tradedoublerAustriaApi.getMerchants,
    "TradeDoubler (BE) Merchants": tradedoublerBelgiumApi.getMerchants,
    "TradeDoubler (DK) Merchants": tradedoublerDenmarkApi.getMerchants,
    "TradeDoubler (FI) Merchants": tradedoublerFinnlandApi.getMerchants,
    "TradeDoubler (FR) Merchants": tradedoublerFranceApi.getMerchants,
    "TradeDoubler (IE) Merchants": tradedoublerIrelandApi.getMerchants,
    "TradeDoubler (IT) Merchants": tradedoublerItalyApi.getMerchants,
    "TradeDoubler (DE) Merchants": tradedoublerGermanyApi.getMerchants,
    "TradeDoubler (LT) Merchants": tradedoublerLithuaniaApi.getMerchants,
    "TradeDoubler (NL) Merchants": tradedoublerNetherlandsApi.getMerchants,
    "TradeDoubler (NO) Merchants": tradedoublerNorwayApi.getMerchants,
    "TradeDoubler (PL) Merchants": tradedoublerPolandApi.getMerchants,
    "TradeDoubler (PT) Merchants": tradedoublerPortugalApi.getMerchants,
    "TradeDoubler (RU) Merchants": tradedoublerRussiaApi.getMerchants,
    "TradeDoubler (ES) Merchants": tradedoublerSpainApi.getMerchants,
    "TradeDoubler (SE) Merchants": tradedoublerSwedenApi.getMerchants,
    "TradeDoubler (CH) Merchants": tradedoublerSwitzerlandApi.getMerchants,
    "TradeDoubler (GB) Merchants": tradedoublerEnglandApi.getMerchants,
    "TradeDoubler (BR) Merchants": tradedoublerBrazilApi.getMerchants,
    "TradeDoubler (HK) Merchants": tradedoublerHongKongApi.getMerchants,
    "TradeDoubler (ID) Merchants": tradedoublerIndonesiaApi.getMerchants,
    "TradeDoubler (MY) Merchants": tradedoublerMalaysiaApi.getMerchants,
    "TradeDoubler (PH) Merchants": tradedoublerPhilippinesApi.getMerchants,
    "TradeDoubler (SG) Merchants": tradedoublerSingaporeApi.getMerchants,
    "TradeDoubler (TH) Merchants": tradedoublerThailandApi.getMerchants,
    "TradeDoubler (AU) Merchants": tradedoublerAustraliaApi.getMerchants,
    "TradeDoubler (NZ) Merchants": tradedoublerNewZealandApi.getMerchants,
    "TradeDoubler (IN) Merchants": tradedoublerIndiaApi.getMerchants,
    "TradeTracker (AE) Merchants": tradetrackerAEApi.getMerchants,
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
    "TradeTracker (MX) Merchants": tradetrackerMXApi.getMerchants,
    "TradeTracker (NL) Merchants": tradetrackerNLApi.getMerchants,
    "TradeTracker (NO) Merchants": tradetrackerNOApi.getMerchants,
    "TradeTracker (PL) Merchants": tradetrackerPLApi.getMerchants,
    "TradeTracker (RU) Merchants": tradetrackerRUApi.getMerchants,
    "TradeTracker (SE) Merchants": tradetrackerSEApi.getMerchants,
    "TradeTracker (BR) Merchants": tradetrackerBRApi.getMerchants,
    "TradeTracker (IN) Merchants": tradetrackerINApi.getMerchants,
    // "VCommission Merchants": vcommissionApi.getMerchants,
    "Webgains Merchants": webgainsApi.getMerchants,
    //"Zanox Merchants": zanoxApi.getMerchants,
    "FlyDubai Merchants": tradedoublerFlyDubaiApi.getMerchants,

    // Stopping lazada until new implementation
    // "Lazada (Ph) Merchants" : lazadaPhApi.getMerchants,
    // "Lazada (My) Merchants" : lazadaMyApi.getMerchants,
    // "Lazada (Sg) Merchants" : lazadaSgApi.getMerchants,
    // "Lazada (Th) Merchants" : lazadaThApi.getMerchants,
    // "Lazada (Vn) Merchants" : lazadaVnApi.getMerchants,
    // "Lazada (Id) Merchants" : lazadaIdApi.getMerchants
  });

  tasker.createTask('ShareASale Merchants', '7d +/- 1d', shareASaleApi.getMerchants);
}

function initializeCommissionsProcessors(tasker) {
  // run each of these every 6 hours
  tasker.createGroup('6h +/- 1h', {
    // "A8 Commissions": a8Api.getCommissionDetails,
    "APD Performance Commissions": apdPerformanceApi.getCommissionDetails,
    "AdCell Commissions": adCellApi.getCommissionDetails,
    "Admitad Commissions": admitadApi.getCommissionDetails,
    "Admitad India Commissions": admitadDubliIndiaApi.getCommissionDetails,

    "Adservice(dk) Commisions": adserviceDenmarkApi.getCommissionDetails,
    "Adservice(se) Commisions": adserviceSweedenkApi.getCommissionDetails,
    "Adservice(fi) Commisions": adserviceFinlandApi.getCommissionDetails,
    "Adservice(no) Commisions": adserviceNorwayApi.getCommissionDetails,
    "Adservice(de) Commisions": adserviceGermanyApi.getCommissionDetails,

    "Adtraction Commissions": adtractionApi.getCommissionDetails,
    // "Affili.Net (Austria) Commissions": affilinetAustriaApi.getCommissionDetails,
    // "Affili.Net (France) Commissions": affilinetFranceApi.getCommissionDetails,
    // "Affili.Net (Germany) Commissions": affilinetGermanyApi.getCommissionDetails,
    // "Affili.Net (Netherlands) Commissions": affilinetNetherlandsApi.getCommissionDetails,
    // "Affili.Net (Spain) Commissions": affilinetSpainApi.getCommissionDetails,
    // "Affili.Net (Switzerland) Commissions": affilinetSwitzerlandApi.getCommissionDetails,
    // "Affili.Net (UK) Commissions": affilinetUKApi.getCommissionDetails,
    // "Affiliate Gateway (Asia) Commissions": affiliateGatewayAsiaApi.getCommissionDetails,
    // "Affiliate Gateway (SG) Commissions": affiliateGatewaySgApi.getCommissionDetails,
    "AffiliateWindow Commissions": affiliatewindowApi.getCommissionDetails,
    "Amazon (IN) Commissions": amazonApi.getCommissionDetails, // problems w/ amazon.in
    // "ArabyAds Commissions" : arabyadsApi.getCommissionDetails,
    // "AvantLink (CA) Commissions": avantLinkCAApi.getCommissionDetails,
    "Belboon Commissions": belboonApi.getCommissionDetails,
    // "CommissionJunction (EU) Commissions": commissionJunctionEUApi.getCommissionDetails,
    "CommissionJunction (US) Commissions": commissionJunctionUSApi.getCommissionDetails,
    // "ClixGalore Commissions": clixGaloreApi.getCommissionDetails,
    "CommissionFactory Commissions": commissionfactoryApi.getCommissionDetails,
    //"Fan Commissions": fanApi.getCommissionDetails,
    "Flipkart Commissions": flipkartApi.getCommissionDetails,
    "Groupon (US) Commissions": grouponUSApi.getCommissionDetails,
    "Groupon (ROW) Commissions": grouponROWApi.getCommissionDetails,
    "ImpactRadius Commissions": impactRadiusApi.getCommissionDetails,
    // "Jumia Commissions": jumiaApi.getCommissionDetails,
    "Jumia Sheet Commission": JumiaSheetApi.getCommissionDetails,

    // Stopping lazada until new implementation.
    // "Lazada (Ph) Commissions" : lazadaPhApi.getCommissionDetails,
    // "Lazada (My) Commissions" : lazadaMyApi.getCommissionDetails,
    // "Lazada (Sg) Commissions" : lazadaSgApi.getCommissionDetails,
    // "Lazada (Th) Commissions" : lazadaThApi.getCommissionDetails,
    // "Lazada (Vn) Commissions" : lazadaVnApi.getCommissionDetails,
    // "Lazada (Id) Commissions" : lazadaIdApi.getCommissionDetails,

    "LinkShare (US) Commissions": linkShareApi.getCommissionDetails,
    "LinkShare (UK) Commissions": linkShareDubliGBApi.getCommissionDetails,
    "LinkShare (Ca) Commissions": linkShareDubliCAApi.getCommissionDetails,
    "LinkShare (FR) Commissions": linkShareDubliFRApi.getCommissionDetails,
    "LinkShare (BR) Commissions": linkShareDubliBRApi.getCommissionDetails,
    "LinkShare (DE) Commissions": linkShareDubliDEApi.getCommissionDetails,
    "LinkShare (AU) Commissions": linkShareDubliAUApi.getCommissionDetails,

    "Linkprice Commissions": linkpriceApi.getCommissionDetails,

     //"Lomadee Commissions": lomadeeApi.getCommissionDetails,
    "OMG (India) Commissions": omgpmIndiaApi.getCommissionDetails,
    //"OMG (UK) Commissions": omgpmUKCommissionsApi.getCommissionDetails,
    "OMG (Asia) Commissions": omgpmAsiaApi.getCommissionDetails,
    // "OMG (Brazil) Commissions": omgpmBrazilCommissionsApi.getCommissionDetails,
    // "OMG (Australia) Commissions": omgpmAustraliaApi.getCommissionDetails,
    "PartnerAds Commissions": partnerAdsApi.getCommissionDetails,
    "PepperJam Commissions": pepperjamApi.getCommissionDetails,
    "PerformanceHorizon Commissions": performanceHorizonApi.getCommissionDetails,
    // "PublicIdeas (ES) Commissions": publicideasESApi.getCommissionDetails,
    // "PublicIdeas (FR) Commissions": publicideasFRApi.getCommissionDetails,
    // "PublicIdeas (IT) Commissions": publicideasITApi.getCommissionDetails,
    // "PublicIdeas (LATAM) Commissions": publicideasLATAMApi.getCommissionDetails,
    // "PublicIdeas (UK) Commissions": publicideasUKApi.getCommissionDetails,
    //"Shoogloo Commissions": shooglooApi.getCommissionDetails,
    // "ShopStylers Commissions": shopstylers.getCommissionDetails,
    // "SnapDeal Commissions": snapdealApi.getCommissionDetails, // OM-2252
    // "TradeDoubler (AT) Commissions": tradedoublerAustriaApi.getCommissionDetails,
    // "TradeDoubler (BE) Commissions": tradedoublerBelgiumApi.getCommissionDetails,
    // "TradeDoubler (DK) Commissions": tradedoublerDenmarkApi.getCommissionDetails,
    // "TradeDoubler (FI) Commissions": tradedoublerFinnlandApi.getCommissionDetails,
    // "TradeDoubler (FR) Commissions": tradedoublerFranceApi.getCommissionDetails,
    // "TradeDoubler (IE) Commissions": tradedoublerIrelandApi.getCommissionDetails,
    // "TradeDoubler (IT) Commissions": tradedoublerItalyApi.getCommissionDetails,
    // "TradeDoubler (DE) Commissions": tradedoublerGermanyApi.getCommissionDetails,
    // "TradeDoubler (LT) Commissions": tradedoublerLithuaniaApi.getCommissionDetails,
    // "TradeDoubler (NL) Commissions": tradedoublerNetherlandsApi.getCommissionDetails,
    // "TradeDoubler (NO) Commissions": tradedoublerNorwayApi.getCommissionDetails,
    // "TradeDoubler (PL) Commissions": tradedoublerPolandApi.getCommissionDetails,
    // "TradeDoubler (PT) Commissions": tradedoublerPortugalApi.getCommissionDetails,
    // "TradeDoubler (RU) Commissions": tradedoublerRussiaApi.getCommissionDetails,
    // "TradeDoubler (ES) Commissions": tradedoublerSpainApi.getCommissionDetails,
    // "TradeDoubler (SE) Commissions": tradedoublerSwedenApi.getCommissionDetails,
    // "TradeDoubler (CH) Commissions": tradedoublerSwitzerlandApi.getCommissionDetails,
    // "TradeDoubler (GB) Commissions": tradedoublerEnglandApi.getCommissionDetails,
    // "TradeDoubler (BR) Commissions": tradedoublerBrazilApi.getCommissionDetails,
    // "TradeDoubler (HK) Commissions": tradedoublerHongKongApi.getCommissionDetails,
    // "TradeDoubler (ID) Commissions": tradedoublerIndonesiaApi.getCommissionDetails,
    // "TradeDoubler (MY) Commissions": tradedoublerMalaysiaApi.getCommissionDetails,
    // "TradeDoubler (PH) Commissions": tradedoublerPhilippinesApi.getCommissionDetails,
    // "TradeDoubler (SG) Commissions": tradedoublerSingaporeApi.getCommissionDetails,
    // "TradeDoubler (TH) Commissions": tradedoublerThailandApi.getCommissionDetails,
    // "TradeDoubler (AU) Commissions": tradedoublerAustraliaApi.getCommissionDetails,
    // "TradeDoubler (NZ) Commissions": tradedoublerNewZealandApi.getCommissionDetails,
    // "TradeDoubler (IN) Commissions": tradedoublerIndiaApi.getCommissionDetails,
    "TradeTracker (AE) Commissions": tradetrackerAEApi.getCommissionDetails,
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
    "TradeTracker (MX) Commissions": tradetrackerMXApi.getCommissionDetails,
    "TradeTracker (NL) Commissions": tradetrackerNLApi.getCommissionDetails,
    "TradeTracker (NO) Commissions": tradetrackerNOApi.getCommissionDetails,
    "TradeTracker (PL) Commissions": tradetrackerPLApi.getCommissionDetails,
    "TradeTracker (RU) Commissions": tradetrackerRUApi.getCommissionDetails,
    "TradeTracker (SE) Commissions": tradetrackerSEApi.getCommissionDetails,
    "TradeTracker (BR) Commissions": tradetrackerBRApi.getCommissionDetails,
    "TradeTracker (IN) Commissions": tradetrackerINApi.getCommissionDetails,
    // "VCommission Commissions": vcommissionApi.getCommissionDetails,
    "Webgains Commissions": webgainsApi.getCommissionDetails,
    // "Zanox Commissions": zanoxApi.getCommissionDetails,
    "Priceline Commissions": pricelineApi.getCommissionDetails,
    // "FlyDubai Commissions": tradedoublerFlyDubaiApi.getCommissionDetails
    "Tradedoubler Commissions": tradedoublerApi.getCommissionDetails
  });

  tasker.createTask('ShareASale Commissions', '4d +/- 1d', shareASaleApi.getCommissionDetails);

  // disabled for now:
  //createTask("ImpactRadius Product FTP": impactRadiusProductFtp.getProducts, {minute:35});
}

function initializeCommissionsDubliProcessors(tasker) {
  // run each of these every 24 hours
  tasker.createGroup('2d +/- 1d', {
    "AdCell DubLi Commissions": adCellDubliApi.getCommissionDetails,
    "Admitad DubLi Commissions": admitadDubliApi.getCommissionDetails,
    // "Affili.Net DubLi (DE) Commissions": affilinetDubliDEApi.getCommissionDetails,
    // "Affili.Net DubLi (ES) Commissions": affilinetDubliESApi.getCommissionDetails,
    // "Affili.Net DubLi (UK) Commissions": affilinetDubliUKApi.getCommissionDetails,
    "Affili.Net DubLi (AT) Commissions": affilinetDubliATApi.getCommissionDetails,
    // "Affili.Net DubLi (CH) Commissions": affilinetDubliCHApi.getCommissionDetails,
    "AffiliateWindow DubLi Commissions": affiliatewindowDubliApi.getCommissionDetails,
    // "AvantLink DubLi (CA) Commissions": avantLinkDubliCAApi.getCommissionDetails,
    "Belboon DubLi Commissions": belboonDubliApi.getCommissionDetails,
    "CommissionFactory DubLi Commissions": commissionfactoryDubliApi.getCommissionDetails,
    "CommissionJunction DubLi (US) Commissions": commissionJunctionDubliUSApi.getCommissionDetails,
    "CommissionJunction DubLi (DE) Commissions": commissionJunctionDubliDEApi.getCommissionDetails,
    "CommissionJunction DubLi (ES) Commissions": commissionJunctionDubliESApi.getCommissionDetails,
    "CommissionJunction DubLi (GB) Commissions": commissionJunctionDubliGBApi.getCommissionDetails,
    "CommissionJunction DubLi (DK) Commissions": commissionJunctionDubliDKApi.getCommissionDetails,
    "CommissionJunction DubLi (IT) Commissions": commissionJunctionDubliITApi.getCommissionDetails,
    "DGM DubLi (AU) Commissions": dgmDubliAUApi.getCommissionDetails,
    "Flipkart DubLi Commissions": flipkartDubliApi.getCommissionDetails,
    "ImpactRadius DubLi (US) Commissions": impactRadiusDubliUSApi.getCommissionDetails,
    "ImpactRadius DubLi (CA) Commissions": impactRadiusDubliCAApi.getCommissionDetails,
    "LinkShare DubLi (US) Commissions": linkShareDubliUSApi.getCommissionDetails,
    "LinkShare DubLi (CA) Commissions": linkShareDubliCAApi.getCommissionDetails,
    "LinkShare DubLi (GB) Commissions": linkShareDubliGBApi.getCommissionDetails,
    "OMG DubLi (India) Commissions": omgpmDubliIndiaApi.getCommissionDetails,
    "PartnerAds DubLi Commissions": partnerAdsDubliApi.getCommissionDetails,
    "PepperJam DubLi Commissions": pepperjamDubliApi.getCommissionDetails,
    "PerformanceHorizon DubLi-Apple Commissions": performanceHorizonDubliAppleApi.getCommissionDetails,
    "PerformanceHorizon DubLi-iTunes Commissions": performanceHorizonDubliItunesApi.getCommissionDetails,
    "PerformanceHorizon DubLi-BritishAirways Commissions": performanceHorizonDubliBAApi.getCommissionDetails,
    "PerformanceHorizon DubLi-WoolWorth Commissions": performanceHorizonDubliWWApi.getCommissionDetails,
    "TradeTracker DubLi (CH) Commissions": tradetrackerDubliCHApi.getCommissionDetails,
    "TradeTracker DubLi (DE) Commissions": tradetrackerDubliDEApi.getCommissionDetails,
    "TradeTracker DubLi (DK) Commissions": tradetrackerDubliDKApi.getCommissionDetails,
    "TradeTracker DubLi (AT) Commissions": tradetrackerDubliATApi.getCommissionDetails,
    "TradeTracker DubLi (RU) Commissions": tradetrackerDubliRUApi.getCommissionDetails,
    "TradeTracker DubLi (BR) Commissions": tradetrackerDubliBRApi.getCommissionDetails,
    // "VCommission DubLi Commissions": vcommissionDubliApi.getCommissionDetails,
    // "Zanox DubLi (DE) Commissions": zanoxDubliDEApi.getCommissionDetails,
    // "Zanox DubLi (ES) Commissions": zanoxDubliESApi.getCommissionDetails,
    // "Zanox DubLi (AU) Commissions": zanoxDubliAUApi.getCommissionDetails,
    // "Zanox DubLi (DK) Commissions": zanoxDubliDKApi.getCommissionDetails,
    // "Zanox DubLi (SE) Commissions": zanoxDubliSEApi.getCommissionDetails,
    // "Zanox DubLi (NO) Commissions": zanoxDubliNOApi.getCommissionDetails,
    // "Zanox DubLi (Global) Commissions": zanoxDubliGlobalApi.getCommissionDetails
  });

  tasker.createTask('ShareASale Dubli Commissions', '7d +/- 1d', shareASaleDubliApi.getCommissionDetails);
}
function intializeUserReferrals(tasker) {
  // Run this every 24 hour
  tasker.createTask('add Referral users', '3h +/- 1h', userReferralApi.addReferralProperties);
  tasker.createTask('add Referral cashback', '6h +/- 1h', userReferralApi.addReferralAmount);
  tasker.createTask('add Vip Referral cashback', '6h +/- 1h', userReferralApi.addVipReferralAmount);
}
