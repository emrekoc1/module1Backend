const express = require('express');
const cors = require('cors');
const httpServer = express();
const app = express();
const port = 3001;


const { reset } = require('nodemon');
const { machine } = require('os');
app.use(express.json());

const https = require('https');
const fs = require('fs');

const options = {
  key: fs.readFileSync('./key.pem'),     
  cert: fs.readFileSync('./cert.pem')    
};
app.use(express.json());
const dosyaOkuma = require('./dosyaOkuma'); 
const planlamaRout = require('./planlama'); 
const bakimRout = require('./bakim'); 
const mekanikmRout = require('./mekanik'); 
const satinAlmaRout = require('./satinalma'); 
const girisKaliteRout = require('./girisKalite'); 
const optikUretim = require('./optikUretim'); 
const portal_task = require('./portal_task'); 
const portal_anket = require('./routes/portalAnketRoutes'); 
const portal_duyru = require('./routes/portalDuyruRoutes'); 
const portal_egitim = require('./routes/portalEgitimRoutes'); 
const portal_zimmet = require('./routes/portalZimmetRoutes'); 
const haberRoutes = require('./routes/portalHaberRoutes');
const cariYonetimRoutes = require('./routes/portalCariYonetimRoutes');
const userRoutes = require('./routes/portalUserRouters');
app.use('/portal_egitim', portal_egitim);
app.use('/portal_anket', portal_anket);
app.use('/portal_duyuru', portal_duyru);
app.use('/haber', haberRoutes);
app.use('/portal_zimmet', portal_zimmet);
app.use('/portal_task', portal_task);
app.use('/portal_cariYonetim', cariYonetimRoutes);
app.use('/portal_user', userRoutes);
app.use('/dosya_okuma', dosyaOkuma);
app.use('/', optikUretim);
app.use('/', mekanikmRout);
app.use('/', planlamaRout);
app.use('/', bakimRout);
app.use('/', satinAlmaRout);
app.use('/', girisKaliteRout);


// İlk çalıştırmayı anında yapmak için:


// app.listen(3001, '10.0.0.35', () => {
//   console.log(`PLANLAMA SATINAALMA BACKEND Sunucu ${port} numaralı portta çalışıyor.`);
// });
const server = https.createServer(options, app);
server.listen(port, '10.0.0.35', () => {
  console.log('HTTPS server running on port 3000');
});
