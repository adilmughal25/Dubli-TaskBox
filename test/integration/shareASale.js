(function() {
  "use strict";

  var expect = require('chai').expect;
	var assert = require('chai').assert;
	var shareASaleApi = require(process.cwd() + '/src/tasks/affiliate-networks/shareASaleApi');
	var shareASaleApiClient = require(process.cwd() + '/src/tasks/affiliate-networks/api-clients/shareASale')();

	describe('Share A Sale API', function() {

    it('API definition', function() {
      assert.isObject(shareASaleApi, 'shareASaleApi is an object');
      expect(shareASaleApi).to.have.property('getMerchants');
      expect(shareASaleApi).to.have.property('getCommissionDetails');
    });

    it('able to retrieve merchants', function() {
      let merchantPromise = shareASaleApiClient.getMerchants();

      return merchantPromise.then(function(results) {
        assert.isArray(results, 'results is an array');
        if (results.length > 0) {
          assert.isObject(results[0], 'results has at least 1 item which is an object');
          expect(results[0]).to.have.property('merchantid');
        }
      });
    });

    it('able to retrieve commission details', function() {
      let startDate = new Date(Date.now() - (14 * 86400 * 1000)),
          endDate = new Date(Date.now() - (60 * 1000)),
          activityPromise = shareASaleApiClient.getActivityDetails({dateStart: startDate, dateEnd: endDate}),
          ledgerPromise = shareASaleApiClient.getLedgerReport({dateStart: startDate, dateEnd: endDate});

      return activityPromise.then(function(results) {
        assert.isArray(results, 'results is an array');
        if (results.length > 0) {
          assert.isObject(results[0], 'results has at least 1 item which is an object');
          expect(results[0]).to.have.property('transid');
          expect(results[0]).to.have.property('transdate');
          expect(results[0]).to.have.property('affcomment');
          expect(results[0]).to.have.property('voided');
        }
      }).then(function() {
        return ledgerPromise.then(function(results) {
          assert.isArray(results, 'results is an array');
          if (results.length > 0) {
            assert.isObject(results[0], 'results has at least 1 item which is an object');
            expect(results[0]).to.have.property('transid');
            expect(results[0]).to.have.property('transtype');
            expect(results[0]).to.have.property('afftrack');
            expect(results[0]).to.have.property('impact');
            expect(results[0]).to.have.property('orderimpact');
          }
        });
      });
    });

	});

})();
