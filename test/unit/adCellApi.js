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
		});

		it('able to retrieve token', function() {
			let tokenPromise = adCellApiClient.getToken();

			return tokenPromise.then(function(token){
				expect(token).to.be.a('string');
				expect(token).to.have.length.of.at.least(20);
			});
		});
		
		it('able to retrieve merchants', function() {
			let merchantPromise = adCellApiClient.getAffiliateProgram();

			return merchantPromise.then(function(merchants){
				assert.isArray(merchants, 'merchants is an object');
				expect(merchants[0]).to.have.property('programId');
			});
		});

	});

})();