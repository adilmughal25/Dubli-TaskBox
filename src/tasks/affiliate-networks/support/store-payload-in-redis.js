"use strict";

const debug = require('debug')('store-payload-in-redis');
const o_configs = require('../../../../configs');
const uuid = require('node-uuid');
const redis = require('redis');

const redisClient = getRedisClient(o_configs);

function getRedisClient(o_configs) {
  const config = o_configs.redis.writer;
  const client = redis.createClient(config.port, config.host, {auth_pass: config.auth});
  return client;
}

function storePayloadInRedis(value) {
  const _uuid = uuid.v4();
  const key = 'kinesis-event-data:' + _uuid;
  const promise = new Promise(function(resolve, reject) {
    redisClient.setex(key, 86400, value, function(err) {
      if (err) return reject(err);
      debug("["+_uuid+"] stored kinesis payload in redis");
      resolve(_uuid);
    });
  });
  return promise;
}

module.exports = storePayloadInRedis;
