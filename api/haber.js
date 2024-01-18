const multer = require('multer');

const express = require('express');
const router = express.Router();
const axios = require('axios');
const nodemailer = require("nodemailer");
const cors = require('cors');
const request = require('request')
router.use(cors());
const { pool } = require('../db');
const path = require('path');

const transliteration = require('transliteration');




const storage = multer.diskStorage({

    destination: (req, file, callBack) => {
  
  
  
  
      const destinationPath = path.join(__dirname, '..', '..', '..', '..','..', '..', 'wamp64', 'www', 'assets', 'images', 'haber');
      // const destinationPath = path.join(__dirname, '..', 'front end', 'front end','src', 'assets', 'images', 'haber');
      console.log("burayı tamamladı ", destinationPath)
      callBack(null, destinationPath)
    },
    filename: (req, file, callBack) => {
      const bugun = new Date();
      const tarihDamgasi = bugun.toISOString().replace(/[:.]/g, '').substring(0, 10); // Sadece '2023-08-25' bölümü
      const originalnameWithoutExtension = path.parse(file.originalname).name;
      const transliteratedName = transliteration.slugify(originalnameWithoutExtension, { lowercase: false });
      callBack(null, `haberler_${tarihDamgasi}${transliteratedName}${path.extname(file.originalname)}`);
  
    }
  
  
  })
  
const upload = multer({ storage: storage })


