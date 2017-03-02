const TaskMatic = require('taskmatic');
const fs = require('fs');
const moment = require('moment');
const lodash = require('lodash');
const config = require('./../../../configs.json').notification;
const nodemailer = require('nodemailer');
const smtpConfig = config.smtpConfig;
const mkdirp = require('mkdirp');

const emailTransporter = nodemailer.createTransport(smtpConfig);

const sendEmail = function() {
    const mailOptions = {
      from: 'nvalluri@ominto.com',
      to: 'nvalluri@ominto.com',
      subject: 'Hello ',
      html: '<b>Hello world </b>'
    };
    emailTransporter.sendMail(mailOptions, function(error, info){
        if(error){
            return console.log(error);
        }
        console.log('Message sent: ' + info.response);
    });

}

const generateAndSendEmail = function (data) {
    const transformedData = lodash.map(data, (item) => {
      item.lastErrorTruc = item.lastError && item.lastError.substring(0, 40);
      item.lastEnd = moment(item.lastEnd).fromNow();
      item.next = moment(item.next).fromNow();
      return item;
    });
    const date = moment().format().split('T')[0];
    const filePath = config.path_data + '/data-'+ date +'.js';
    const dataContent = "var data = " + JSON.stringify(transformedData);
    mkdirp.sync(config.path_data);
    fs.writeFileSync(filePath, dataContent, 'utf-8');
    //sendEmail();
    return dataContent;

}

module.exports.generateP = function (tasker) {
    return tasker.report().then(generateAndSendEmail);
}

module.exports.generate = function *(tasker) {
    const report = yield tasker.report();
    return generateAndSendEmail(report);
}