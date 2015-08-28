"use strict";

module.exports = { init: init };

const affiliatewindowApi = require('./affiliatewindowApi');
const belboonApi = require('./belboonApi');
const clickJunctionApi = require("./clickJunctionApi");
const commissionfactoryApi = require('./commissionfactoryApi');
const flipkartApi = require('./flipkartApi');
const impactRadiusProductFtp = require("./impactRadiusProductFtp");
const linkShareApi = require("./linkShareApi");
const omgpmApi = require('./omgpmApi');
const pepperjamApi = require('./pepperjamApi');
const performanceHorizonApi = require('./performanceHorizonApi');
const tradetrackerApi = require('./tradetrackerApi');
const webgainsApi = require('./webgainsApi');
const zanoxApi = require('./zanoxApi');
const adCellApi = require('./adCellApi');

const affilinetGenericApi = require('./affilinetGenericApi');
const affilinetUKApi = affilinetGenericApi('uk');
const affilinetFranceApi = affilinetGenericApi('fr');
const affilinetNetherlandsApi = affilinetGenericApi('nl');
const affilinetSpainApi = affilinetGenericApi('es');
const affilinetGermanyApi = affilinetGenericApi('de');
const affilinetSwitzerlandApi = affilinetGenericApi('ch');
const affilinetAustriaApi = affilinetGenericApi('at');

const impactRadiusGenericApi = require('./impactRadiusGenericApi');
const impactRadiusApi = impactRadiusGenericApi('impactradius');
const apdPerformanceApi = impactRadiusGenericApi('apdperformance');

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
const avantLinkUSApi = avantLinkGenericApi('us');
const avantLinkCAApi = avantLinkGenericApi('ca');

function init(createTask) {

  // run each of these every 6 hours
  createTask.createGroup(6, {
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
    "OMGpm Merchants": omgpmApi.getMerchants,
    "PepperJam Merchants": pepperjamApi.getMerchants,
    "PerformanceHorizon Merchants": performanceHorizonApi.getMerchants,
    "PublicIdeas (ES) Merchants": publicideasESApi.getMerchants,
    "PublicIdeas (FR) Merchants": publicideasFRApi.getMerchants,
    "PublicIdeas (IT) Merchants": publicideasITApi.getMerchants,
    "PublicIdeas (LATAM) Merchants": publicideasLATAMApi.getMerchants,
    "PublicIdeas (UK) Merchants": publicideasUKApi.getMerchants,
    "SnapDeal Merchants": snapdealApi.getMerchants,
    "TradeTracker Merchants": tradetrackerApi.getMerchants,
    "VCommission Merchants": vcommissionApi.getMerchants,
    "Webgains Merchants": webgainsApi.getMerchants,
    "Zanox Merchants": zanoxApi.getMerchants,
  });

  // run each of these every 6 hours
  createTask.createGroup(6, {
    "APD Performance Commissions": apdPerformanceApi.getCommissionDetails,
    "AdCell Commissions": adCellApi.getCommissionDetails,
    "Affili.Net (Austria) Commissions": affilinetAustriaApi.getCommissionDetails,
    "Affili.Net (France) Commissions": affilinetFranceApi.getCommissionDetails,
    "Affili.Net (Germany) Commissions": affilinetGermanyApi.getCommissionDetails,
    "Affili.Net (Netherlands) Commissions": affilinetNetherlandsApi.getCommissionDetails,
    "Affili.Net (Spain) Commissions": affilinetSpainApi.getCommissionDetails,
    "Affili.Net (Switzerland) Commissions": affilinetSwitzerlandApi.getCommissionDetails,
    "Affili.Net (UK) Commissions": affilinetUKApi.getCommissionDetails,
    "AffiliateWindow Commissions": affiliatewindowApi.getCommissionDetails,
    "AvantLink (CA) Commissions": avantLinkCAApi.getCommissionDetails,
    "AvantLink (US) Commissions": avantLinkUSApi.getCommissionDetails,
    "ClickJunction (Euro) Commissions": clickJunctionApi.getCommissionDetailsEuro,
    "ClickJunction (USA) Commissions": clickJunctionApi.getCommissionDetailsUSA,
    "Flipkart Commissions": flipkartApi.getCommissionDetails,
    "ImpactRadius Commissions": impactRadiusApi.getCommissionDetails,
    "LinkShare Commissions": linkShareApi.getCommissionDetails,
    "PepperJam Commissions": pepperjamApi.getCommissionDetails,
    "SnapDeal Commissions": snapdealApi.getCommissionDetails,
    "VCommission Commissions": vcommissionApi.getCommissionDetails,
    "Zanox Commissions": zanoxApi.getCommissionDetails,
  });

  // disabled for now:
  //createTask("ImpactRadius Product FTP": impactRadiusProductFtp.getProducts, {minute:35});

}
