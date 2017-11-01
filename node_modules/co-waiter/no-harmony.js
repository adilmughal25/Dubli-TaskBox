"use strict";

var _Promise = typeof Promise === 'function' ? Promise : require('lie');

var wait = module.exports = function(ms, val) {
  return new _Promise(function(resolve, reject) {
    setTimeout(resolve, ms|0, val);
  });
};
var sec = wait.seconds = wait.second = wait.sec = function(n, v) { return wait(n * 1000, v); };
var min = wait.minutes = wait.minute = wait.min = function(n, v) { return sec(n * 60, v); };
var hour = wait.hours = wait.hour = function(n, v) { return min(n * 60, v); };
var day = wait.days = wait.day = function(n, v) { return hour(n * 24, v); };
var week = wait.weeks = wait.week = function(n, v) { return day(n * 7, v); };
var month = wait.months = wait.month = function(n, v) { return day(n * 30, v); };
var until = wait.until = function(n,v) {
  var d = Date.now();
  return (d - n > 0) ? null : wait(n - Date.now(), v);
};
