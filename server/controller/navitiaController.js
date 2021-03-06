//controller for all Navitia API requests
const axios = require('axios');
const base64 = require('base-64');

// debug ====================================================================
const debug = require('debug');
//debug.enable('navitiaController:*');
const log = debug('navitiaController:log');
const info = debug('navitiaController:info');
const error = debug('navitiaController:error');

let auth;

const setKey = key => {
  auth = 'Basic ' + base64.encode(key);
};

const getIso = (url) => {
  log('navitia', url);
  return axios({
    method: 'get',
    url: url,
    headers: { Authorization: auth }
  })
  .then(response => {
    log('navitia response', response.data);
    return response.data;
  })
 .catch(error => console.error(error));
};

module.exports = {
  getIso, setKey
};
