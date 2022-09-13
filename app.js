const express = require('express');
const app = express();
require('dotenv').config();
var AWS = require('aws-sdk');
var RedisClient = require('redis');
const { response } = require('express');



//REDIS CONFIGURATIONS--------------------------------
const client = RedisClient.createClient({url: 'redis://localhost:6379'});
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
        dispatchOTP(number,otp);
        console.log("OTP for ", number, " saved as: ", otp);
        return(true);
    } else {
        return(false);
    }
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

const dispatchOTP = (number, otp) => {

    var params = {
        Message: "Your OTP for registering with Cars360 is: " + otp,
        PhoneNumber: '+' + number,
        MessageAttributes: {
            'AWS.SNS.SMS.SenderID': {
                'DataType': 'String',
                'StringValue': 'CARS360'
            }
        }
    };

    console.log("Dispatching SMS: \n", params);

    var publishTextPromise = new AWS.SNS({ apiVersion: '2010-03-31' }).publish(params).promise();

    publishTextPromise.then(
        function (data) {
            console.log("SMS Dispatch Response: ", data)
            return true
        }).catch(
            function (err) {
                console.log(JSON.stringify({ Error: err }));
                return false;
        });
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

app.get('/otp', function (req, res) {

    console.log("\n\n Dispatch OTP request from: ", req.query.number,"\n")
    otpRequestHandler(req.query.number).then( (response) => {
        console.log("Request response: ",response);
        if(response==false){
            console.log('OTP TTL not expired');
            res.end('wait');
        }
        else {
            console.log('OTP Generated & Send');
            res.end('true'); 
        }
    })
  })

app.get('/validate', (req, res) => {

    console.log("\n\nValidate OTP request from: ", req.query.number,"\n")
    validateOTP(req.query.number, req.query.value).then( (response) => {
        console.log("Request response: ",response);
        if(response==false){
            console.log('OTP Match Failed!');
            res.end('false');
        }
        else {
            console.log('OTP Match Successful!');
            res.end('true'); 
        }
    })

});

app.listen(6738, () => console.log('SMS Service Listening on PORT 6738'))