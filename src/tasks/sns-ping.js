"use strict";

const ARN_TOWN_CLOCK = 'arn:aws:sns:us-east-1:352228731405:townclock';

const denodeify = require('denodeify');

const AWS = require('aws-sdk');
const sns = new AWS.SNS();
const snsPub = denodeify(sns.publish.bind(sns));

function* ping() {
  const params = {
    Message: message(),
    TargetArn: ARN_TOWN_CLOCK
  };
  const result = yield snsPub(params);
  console.log("Got result:", result);
  return result;
}

function message() {
  const timestamp = new Date().toISOString();
  const msg = 'taskbox:ping:'+timestamp;
  return msg;

}

// var params = {
//   Message: 'STRING_VALUE', /* required */
//   MessageAttributes: {
//     someKey: {
//       DataType: 'STRING_VALUE', /* required */
//       BinaryValue: new Buffer('...') || 'STRING_VALUE',
//       StringValue: 'STRING_VALUE'
//     },
//     /* anotherKey: ... */
//   },
//   MessageStructure: 'STRING_VALUE',
//   Subject: 'STRING_VALUE',
//   TargetArn: 'STRING_VALUE',
//   TopicArn: 'STRING_VALUE'
// };
// sns.publish(params, function(err, data) {
//   if (err) console.log(err, err.stack); // an error occurred
//   else     console.log(data);           // successful response
// });

module.exports = {ping: ping};
