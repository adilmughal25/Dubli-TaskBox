"use strict";

module.exports = { init: init };

const adCellApi = require('./adCellApi');
const admitadApi = require('./admitadApi');
const affiliatewindowApi = require('./affiliatewindowApi');
const amazonApi = require('./amazonApi');
const belboonApi = require('./belboonApi');
const clickJunctionApi = require("./clickJunctionApi");
const commissionfactoryApi = require('./commissionfactoryApi');
const flipkartApi = require('./flipkartApi');
const grouponApi = require('./grouponApi');
const impactRadiusProductFtp = require("./impactRadiusProductFtp");
const linkShareApi = require("./linkShareApi");
const pepperjamApi = require('./pepperjamApi');
const performanceHorizonApi = require('./performanceHorizonApi');
const shareASaleApi = require('./shareASaleApi');
const tradedoublerApi = require('./tradedoublerApi');
const webgainsApi = require('./webgainsApi');
const zanoxApi = require('./zanoxApi');

const affiliateGatewayGenericApi = require('./affiliateGatewayGenericApi');
const affiliateGatewayAsiaApi = affiliateGatewayGenericApi('asia');
const affiliateGatewaySgApi = affiliateGatewayGenericApi('sg');

const affilinetGenericApi = require('./affilinetGenericApi');
const affilinetAustriaApi = affilinetGenericApi('at');
const affilinetFranceApi = affilinetGenericApi('fr');
const affilinetGermanyApi = affilinetGenericApi('de');
const affilinetNetherlandsApi = affilinetGenericApi('nl');
const affilinetSpainApi = affilinetGenericApi('es');
const affilinetSwitzerlandApi = affilinetGenericApi('ch');
const affilinetUKApi = affilinetGenericApi('uk');

const impactRadiusGenericApi = require('./impactRadiusGenericApi');
const apdPerformanceApi = impactRadiusGenericApi('apdperformance');
const impactRadiusApi = impactRadiusGenericApi('impactradius');

const hasoffersGenericApi = require('./hasoffersGenericApi');
const snapdealApi = hasoffersGenericApi('snapdeal');
const vcommissionApi = hasoffersGenericApi('vcommission');

const publicideasGenericApi = require('./publicideasGenericApi');
const publicideasESApi = publicideasGenericApi('es');
const publicideasFRApi = publicideasGenericApi('fr');
const publicideasITApi = publicideasGenericApi('it');
const publicideasLATAMApi = publicideasGenericApi('latam');
const publicideasUKApi = publicideasGenericApi('uk');

const avantLinkGenericApi = require('./avantLinkGenericApi');
const avantLinkCAApi = avantLinkGenericApi('ca');
const avantLinkUSApi = avantLinkGenericApi('us');

const omgpmGenericApi = require('./omgpmGenericApi');
const omgpmIndiaApi = omgpmGenericApi('india');
const omgpmUKApi = omgpmGenericApi('uk');
const omgpmAsiaApi = omgpmGenericApi('asia');
const omgpmBrazilApi = omgpmGenericApi('brazil');
const omgpmAustraliaApi = omgpmGenericApi('australia');

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

function init(createTask) {

  // run each of these every 24 hours -- since their position within the 24h
  // segment is randomized, this could lead to some not being calculated every
  // day if and when there's a deploy and/or taskbox restart.
  createTask.createGroup(24, {
    "APD Performance Merchants": apdPerformanceApi.getMerchants,
    "AdCell Merchants": adCellApi.getMerchants,
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
    "ClickJunction Merchants (Euro)": clickJunctionApi.getMerchantsEuro,
    "ClickJunction Merchants (USA)": clickJunctionApi.getMerchantsUSA,
    "CommissionFactory Merchants": commissionfactoryApi.getMerchants,
    "ImpactRadius Merchants": impactRadiusApi.getMerchants,
    "LinkShare Merchants": linkShareApi.getMerchants,
    "OMG (India) Merchants": omgpmIndiaApi.getMerchants,
    "OMG (UK) Merchants": omgpmUKApi.getMerchants,
    "OMG (Asia) Merchants": omgpmAsiaApi.getMerchants,
    "OMG (Brazil) Merchants": omgpmBrazilApi.getMerchants,
    "OMG (Australia) Merchants": omgpmAustraliaApi.getMerchants,
    "PepperJam Merchants": pepperjamApi.getMerchants,
    "PerformanceHorizon Merchants": performanceHorizonApi.getMerchants,
    "PublicIdeas (ES) Merchants": publicideasESApi.getMerchants,
    "PublicIdeas (FR) Merchants": publicideasFRApi.getMerchants,
    "PublicIdeas (IT) Merchants": publicideasITApi.getMerchants,
    "PublicIdeas (LATAM) Merchants": publicideasLATAMApi.getMerchants,
    "PublicIdeas (UK) Merchants": publicideasUKApi.getMerchants,
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
    "Zanox Merchants": zanoxApi.getMerchants,
    "ShareASale Merchants": shareASaleApi.getMerchants,
  });

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
    // "Affiliate Gateway (Asia) Commissions": affiliateGatewayAsiaApi.getCommissionDetails,
    // "Affiliate Gateway (SG) Commissions": affiliateGatewaySgApi.getCommissionDetails,
    "AffiliateWindow Commissions": affiliatewindowApi.getCommissionDetails,
    // "Amazon (IN) Commissions": amazonApi.getCommissionDetails, // problems w/ amazon.in
    "AvantLink (CA) Commissions": avantLinkCAApi.getCommissionDetails,
    "AvantLink (US) Commissions": avantLinkUSApi.getCommissionDetails,
    "ClickJunction (Euro) Commissions": clickJunctionApi.getCommissionDetailsEuro,
    "ClickJunction (USA) Commissions": clickJunctionApi.getCommissionDetailsUSA,
    "CommissionFactory Commissions": commissionfactoryApi.getCommissionDetails,
    "Flipkart Commissions": flipkartApi.getCommissionDetails,
    "Groupon Commissions": grouponApi.getCommissionDetails,
    "ImpactRadius Commissions": impactRadiusApi.getCommissionDetails,
    "LinkShare Commissions": linkShareApi.getCommissionDetails,
    "PepperJam Commissions": pepperjamApi.getCommissionDetails,
    "PerformanceHorizon Commissions": performanceHorizonApi.getCommissionDetails,
    // PI still has issues
    // "PublicIdeas (ES) Commissions": publicideasESApi.getCommissionDetails,
    // "PublicIdeas (FR) Commissions": publicideasFRApi.getCommissionDetails,
    // "PublicIdeas (IT) Commissions": publicideasITApi.getCommissionDetails,
    // "PublicIdeas (LATAM) Commissions": publicideasLATAMApi.getCommissionDetails,
    // "PublicIdeas (UK) Commissions": publicideasUKApi.getCommissionDetails,
    "SnapDeal Commissions": snapdealApi.getCommissionDetails,
    "ShareASale Commissions": shareASaleApi.getCommissionDetails,
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
    "Zanox Commissions": zanoxApi.getCommissionDetails,
  });

  // disabled for now:
  //createTask("ImpactRadius Product FTP": impactRadiusProductFtp.getProducts, {minute:35});

}
