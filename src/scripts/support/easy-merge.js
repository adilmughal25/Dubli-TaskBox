"use strict";

var _ = require('lodash');

function easyMerge(s_merchantIdKey, o_other) {
  function empty(merchant) {
    var entry = {};
    entry.merchant = merchant;
    for (var k in o_other) {
      entry[k] = [];
    }
    return entry;
  }

  function _push(res, key, idField) {
    return function(item) {
      var id = _.get(item, idField);
      if (!res[id]) return;
      res[id][key].push(item);
    };
  }

  return function(o_obj) {
    var results = {};

    o_obj.merchants.forEach(function(merchant) {
      var id = _.get(merchant, s_merchantIdKey);
      results[id] = empty(merchant);
    });
    delete o_obj.merchants;

    Object.keys(o_other).forEach(function(key) {
      var idField = o_other[key];
      o_obj[key].forEach(_push(results, key, idField));
      delete o_obj[key];
    });

    return _.values(results);
  };
}

module.exports = easyMerge;
