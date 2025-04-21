const express = require('express');
const cors = require('cors');
const httpServer = express();
const bodyParser = require('body-parser');

const app = express();
const port = 3000;


const { reset } = require('nodemon');
const { machine } = require('os');

app.use(bodyParser.json({ limit: '50mb' })); // Limit set to 50mb, adjust as needed
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json());
const dosyaOkuma = require('./dosyaOkuma'); 
const planlamaCalisma = require('./controllers/planliCalisanFonksiyon'); 
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
const uretimKalite = require('./routes/uretimKaliteRoutes.js');
const maliyetRoutes = require('./routes/maliyetRoutes.js');
const maliyetRoutests = require('./routes/maliyetRoutests.js');
app.use('/portal_egitim', portal_egitim);
app.use('/', planlamaCalisma);
app.use('/portal_anket', portal_anket);
app.use('/portal_duyuru', portal_duyru);
app.use('/haber', haberRoutes);
app.use('/portal_zimmet', portal_zimmet);
app.use('/portal_task', portal_task);
app.use('/portal_cariYonetim', cariYonetimRoutes);
app.use('/portal_user', userRoutes);
app.use('/uretimKalite', uretimKalite);
app.use('/dosya_okuma', dosyaOkuma);
app.use('/maliyet', maliyetRoutes);
app.use('/maliyets', maliyetRoutests);
app.use('/', optikUretim);
app.use('/', mekanikmRout);
app.use('/', planlamaRout);
app.use('/', bakimRout);
app.use('/', satinAlmaRout);
app.use('/', girisKaliteRout);


app.listen(port, '10.0.0.35', () => {
  console.log(`PLANLAMA SATINAALMA BACKEND Sunucu ${port} numaralı portta çalışıyor.`);
});
