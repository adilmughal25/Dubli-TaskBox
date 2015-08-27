"use strict";

module.exports = function singleRun(fn) {
  var running = false;
  return function* () {
    if (running) { throw 'already-running'; }
    running = true;
    var args = [].slice.call(arguments);
    var self = this;
    try {
      return yield* fn.apply(self, args);
    } finally {
      running = false;
    }
  };
};
