//controller for all Google API requests
//api guide https://developers.google.com/maps/documentation/javascript/places#place_search_requests
//keyword guide https://developers.google.com/places/supported_types
const axios = require('axios');
//1609 meters = 1 mile
//4827 meters = 3 miles

// debug ====================================================================
const debug = require('debug');
//debug.enable('placesController:*');
const log = debug('placesController:log');
const info = debug('placesController:info');
const error = debug('placesController:error');

const url = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json?&radius=1609';
const radar = 'https://maps.googleapis.com/maps/api/place/radarsearch/json?';
const distance = 'https://maps.googleapis.com/maps/api/distancematrix/json?';

const key = process.env.GOOGLE_KEY || GOOGLE_KEY;

//how to use google places nearby
const getData = (place, lat, long) => {
  lat = lat || 37.7825177;
  long = long || -122.4106772;
  return axios({
    method: 'get',
    url: `${url}&type=${place}&location=${lat},${long}&key=${key}`
  })
  .then(response => response.data)
  .catch(error => console.error(error));
};

//how to use google radar search -searching in a 50 mile area
const getRadarData = (place, lat, long, radius) => {
  lat = lat || 37.7825177;
  long = long || -122.4106772;
  radius = radius || 50000;
  return axios({
    method: 'get',
    url: `${radar}location=${lat},${long}&radius=${radius}&type=${place}&key=${key}` // FIXME: distance needs to be sent by client
  })
  .then(response => {
    //log('getRadarData response', response.data);
    return response.data;
  })
  .catch(error => console.error(error));
};

//converting client mode of transportation query to google api mode terms
const modeKeys = {
  car: 'driving',
  bike: 'cycling',
  walk: 'walking',
};
//google distance matrix 
const getDistanceData = (arrayOfPlaces, lat, long, mode) => {
  
  lat = lat || 37.7825177;
  long = long || -122.4106772;
  mode = modeKeys[mode] || 'transit';
  let destinationString = 'place_id:';
  for (let i = 0; i < arrayOfPlaces.length; i++) {
    destinationString += arrayOfPlaces[i];
    if (i !== arrayOfPlaces.length - 1 ) {
      destinationString += '|place_id:';
    }
  }
  log('getDistanceData destinationString', destinationString);

  return axios({
    method: 'get',
    url: `https://maps.googleapis.com/maps/api/distancematrix/json?units=imperial&origins=${lat},${long}&destinations=${destinationString}&key=${key}&mode=${mode}&departure_time=now`
  })
  .then(response => {
    log('getDistanceData response', response.data);
    return response.data;
  })
  .catch(error => console.error(error));
};

const getGoogleData = (req, res, keyword) => {
  lat = req.query.lat || 37.7825177;
  long = req.query.long || -122.4106772;
  radius = req.query.radius || 50000;
  mode = req.query.mode || 'transit'; 
  //take results of nearby search and get their place ids
  let idList = [];
  let coordinates = [];     
  //holder for response object
  let result = [];
  //to iterate over results
  let counter = 0;      
  getRadarData(keyword, lat, long, radius)
  .then(data => {
    if (!data.results.length) {
      console.error(`No google places data found for ${keyword}`);
      res.sendStatus(500).send({error: 'no data found by Google'});
      return;
    }
    log(data.results.length);
    log(data);
    data.results.forEach(place => {
      idList.push(place.place_id);
      coordinates.push(place.geometry.location);
    });
    //can go up to 100 per call for distance, but then we'll hit rate limits 
    //currently i'm under the impression that we can do 200 quickly, which leads to 
    //50 places per "button"/isochrone change
    let shortList = idList.splice(0, 50); 
    log(shortList);
    getDistanceData(shortList, lat, long, mode)
    .then(data => {
      if (data.error_message) {
        //this will trigger if we hit the rate limit TIME or DAILY limit
        console.error(`Not able to get distance data for ${keyword} [${data.error_message}]`);
        //to do: in case of api limits, we need to find another api to list the place names or poi's
      } else {
        data.destination_addresses.forEach(place => {
          place = place.split('').splice(0, place.indexOf(',')).join('');
          result.push({
            'name': place, 
            'time': data.rows[0].elements[counter].duration.text,
            'location': coordinates[counter],
            'distance': data.rows[0].elements[counter].distance.text,
            'metric distance': data.rows[0].elements[counter].distance.value 
          });
          counter++;
        });
        // console.log(result);
        res.status(200).json(result);
      }
    })
    .catch(err => {
      console.error(`Not able to get distance data for ${keyword} [${err}]`);
      res.sendStatus(500).send({error: `no distance data found for ${keyword}`});
    });
  })
  .catch(err => {
    console.error(err);
    res.sendStatus(500).send({error: 'catch error, no response from API, check server code'});
  });
};

module.exports = {
  getData, getRadarData, getDistanceData, getGoogleData
};