router.post('/multipleFiles', upload.array('files'), async (req, res, next) => {
    await pool.connect();
    const poolRequest = await pool.request();
  
    const files = req.files;
    const selectPDF = files.filter(veri => veri.originalname.endsWith('.pdf'));
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif'];
  
    const selectimg = files.filter(veri => {
      const lowerCaseName = veri.originalname.toLowerCase();
      return allowedExtensions.some(ext => lowerCaseName.endsWith(ext));
    });
  
    const aciklama = req.body.aciklama;
    const baslik = req.body.baslik;
    const photoUrl = `assets/images/haber/${selectimg[0].filename}`; // Dosya yolu
    const pdfUrl = `assets/images/haber/${selectPDF[0].filename}`; // Dosya yolu
  const birim = req.body.birim
    if (!files) {
      const error = new Error('No File');
      error.httpStatusCode = 400;
      return next(error);
    }
    const bugun = new Date();
      const tarihDamgasi = bugun.toISOString().replace(/[:.]/g, '').substring(0, 10);
      let data1 = tarihDamgasi
      let data2 = tarihDamgasi
  console.log(data1)
    try {
  
      // Dosya daha önce yüklenmemişse, dosyayı kaydedin ve veritabanına ekleyin
      const postUserNot = await poolRequest.query(`INSERT INTO haber (header, description, photo,pdf_url,isactive,isdelete,created_date,departman) OUTPUT INSERTED.id VALUES('${baslik}', '${aciklama}', '${photoUrl}', '${pdfUrl}','true','false','${data1}',${birim})`);
  
      res.send({ status: 'ok' });
  
    } catch (error) {
      res.send({ status: 400 });
    }
  });
  router.post('/hizliErisimGuncelle', upload.array('files'), async (req, res, next) => {
    try {
      await pool.connect();
      const poolRequest = await pool.request();
      const files = req.files;
      const menu_id = req.body.id;
      const photoUrl = `assets/images/haber/${files[0].filename}`; // Dosya yolu
  
      if (!files) {
        const error = new Error('No File');
        error.httpStatusCode = 400;
        return next(error);
      }
  
      // SQL sorgusunu sorgu parametreleriyle düzenle
      const query = 'UPDATE hizlimenu SET url = @photoUrl WHERE id = @menu_id';
      await poolRequest.input('photoUrl', photoUrl);
      await poolRequest.input('menu_id', menu_id);
  
      // Sorguyu çalıştır
      await poolRequest.query(query);
  
      res.send({ status: 'ok' });
    } catch (error) {
      console.error(error);
      res.status(500).send({ status: 'error' });
    }
  });
  router.post('/hizliErisimEkle', upload.array('files'), async (req, res, next) => {
  
    const files = req.files;
    const menu_id = req.body.menu_id;
    const photoUrl = `assets/images/haber/${files[0].filename}`; // Dosya yolu
  
    if (!files) {
      const error = new Error('No File');
      error.httpStatusCode = 400;
      return next(error);
    }
  
  
    try {
      await pool.connect();
      const poolRequest = await pool.request();
      // Dosya daha önce yüklenmemişse, dosyayı kaydedin ve veritabanına ekleyin
      const postUserNot = await poolRequest.query(`INSERT INTO hizlimenu (name) VALUES('YEMEK LİSTESİ')`);
  
      res.send({ status: 'ok', });
  
    } catch (error) {
      res.send({ status: 400 });
    }
  });
  router.post('/gethizliErisim', async (req, res, next) => {
    await pool.connect();
    const poolRequest = await pool.request();
  
    let id = req.body.id
  
  
    try {
  
      // Dosya daha önce yüklenmemişse, dosyayı kaydedin ve veritabanına ekleyin
      const postUserNot = await poolRequest.query(`SELECT * FROM hizlimenu WHERE id = ${id}`);
      let url = postUserNot.recordsets[0]
      res.send({
        status: 'ok',
        data: url[0].url
      });
  
    } catch (error) {
      res.send({ status: 400 });
    }
  });
  router.post('/haberGuncelle', upload.array('files'), async (req, res, next) => {
    const files = req.files;
    const aciklama = req.body.aciklama;
    const baslik = req.body.baslik;
    const id = req.body.id;
    let created_date = new Date().toLocaleDateString('tr-TR');
  
    try {
      await pool.connect();
      const poolRequest = await pool.request();
  
      // Mevcut resim yolunu alın
      const existingPhotoQuery = await poolRequest.query(`SELECT photo FROM haber WHERE id = '${id}'`);
      const existingPhotoUrl = existingPhotoQuery.recordset[0].photo;
  
      let photoUrl = existingPhotoUrl; // Varsayılan olarak mevcut resim yolunu kullan
  
      if (files && files.length > 0) { // Dosya seçildiyse
        photoUrl = `assets/images/haber/${files[0].filename}`;
      }
  
      // Başlık ve açıklamayı güncelle
      const updateQuery = `UPDATE haber SET header = '${baslik}', description = '${aciklama}', photo = '${photoUrl}' WHERE id = '${id}'`;
      await poolRequest.query(updateQuery);
  
      res.send({ status: 'ok' });
    } catch (error) {
      res.status(400).send({ status: 'error' });
    }
  });
  
  router.post("/getDetailHaber", async (req, res) => {
    try {
      let id = req.body.id
  
  
      await pool.connect()
      const poolRequest = await pool.request();
      const postUserNot = await poolRequest.query(`SELECT * FROM haberPhoto Where haber_id =${id} `);
      if (postUserNot.rowsAffected == 0) {
        res.json({
          "status": 400,
          postUserNot: []
        })
      } else {
  
        res.json({
          "status": 200,
          postUserNot: postUserNot.recordset
        })
  
  
      }
    } catch (err) {
      console.error(err.message);
    }
  });
  router.post("/haberLike", async (req, res) => {
    try {
      let haber_id = req.body.haber_id
      let user_id = req.body.user_id
  
  
      await pool.connect()
      const poolRequest = await pool.request();
      const postUserNot = await poolRequest.query(`SELECT * FROM haber Where id =${haber_id} `);
      let totalLike = postUserNot.recordset[0].total_like
      if (totalLike == null) {
        totalLike = 1
      } else {
        totalLike = totalLike + 1
      }
      try {
        const putLike = await poolRequest.query(`UPDATE haber SET total_like = ${totalLike} WHERE id = ${haber_id} `);
  
      } catch (error) {
        console.error(error)
      }
      try {
        const postLike = await poolRequest.query(`INSERT INTO haber_like (user_id,haber_id) VALUES(${user_id},${haber_id})`)
      } catch (error) {
        console.error(error)
      }
  
  
      if (postUserNot.rowsAffected == 0) {
        res.json({
          "status": 400,
          postUserNot: []
        })
      } else {
  
        res.json({
          "status": 200,
          postUserNot: totalLike
        })
  
  
      }
    } catch (err) {
      console.error(err.message);
    }
  });
  router.post("/getDepartmanHaber", async (req, res) => {
    try {
      const departman = req.body.departman
  
      await pool.connect()
      const poolRequest = await pool.request();
      const postUserNot = await poolRequest.query(`SELECT * FROM haber WHERE birim = '${departman}' ORDER BY id DESC`);
  
      if (postUserNot.rowsAffected == 0) {
        res.json({
          "status": 400,
          postUserNot: []
        })
      } else {
  
        res.json({
          "status": 200,
          postUserNot: postUserNot.recordset
        })
  
  
      }
    } catch (err) {
      console.error(err.message);
    }
  });
  router.post("/getHaber", async (req, res) => {
    try {
      console.log("buraya gelmesi gerekiyor ",req.body.birim)
  const departman = req.body.birim 
      await pool.connect()
      const poolRequest = await pool.request();
      const postUserNot = await poolRequest.query(`SELECT * FROM haber where isdelete = 0 AND departman = ${departman} ORDER BY id DESC`);
  
      if (postUserNot.rowsAffected == 0) {
        res.json({
          "status": 400,
          postUserNot: []
        })
      } else {
  
        res.json({
          "status": 200,
          postUserNot: postUserNot.recordset
        })
  
  
      }
    } catch (err) {
      console.error(err.message);
    }
  });
  router.post("/silHaber", async (req, res) => {
    try {
      let id = req.body.id
  
  
      await pool.connect()
      const poolRequest = await pool.request();
      const postUserNot = await poolRequest.query(`UPDATE haber SET isdelete = 1 WHERE id = ${id}`);
      if (postUserNot.rowsAffected == 0) {
        res.json({
          "status": 400,
          postUserNot: []
        })
      } else {
  
        res.json({
          "status": 200,
          postUserNot: postUserNot.recordset
        })
  
  
      }
    } catch (err) {
      console.error(err.message);
    }
  });
  
  router.post("/haberSingle", async (req, res) => {
    try {
      let id = req.body.id
  
      await pool.connect()
      const poolRequest = await pool.request();
  
  
      const postUserNot = await poolRequest.query(`Select * from haber where id = '${id}'`);
      if (postUserNot.rowsAffected == 0) {
        res.json({
          "status": 400,
          postUserNot: []
        })
      } else {
  
        res.json({
          "status": 200,
          postUserNot: postUserNot.recordset
        })
  
  
      }
    } catch (err) {
      console.error(err.message);
    }
  });
  

  module.exports = router;