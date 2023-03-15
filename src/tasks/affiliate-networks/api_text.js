const axios = require('axios');

const API_ACCOUNT_NUMBER = 'a16120154459';
const API_BASE_URL = 'https://api.a8.net/as/'+API_ACCOUNT_NUMBER+'/pointreport/';
const API_USERNAME = 'merchants';
const API_PASSWORD = 'Ominto2016';

const res = axios({
    method: 'get',
    url:API_BASE_URL,
    params:{
        user : API_USERNAME,
      pass : API_PASSWORD

    }
}); 
console.log(res);