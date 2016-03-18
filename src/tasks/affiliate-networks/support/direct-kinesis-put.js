"use strict";

const o_configs = require('../../../../configs');
const debug = require('debug')('direct-kinesis-put');
const uuid = require('node-uuid');
const denodeify = require('denodeify');
const utils = require('ominto-utils');
const AWS = require('aws-sdk');

const kinesis = new AWS.Kinesis({
  region: o_configs.aws.default_region
});

const env = o_configs.env;

if (env === 'test') { //TODO Update for env.
  kinesis.$putRecord = () => new Promise(resolve => resolve());
} else {
  kinesis.$putRecord = denodeify(kinesis.putRecord.bind(kinesis));
}

function directKinesisPut(s_streamName, s_streamType, o_payload, o_flags, s_taskName) {
  const a_trigger = utils.createTrigger(null, null, null, 'taskbox', s_taskName, null, null);
  const envelope = utils.createEnvelope(s_streamType, {}, o_payload, o_flags, a_trigger);
  const stream = env + "-" + s_streamName;
  debug("Sending kinesis event %s -> %s (%s)", s_streamName, s_streamType, s_taskName, o_configs);
  return kinesis.$putRecord({
    StreamName: stream,
    PartitionKey: envelope.id || uuid.v4(),
    Data: JSON.stringify(envelope)
  });
}

module.exports = directKinesisPut;
