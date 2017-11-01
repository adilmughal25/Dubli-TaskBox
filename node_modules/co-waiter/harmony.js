"use strict";

var wait = module.exports = (ms,value) => new Promise(resolve => setTimeout(resolve, ms|0, value));
var sec = wait.seconds = wait.second = wait.sec = (num,value) => wait(num * 1000, value);
var min = wait.minutes = wait.minute = wait.min = (num,value) => sec(num * 60, value);
var hour = wait.hours = wait.hour = (num,value) => min(num * 60, value);
var day = wait.days = wait.day = (num,value) => hour(num * 24, value);
var week = wait.weeks = wait.week = (num,value) => day(num * 7, value);
var month = wait.months = wait.month = (num,value) => day(num * 30, value);

wait.until = function(date, value) {
  var now = Date.now();
  var diff = now - date;
  if (diff < 0) diff = 0;
  return wait(diff, value);
};
