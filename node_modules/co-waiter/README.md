## co-waiter

Super-simple wait() function which is a lightweight wrapper around setTimeout.
I wrote this module just so I'd have an easy way to use things like
`yield wait.seconds(30);` in my [co](https://github.com/tj/co)-based workflows.

Provides the following methods. Each waits an amount of time, then resolves a
promise. If the `v` argument is passed, the promise will resolve with that
value.

  * wait(n,v) -- milliseconds
  * wait.until(date, v) -- wait until date, then resolve. if date is in the past, resolve immediately.
  * wait.seconds(n,v)
  * wait.second(n,v)
  * wait.sec(n,v)
  * wait.minutes(n,v)
  * wait.minute(n,v)
  * wait.min(n,v)
  * wait.hours(n,v)
  * wait.hour(n,v)
  * wait.days(n,v)
  * wait.day(n,v)
  * wait.weeks(n,v)
  * wait.week(n,v)
  * wait.months(n,v)
  * wait.month(n,v)

### install

`npm install --save co-waiter`

### quick examples:

```javascript
var wait = require('co-waiter');

var delayed = wait.minutes(30, "something");
delayed.then(function(value) {
  console.log("this is", value, "30 minutes too late :(");
});
```

```javascript
co(function*() {
  var val = yield wait.sec(3.5, 7);
  return val;
}).then(function(value) {
  console.log(value + "after 3.5 seconds");
});
```

```javascript
somePromise.then(function(val) {
  return wait.until(someDate, val);
}).then(function(x) {
  console.log(x, "took a long time to get here!");
});
```

```javascript
co(function*() {
  var val = yield someAsyncCall();
  val = yield wait.minute(Math.PI, val);
  return val;
}).then(function(myVal) {
  console.log(myVal + " after π seconds");
});
```





_Share & Enjoy_
