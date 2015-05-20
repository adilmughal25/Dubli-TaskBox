(function() {
  "use strict";

  var FtpClient = require('ftp');
  var AWS = require('aws-sdk');
    AWS.config.region = 'us-east-1';

  var impactRadiusFilesToGet = [];
  var impactRadiusFilesLastProcessed = {};
  var dirsProcessed = 0;

  var connectionCreds = {
    host: "products.impactradius.com",
    user: "ps-ftp_155520",
    password: "EtQQMmRVjb"
  };
  
  function getImpactRadiusFtp() {
    var ftp = new FtpClient();
    ftp.on("ready", function() {
      getFilesList("/", ftp);
    });
    ftp.connect(connectionCreds);
  }

  function getFilesList(path, ftp) {
    dirsProcessed++;
    ftp.list(path, true, function(err, list) {
      list.forEach(function(item) {
        if(item.type == 'd') {
          getFilesList(path + item.name, ftp);
        } else if (item.type == '-' && item.name.indexOf("_IR.csv.gz") != -1) {
          //OPTION - store this shit in redis as a hash...  but honestly, if the task box crashed
          //might as well give it all a retry... on the lambdas we can more safely access redis via
          //data lib, and as such can store a file md5 type hash there and avoid the actually expensive
          //processing.
          var itemDate = new Date(item.date);
          if(!impactRadiusFilesLastProcessed[item.name] || impactRadiusFilesLastProcessed[item.name] < itemDate) {
            impactRadiusFilesToGet.push(path + "/" + item.name);
            impactRadiusFilesLastProcessed[item.name] = itemDate;
          }
        }
      });
      dirsProcessed--;
      if(dirsProcessed <= 0) {
        ftp.end();
        getImpactRadiusIndivFiles();
      }
    });
  }

  
  function getImpactRadiusIndivFiles() {
    console.log("Starting Impact Radius Indiv Files", impactRadiusFilesToGet)
    var iter = makeIterator(impactRadiusFilesToGet);
    doIteration(iter);
  }

  //This is hideously needlessly complex... but since the damn FTP lib crashed if I just queued them all up
  //and also the stupid thing can't have to many connections open at a time... lame ass server
  //so need to do them one by one kinda synchronously.
  function makeIterator(array){
    var nextIndex = 0;
    return {
      next: function(){
        return nextIndex < array.length ?
          {value: array[nextIndex++], done: false} :
          {done: true};
      }
    }
  }

  function doIteration(iter) {
    var next = iter.next();
    var path = next.value;

    console.log("PATH", path)
    if(path) {
      getImpactRadiusIndivFile(path, function() {
        doIteration(iter);
      });
    } else {
      console.log("Finished Impact Radius Indiv Files", impactRadiusFilesToGet);
      impactRadiusFilesToGet = [];
    }
  }

  function getImpactRadiusIndivFile(path, next) {
    var ftp = new FtpClient();
    ftp.on("ready", function() {
      getIndivFile(path, ftp, next);
    });
    ftp.connect(connectionCreds);
  }

  function getIndivFile(path, ftp, next) {
    ftp.get(path, true, function(err, data) {
      if (err) throw err;
      data.once('close', function() {
        ftp.end();
      });
      var s3obj = new AWS.S3({params: {Bucket: 'automation-352228731405', Key: 'impactradius/productftp' + path}});
      s3obj.upload({Body: data}).on('httpUploadProgress', function(evt) {

      }).send(function(err, data) { 
        next();
      });
    });   
  }

  module.exports = getImpactRadiusFtp;

})();
