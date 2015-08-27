(function() {
  "use strict";

  /*
   * AvantLink API is kinda slow... expect the test to take more than 10seconds - regarding mocha --timeout 10000  :(
   */

  const co = require('co');
  const chai = require('chai');
  const expect = chai.expect;
	const assert = chai.assert;
  const avantLinkGenericApi = require(process.cwd() + '/src/tasks/affiliate-networks/avantLinkGenericApi');
  const avantLinkApiClient = require(process.cwd() + '/src/tasks/affiliate-networks/api-clients/avantlink');
  var avantLinkUSApi = avantLinkGenericApi('us');

  describe('AvantLink API', function() {

    it('API definition', function() {
      assert.isFunction(avantLinkGenericApi);

      assert.isObject(avantLinkApiClient, 'avantLinkApiClient is an object.');
      assert.isObject(avantLinkUSApi, 'avantLinkUSApi is an object.');

      expect(avantLinkUSApi).to.have.property('getMerchants');
      expect(avantLinkUSApi).to.have.property('getCommissionDetails');

      expect(avantLinkApiClient).to.have.property('getClient');

      assert.throws(avantLinkApiClient.getClient, Error, /Unknown AvantLink api type/);
      assert.throws( ()=>{
        avantLinkApiClient.getClient('xx');
      }, Error, "Unknown AvantLink region: xx");
    });

    it('able to retrieve US merchants', function() {
      let merchantPromise = avantLinkApiClient.getClient('us', 'merchants').getData();

      return merchantPromise.then(function(results) {
        assert.isArray(results, 'results is an array');
        expect(results).to.have.length.above(1);
        expect(results[0]).to.have.property('lngMerchantId');
      });
    });

    it('able to retrieve US commission details', function() {
      let startDate = new Date(Date.now() - (30 * 86400 * 1000)),
          endDate = new Date(Date.now() - (60 * 1000)),
          commissionsPromise = avantLinkApiClient.getClient('us', 'commissions').getData({date_begin: startDate, date_end:endDate});

      return commissionsPromise.then(function(results) {
        expect(results).to.be.array;
        if (results.length > 0) { // there could simply be no transaction in selected time period
          expect(results[0]).to.have.property('Order_Id');
        }
      });
    });

	});

})();
