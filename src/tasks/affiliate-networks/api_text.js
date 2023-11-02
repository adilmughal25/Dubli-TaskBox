// /*const axios = require('axios');

// const API_ACCOUNT_NUMBER = 'a16120154459';
// const API_BASE_URL = 'https://api.a8.net/as/'+API_ACCOUNT_NUMBER+'/pointreport/';
// const API_USERNAME = 'merchants';
// const API_PASSWORD = 'Ominto2016';

// /*const res = axios({
//     method: 'get',
    
//     params:{
//         user : API_USERNAME,
//       pass : API_PASSWORD

//     }
// }); 
// console.log(res);*/
// axios.get({
//   url:API_BASE_URL,
//   params:{
//     user : API_USERNAME,
//       pass : API_PASSWORD
//   }
// })
//   .then(response => {
//     console.log(response.data);
//   })
//   .catch(error => {
//     console.log(error);
//   });

const axios = require('axios');

const API_ACCOUNT_NUMBER = 'a16120154459';
const API_BASE_URL = 'https://api.a8.net/as/'+API_ACCOUNT_NUMBER+'/pointreport/';
const API_USERNAME = 'merchants';
const API_PASSWORD = 'Ominto2016';

axios({
  method: 'get',
  url: API_BASE_URL,
  params: {
    user: API_USERNAME,
    pass: API_PASSWORD
  }
})
  .then(function (response) {
    console.log('awais');
    console.log(response.data);
  })
  .catch(function (error) {
    console.log(error);
  });