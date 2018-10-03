"use strict";

const _ = require('lodash');
const cheerio = require('cheerio');
const co = require('co');
const denodeify = require('denodeify');
const debug = require('debug')('amazon:api-client');
const moment = require('moment');
const neatCsv = require('neat-csv');
const querystring = require('querystring');
const request = require('request-promise');
const url = require('url');
const zlib = require('zlib');
const jsonify = require('../support/jsonify-xml-body');

const gunzip = denodeify(zlib.gunzip);

const API_BASE = 'https://assoc-datafeeds-eu.amazon.com/datafeed/';
const API_USER = 'Ominto';
const API_PASS = 'Bzvagb';

const isReportUrl = /^getReport\?/;
const ary = x => x ? (_.isArray(x) ? x : [x]) : [];

module.exports = setup;

function setup() {
  const client = request.defaults({
    baseUrl: API_BASE,
    simple: true,
    auth: {
      user: API_USER,
      pass: API_PASS,
      sendImmediately: false
    }
  });

  client._getReportList = getReportList.bind(client);
  client._getReportData = getReportData.bind(client);
  client.getCommissionReport = co.wrap(getCommissionReport);

  return client;
}

function* getCommissionReport(type, start, end, format) {
  if (!type) type = 'earnings';
  if (type !== 'earnings' && type !== 'orders') throw new Error("invalid commission report type "+type);
  start = start ? moment(start).toDate() : moment().subtract(7, 'days').toDate();
  end = end ? moment(end).toDate() : new Date();
  if (!format) format = 'xml'; // xml ends up working slightly nicer, though the data's mostly the same

  const client = this;
  const reports = (
    (yield client._getReportList())
      .filter(function(reportInfo) {
        const date = Date.parse(reportInfo.date + ' 00:00:00');
        if (type != reportInfo.type) return false;
        if (date < start) return false;
        if (date > end) return false;
        if (format !== reportInfo.format) return false;
        return true;
      })
      .sort((a,b) => b.date-a.date)
      .map(client._getReportData)
  );
  return _.flatten(yield reports);
}

function parseTsv(data, rec) {
  const lines = data.split(/\r?\n/);
  const garbageTopLine = lines[0];
  debug("Parsing file %s (description: %s)", rec.filename, garbageTopLine);
  const realData = lines.filter(x => !!x.length).slice(1).join("\n");
  const promise = new Promise((resolve,reject) => {
    neatCsv(realData, {separator:'\t'}, function(err, json) {
      if (err) return reject(err);
      if (json.length === 1 && Object.keys(json[0]).filter(x => typeof json[0][x] !== 'undefined').length === 0) {
        return resolve([]);
      }
      resolve(json);
    });
  });
  return promise;
}

function parseXml(data, rec) {
  const promise = jsonify(data).then(function(json) {
    const items = json.Data.Items;
    if (typeof items === 'string') return [];
    if (!items.Item) return [];
    const realItems = ary(items.Item).map(x => x.$);
    return realItems;
  });
  return promise;
}

function getReportData(rec) {
  const parser = rec.format === 'tsv' ? parseTsv : parseXml;
  return this.get({uri:rec.url,encoding:null})
    .then(data => gunzip(data))
    .then(data => data.toString('utf8'))
    .then(data => parser(data, rec));
}

function getReportList() {
  return this.get('listReports').then(html => {
    const $ = cheerio.load(html);
    const links = $("a");
    const urls = [];
    links.each(function(index, link) {
      const reportInfo = parseLinkInfo(link, $);
      if (reportInfo) {
        urls.push(reportInfo);
      }
    });
    return urls;
  });
}

function parseLinkInfo(link, $) {
  const linkUrl = $(link).attr('href');
  if (!linkUrl) return null;
  if (!isReportUrl.test(linkUrl)) return null;

  const query = url.parse(linkUrl).query;
  if (!query) return null;

  const filename = querystring.parse(query).filename;
  if (!filename) return null;

  let matches = filename.match(/^(\w+-\d+)-(\w+)-report-(\d{4})(\d{2})(\d{2})\.(\w{3}).gz/);
  if (!matches) return null;

  let meta = {
    url: linkUrl,
    filename: filename,
    account: matches[1],
    type: matches[2],
    date: [matches[3], matches[4], matches[5]].join('-'),
    format: matches[6]
  };

  return meta;
}

/*
const amaz = setup();
amaz.getCommissionReport('orders').then(x => console.log("x",x)).catch(e => console.error("e", e.stack));
*/
