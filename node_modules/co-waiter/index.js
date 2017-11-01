"use strict";

var isHarmonious = !!(typeof Promise === 'function' &&
  (function(){ try { return eval("(n => !n)()"); } catch(e) {}})());

module.exports = require(isHarmonious ? './harmony' : './no-harmony');
