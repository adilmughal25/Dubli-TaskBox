"use strict";

module.exports = function singleRun(fn) {
  var running = false;
  return function* () {
    if (running) { throw 'already-running'; }
    running = true;
    var args = [].slice.call(arguments);
    var self = this;
    try {
      var iter = fn.apply(self, args);
      var res;
      while (true) {
        res = iter.next();
        if (res.done === true) break;
        yield res.value;
      }
    } finally {
      running = false;
    }
  };
};
