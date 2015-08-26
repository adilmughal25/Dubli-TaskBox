(function() {
  "use strict";

  var expect = require('chai').expect;
	var assert = require('chai').assert;
	var adCellApi = require(process.cwd() + '/src/scripts/adCellApi');
	var adCellApiClient = require(process.cwd() + '/src/scripts/api-clients/adCell')();

	describe('AdCell API', function() {

    it('API definition', function() {
      assert.isObject(adCellApi, 'adCellApi is an object');
      expect(adCellApi).to.have.property('getMerchants');
      expect(adCellApi).to.have.property('getCommissionDetails');
    });

    it('able to retrieve token', function() {
      let tokenPromise = adCellApiClient.getToken();

      return tokenPromise.then(function(token) {
        expect(token).to.be.a('string');
        expect(token).to.have.length.of.at.least(20);
      });
    });

    it('able to retrieve merchants', function() {
      let merchantPromise = adCellApiClient.getAffiliateProgram();

      return merchantPromise.then(function(results) {
        assert.isObject(results, 'results is an object');
        assert.isArray(results.items, 'results.items is an object');
        expect(results.items[0]).to.have.property('programId');
      });
    });

    it('able to retrieve commission details', function() {
      let startDate = new Date(Date.now() - (14 * 86400 * 1000)),
          endDate = new Date(Date.now() - (60 * 1000)),
          commissionPromise = adCellApiClient.getStatisticsByCommission({startDate: startDate, endDate: endDate, programIds: [6]});

      return commissionPromise.then(function(results) {
        assert.isObject(results, 'results is an object');
        assert.isArray(results.items, 'results.items is an object');
        expect(results.total).to.have.property('totalCommission');
      });
    });

	});

})();
