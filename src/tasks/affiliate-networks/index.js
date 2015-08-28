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

const adCellApi = require('./adCellApi');

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
  createTask("Affili.Net (UK) Merchants", affilinetUKApi.getMerchants, {minute:0});
  createTask("ImpactRadius Merchants", impactRadiusApi.getMerchants, {minute: 2});
  createTask("LinkShare Merchants", linkShareApi.getMerchants, {minute: 4});
  createTask("ClickJunction Merchants (USA)", clickJunctionApi.getMerchantsUSA, {minute: 8});
  createTask("Affili.Net (France) Merchants", affilinetFranceApi.getMerchants, {minute:10});
  createTask("PerformanceHorizon Merchants", performanceHorizonApi.getMerchants, {minute: 12});
  createTask("Zanox Merchants", zanoxApi.getMerchants, {minute: 14});
  createTask("PepperJam Merchants", pepperjamApi.getMerchants, {minute: 16});
  createTask("Affili.Net (Netherlands) Merchants", affilinetNetherlandsApi.getMerchants, {minute:18});
  createTask("VCommission Merchants", vcommissionApi.getMerchants, {minute:20});
  createTask("ClickJunction Merchants (Euro)", clickJunctionApi.getMerchantsEuro, {minute: 22});
  createTask("CommissionFactory Merchants", commissionfactoryApi.getMerchants, {minute:24});
  createTask("Affili.Net (Germany) Merchants", affilinetGermanyApi.getMerchants, {minute:26});
  createTask("AffiliateWindow Merchants", affiliatewindowApi.getMerchants, {minute:28});
  createTask("TradeTracker Merchants", tradetrackerApi.getMerchants, {minute:32});
  createTask("Affili.Net (Spain) Merchants", affilinetSpainApi.getMerchants, {minute:34});
  createTask("PublicIdeas (ES) Merchants", publicideasESApi.getMerchants, {minute:36});
  createTask("Webgains Merchants", webgainsApi.getMerchants, {minute:38});
  createTask("APD Performance Merchants", apdPerformanceApi.getMerchants, {minute:40});
  createTask("Affili.Net (Switzerland) Merchants", affilinetSwitzerlandApi.getMerchants, {minute:42});
  createTask("SnapDeal Merchants", snapdealApi.getMerchants, {minute:44});
  createTask("Belboon Merchants", belboonApi.getMerchants, {minute:46});
  createTask("OMGpm Merchants", omgpmApi.getMerchants, {minute:48});
  createTask("Affili.Net (Austria) Merchants", affilinetAustriaApi.getMerchants, {minute:50});
  createTask("AdCell Merchants", adCellApi.getMerchants, {minute:52});
  createTask("PublicIdeas (FR) Merchants", publicideasFRApi.getMerchants, {minute:52});
  createTask("PublicIdeas (IT) Merchants", publicideasITApi.getMerchants, {minute:54});
  createTask("PublicIdeas (LATAM) Merchants", publicideasLATAMApi.getMerchants, {minute:56});
  createTask("PublicIdeas (UK) Merchants", publicideasUKApi.getMerchants, {minute:58});
  createTask("AvantLink (US) Merchants", avantLinkUSApi.getMerchants, {minute:0});
  createTask("AvantLink (CA) Merchants", avantLinkCAApi.getMerchants, {minute:2});

  // createTask("", blah.getMerchants, {minute:58});

  createTask("ClickJunction (USA) Commissions", clickJunctionApi.getCommissionDetailsUSA, {minute: 0});
  createTask("PepperJam Commissions", pepperjamApi.getCommissionDetails, {minute:2});
  createTask("ImpactRadius Commissions", impactRadiusApi.getCommissionDetails, {minute: 4});
  createTask("ClickJunction (Euro) Commissions", clickJunctionApi.getCommissionDetailsEuro, {minute: 6});
  createTask("APD Performance Commissions", apdPerformanceApi.getCommissionDetails, {minute:8});
  createTask("Zanox Commissions", zanoxApi.getCommissionDetails, {minute:10});
  createTask("Affili.Net (UK) Commissions", affilinetUKApi.getCommissionDetails, {minute:12});
  createTask("Affili.Net (France) Commissions", affilinetFranceApi.getCommissionDetails, {minute:14});
  createTask("Affili.Net (Netherlands) Commissions", affilinetNetherlandsApi.getCommissionDetails, {minute:16});
  createTask("Affili.Net (Spain) Commissions", affilinetSpainApi.getCommissionDetails, {minute:18});
  createTask("Affili.Net (Germany) Commissions", affilinetGermanyApi.getCommissionDetails, {minute:20});
  createTask("Affili.Net (Switzerland) Commissions", affilinetSwitzerlandApi.getCommissionDetails, {minute:22});
  createTask("Affili.Net (Austria) Commissions", affilinetAustriaApi.getCommissionDetails, {minute:24});
  createTask("AffiliateWindow Commissions", affiliatewindowApi.getCommissionDetails, {minute:26});
  createTask("AdCell Commissions", adCellApi.getCommissionDetails, {minute:28});
  createTask("LinkShare Commissions", linkShareApi.getCommissionDetails, {minute: 30});
  createTask("SnapDeal Commissions", snapdealApi.getCommissionDetails, {minute:32});
  createTask("VCommission Commissions", vcommissionApi.getCommissionDetails, {minute:34});
  createTask("AvantLink (US) Commissions", avantLinkUSApi.getCommissionDetails, {minute:36});
  createTask("AvantLink (CA) Commissions", avantLinkCAApi.getCommissionDetails, {minute:38});
  createTask("Flipkart Commissions", flipkartApi.getCommissionDetails, {minute:40});

  // disabled for now:
  //createTask("ImpactRadius Product FTP", impactRadiusProductFtp.getProducts, {minute:1});

}
