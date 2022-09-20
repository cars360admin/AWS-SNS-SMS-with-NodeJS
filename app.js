const express = require('express');
const app = express();
require('dotenv').config();
var AWS = require('aws-sdk');
var RedisClient = require('redis');
const cors = require ('cors');
const { response } = require('express');
var request = require("request");



//REDIS CONFIGURATIONS--------------------------------
const client = RedisClient.createClient({url: process.env.AWS_REDIS_URL});
client.connect();

client.on("connect", function () {
  console.log("Redis server connected!");
});

client.on('error', err => console.error('Redis Client Error', err));

const otpRequestHandler = async (number) => {
    let TTLresponse = await checkTTL(number);
    console.log("OTP TTL Check: ", TTLresponse)
    if( TTLresponse == false){
        otp = generateOTP();
        console.log("Generating OTP for", number, ":", otp);
        saveOTP(number, otp);
        smsDispatcher(number,otp);
        console.log("OTP for ", number, " saved as: ", otp);
        return(true);
    } else {
        return(false);
    }
}

const validateOTP = async (number, value) => {
    let otp = await client.GET (number)
    console.log("Matching ", value, " with ", otp, " for ", number);
    if(otp==value){
        return true;
    } else{
        return false;
    }
}

const smsDispatcher = async (number, otp) => {
    console.log('Auth key SMS dispatch request:', number, 'as', otp);
    var options = { method: 'GET',
    url: 'https://api.authkey.io/request',
    qs: 
    { authkey: '1197e95d848e416d',
    mobile: number,
    company: 'CARS360 account. Also',
    otp: otp,
    country_code: '+91',
    sid: 5827 },
    };

    request(options, function (error, response, body) {
    if (error) throw new Error(error);

    console.log(body);
    });
}

const checkTTL = async (number) => {
    let response = await client.TTL(number);
    console.log()
    if (response<275){
        return(false);
    } else {
        return(true);
    }
}

const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000);
}

const saveOTP = async (number, otp) => {
    await client.SET(number, otp);
    await client.EXPIRE(number, 300);
    console.log("Saving OTP for ", number, ": ", otp)
}

// Add headers before the routes are defined
app.use(function (req, res, next) {

    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', process.env.PROD_URL);

    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    res.setHeader('Access-Control-Allow-Credentials', true);

    // Pass to next layer of middleware
    next();
});

app.get('/otp', function (req, res) {

    console.log("\n\n Dispatch OTP request from: ", req.query.number,"\n")
    otpRequestHandler(req.query.number.slice(3),'12345').then( (response) => {
        console.log("Request response: ",response);
        if(response==false){
            console.log('OTP TTL not expired');
            let responseData = {
                status: 'wait'
            }
            res.send(responseData); 
        }
        else {
            console.log('OTP Generated & Send');
            let responseData = {
                status: 'success'
            }
            res.send(responseData); 
        }
    })
  })

app.get('/validate', (req, res) => {

    console.log("\n\nValidate OTP request from: ", req.query.number,"\n")
    validateOTP(req.query.number.slice(3), req.query.value).then( (response) => {
        console.log("Request response: ",response);
        console.log(response);
        if(response==false){
            console.log('OTP Match Failed!');
            let responseData = {
                status: 'failed'
            }
            res.send(responseData);
        }
        else {
            console.log('OTP Match Successful!');
            let responseData = {
                status: 'success'
            }
            res.send(responseData); 
        }
    })

});

app.use(cors({origin: 'http://localhost:3000'}))

app.listen(6738, () => console.log('SMS Service Listening on PORT 6738'))