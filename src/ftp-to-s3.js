"use strict";

const ftpd = require('ftpd');
const AWS = require('aws-sdk');
const path = require('path');
const mkdirp = require('mkdirp');

//@TODO: move this to configs.json?
const FTP_CONFIG = {
  host: '127.0.0.1',
  port: '2100',
  pasvPortRangeStart: 4000,
  pasvPortRangeEnd: 5000,
  s3path: 'configs-and-scripts/testing',
  ftp_root: '/tmp/ftp-root',
  users: {
    'linkshare-transactions': {
      localDir: 'linkshare-transactions',
      remoteDir: 'linkshare-transactions',
      password: 'e6ddf098-b9b1-47b0-8d72-dbf4967b37b5'
    }
  }
};

function setup(logger, config) {
  config = FTP_CONFIG; // temporary
  const server = new ftpd.FtpServer(config.host, {
    logLevel: 3,
    pasvPortRangeStart: config.pasvPortRangeStart,
    pasvPortRangeEnd: config.pasvPortRangeEnd,
    getInitialCwd: getInitialCwd,
    getRoot: getRoot
  });

  server.on('client:connected', function(conn) {
    logger.info("new connection!");
    console.log(conn);
    let currentUser = {};
    let currentUsername = 'not-a-real-user';

    conn.on('command:user', checkUsername);
    conn.on('command:pass', checkPassword);
    conn.on('file:stor', doUpload);

    function checkUsername(user, ok, fail) {
      logger.info("checking user login "+user);
      if (!config.users[user]) return fail();
      currentUsername = user;
      currentUser = config.users[user];
      ok();
    }

    function checkPassword(pass, ok, fail) {
      if (pass === currentUser.password) {
        logger.info("User " + currentUsername + " has logged in!");
        return ok(currentUsername);
      }
      fail();
    }

    function doUpload(event, data) {
      if (event !== 'close') return;
      const filename = data.file.replace(/^\/+/, '');
      const localPath = path.join(config.ftp_root, currentUser.localDir, filename);
      const remotePath = path.join(config.s3path, currentUser.remoteDir, filename);
      logger.info("new file upload by "+currentUsername+" at "+localPath+", will upload to s3://"+remotePath);
    }
  });
  server.listen(config.port);
  logger.info("FTP server listening on "+config.host+":"+config.port);

  function getUserFTPRoot(username, callback) {
    if (!config.users[username]) return callback(new Error("Not a valid FTP user: "+username));
    const dir = path.resolve(config.ftp_root, config.users[username].localDir);
    mkdirp(dir, function(err) {
      if (err) return callback(err);
      callback(null, dir);
    });
  }

  function getInitialCwd(conn, callback) {
    getUserFTPRoot(conn.username, function(err, dir) {
      if (err) return err;
      return callback(null, '/'); // give the user their own virtual root
    });
  }

  function getRoot(conn, callback) {
    getUserFTPRoot(conn.username, callback);
  }
}

module.exports = setup;
