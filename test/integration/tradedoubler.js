(function () {
  'use strict';

  const chai = require('chai');
  const expect = chai.expect;
  const assert = chai.assert;
  const tradedoublerApi = require(process.cwd() + '/src/tasks/affiliate-networks/tradedoubler/tasks')('dk');
  const tradedoublerApiClient = require(process.cwd() + '/src/tasks/affiliate-networks/tradedoubler/api')('dk');

  describe('TradeDoubler API', function () {
    it('API definition', function () {
      assert.isObject(tradedoublerApi, 'tradedoublerApi is an object.');
      assert.isObject(tradedoublerApiClient, 'tradedoublerApiClient is an object.');

      expect(tradedoublerApi).to.have.property('getMerchants');
    });

    it('able to retrieve vouchers', function () {
      let vouchersPromise = tradedoublerApiClient.apiCall('coupons');

      return vouchersPromise.then(function (results) {
        expect(results).to.have.length.above(1);
        expect(results[0]).to.have.property('programId');
        expect(results[0]).to.have.property('programName');
      });
    });

    it('able to retrieve merchants', function () {
      let merchantPromise = tradedoublerApiClient.apiCall('merchants');

      return merchantPromise.then(function (results) {
        expect(results).to.have.length.above(1);
        expect(results[0]).to.have.property('programId');
        expect(results[0]).to.have.property('programName');
      });
    });
  });
})();
