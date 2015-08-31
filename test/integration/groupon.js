(function() {
  "use strict";

  var expect = require('chai').expect;
  var assert = require('chai').assert;
  var grouponApi = require(process.cwd() + '/src/tasks/affiliate-networks/grouponApi');
  var grouponApiClient = require(process.cwd() + '/src/tasks/affiliate-networks/api-clients/groupon')();

  describe('Groupon API', function() {

    it('API definition', function() {
      assert.isObject(grouponApi, 'grouponApi is an object');
      expect(grouponApi).to.have.property('getCommissionDetails');
    });

    it('able to retrieve commission details', function() {
      let startDate = new Date(Date.now() - (14 * 86400 * 1000)),
          endDate = new Date(Date.now() - (60 * 1000)),
          commissionPromise = grouponApiClient.getOrders({startDate: startDate, endDate: endDate});

      return commissionPromise.then(function(results) {
        assert.isObject(results, 'results is an object');

        expect(results).to.have.property('total');
        expect(results).to.have.property('summary');
        expect(results).to.have.property('records');

        assert.isArray(results.records, 'results.records is an array');

        if (results.records.length > 0) { // there could simply be no transaction in selected time period
          expect(results.records[0]).to.have.property('group');
          expect(results.records[0]).to.have.property('measures');
          expect(results.records[0].measures).to.have.property('SaleGrossAmount');
          expect(results.records[0].group[0].informations).to.have.property('BillingId');
        }
      });
    });

  });

})();
