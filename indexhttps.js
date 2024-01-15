// const https = require('https');
const express = require("express");
const app = express();
const multer = require('multer');
const bodyParser = require("body-parser");
const fs = require('fs');
const request = require('request');
const cors = require("cors");
const { pool } = require('./db');
const nodemailer = require("nodemailer");
const path = require('path');
const transliteration = require('transliteration');
const { finished } = require("nodemailer/lib/xoauth2");
const { url } = require("inspector");
const { Console } = require("console");
const https = require('https');
const axios = require('axios');



//ara sunucu oluşturmak için use oluşturuldu
app.use(cors());

const options = {
  key: fs.readFileSync('./key.pem'),     
  cert: fs.readFileSync('./cert.pem') ,  
  rejectUnauthorized: false,
 
};
app.use(express.json());

app.use(bodyParser.json());


const anketRout = require('./api/anket'); 
const denemeRout = require('./api/deneme'); 
const dokumanRout = require('./api/dokumant'); 
const egitimRout = require('./api/egitim'); 
const genelRout = require('./api/genel'); 
const haberRout = require('./api/haber'); 
const notifRout = require('./api/notif'); 
const userRout = require('./api/user'); 
app.use('/', anketRout);
app.use('/deneme', denemeRout);
app.use('/', dokumanRout);
app.use('/', egitimRout);
app.use('/', genelRout);
app.use('/', haberRout);
app.use('/', notifRout);
app.use('/', userRout);







/* --------------- BACKEND ÇALIŞTIRMA VE PORT AÇMA ---------------*/
// app.listen(3212, '10.0.0.35', async () => {
//   console.log("3212 numaralı port Back end için ayrıldı")

// });
const PORT = 3213;
const HOST = "10.0.0.35";
const server = https.createServer(options, app);
server.listen(PORT, HOST, () => {
  console.log(`HTTPS server running on https://${HOST}:${PORT}`);
});