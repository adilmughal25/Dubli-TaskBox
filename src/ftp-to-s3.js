"use strict";

const ftpd = require('ftpd');
const AWS = require('aws-sdk');
const path = require('path');
const mkdirp = require('mkdirp');
const request = require('request-promise');
const co = require('co');
const fs = require('fs-promise');
const s3 = new AWS.S3();

module.exports = co.wrap(function* (logger, config) {
  if (!config) {
    logger.info("No ftpToS3 config found! No FTP server running!");
    return;
  }
  const IP_ADDR = process.env.NODE_ENV === 'dev' ? '127.0.0.1' : yield request.get('http://169.254.169.254/latest/meta-data/public-ipv4');
  const server = new ftpd.FtpServer(IP_ADDR, {
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
    conn.on('file:stor', co.wrap(doUpload));

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

    function doS3put(bucket, path, streamOrData) {
      return new Promise(function(resolve, reject) {
        s3.putObject({
          Bucket: bucket,
          Key: path,
          Body: streamOrData,
          ACL: 'private'
        }, function(err, result) {
          if (err) return reject(err);
          resolve(result);
        });
      });
    }

    function* doUpload(event, data) {
      if (event !== 'close') return;
      const filename = data.file.replace(/^\/+/, '');
      const localPath = path.join(config.ftp_root, currentUser.localDir, filename);
      const s3bucket = currentUser.s3_bucket;
      const s3path = currentUser.s3_folder + "/" + filename;
      try {
        logger.info("New file uploaded by `"+currentUsername+"`: "+localPath);
        const fileStream = fs.createReadStream(localPath);
        logger.info("Sending "+filename+" to S3 "+s3bucket+":"+s3path);
        const result = yield doS3put(s3bucket, s3path, fileStream);
        logger.info(result, "successfully uploaded!");
        yield fs.unlink(localPath);
        logger.info("deleted file at "+localPath);
        return result;
      } catch (e) {
        logger.error(e, "Error uploading "+filename+" to S3!");
      }
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
});
