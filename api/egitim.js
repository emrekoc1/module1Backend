

  const multer = require('multer');

const express = require('express');
const router = express.Router();
const axios = require('axios');
const nodemailer = require("nodemailer");
const cors = require('cors');
const request = require('request')
router.use(cors());
const { pool } = require('../db');


const storage2 = multer.diskStorage({

    destination: (req, file, callBack) => {
  
  
  
  
      // const destinationPath = path.join(__dirname, '..', '..', '..', '..', '..', 'wamp64', 'www', 'assets', 'images', 'haber');
      const destinationPath = path.join(__dirname, '..','..', 'New Folder', 'proje','src', 'assets', 'images', 'haber');
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
const upload2 = multer({ storage: storage2 })

router.post('/egitimPost', upload2.array('files'), async (req, res, next) => {

    const files = req.files;
    const aciklama = req.body.aciklama;
    const baslik = req.body.baslik;
    const kategori = req.body.kategori;
  
    let created_date = new Date().toLocaleDateString('tr-TR')
  
    if (!files) {
      const error = new Error('No File')
      error.httpStatusCode = 400
      return next(error)
    }
    let photoUrl = `assets\\images\\haber\\${files[0].filename}`
  
    await pool.connect()
    const poolRequest = await pool.request();
    const postUserNot = await poolRequest.query(`INSERT INTO egitim (name,owner,video) OUTPUT INSERTED.id VALUES('${baslik}','${aciklama}','${photoUrl}')`)
    let egitim_id = postUserNot.recordset[0].id
    const postUserNot2 = await poolRequest.query(`INSERT INTO egitimDetail (eğitim_id,name,video) VALUES('${egitim_id}','${baslik}','${photoUrl}')`)
    res.send({ status: 'ok' });
  })
  
    router.post('/deleteEgitimDetail',  async (req, res, next) => {
    await pool.connect();
    const poolRequest = await pool.request();
  
    const video_id = req.body.video_id;
  
    try {
  
        const existingFile = await poolRequest.query(`DELETE  FROM egitimDetail WHERE id = ${video_id} `);
        const fileCount = existingFile.recordset;
      
      
   
      res.send({ status: 'ok',fileCount:fileCount });
    } catch (error) {
      res.send({ status: 400 });
    }
  
  })
  
  router.post('/egitimIcerikPost', upload2.array('files'), async (req, res, next) => {
    await pool.connect();
    const poolRequest = await pool.request();
    console.log("data buraya geldimi")
  console.log(req.body)
    const files2 = req.files;
  
    const name2 = req.body.baslik;
    const egitim_id = req.body.egitim_id
  
  
  
    if (!files2) {
      const error = new Error('No File')
      error.httpStatusCode = 400
      return next(error)
    }
    try {
      let i = 0
      // Dosyanın daha önce yüklenip yüklenmediğini kontrol etmek için sorgu
      files2.forEach(async items => {
        const photoUrl = `assets\\images\\haber\\${items.filename}`
        let name = i + "-" + name2
        const existingFile = await poolRequest.query(`SELECT COUNT(*) AS count FROM egitim WHERE video = '${photoUrl}'`);
        const fileCount = existingFile.recordset[0].count;
        const existingFile2 = await poolRequest.query(`SELECT COUNT(*) AS count FROM egitimDetail WHERE video = '${photoUrl}'`);
        const fileCount2 = existingFile.recordset[0].count;
        if (fileCount === 0 && fileCount2 === 0) {
          const postUserNot = await poolRequest.query(`INSERT INTO egitimDetail (eğitim_id,name,video) VALUES('${egitim_id}','${name}','${photoUrl}')`)
  
        } else {
          const postUserNot = await poolRequest.query(`INSERT INTO egitimDetail (eğitim_id,name,video) VALUES('${egitim_id}','${name}','${photoUrl}')`)
  
        }
      })
      res.send({ status: 'ok' });
    } catch (error) {
      res.send({ status: 400 });
    }
  
  })
  router.post('/egitimIcerikPutVideosuz', async (req, res, next) => {
    await pool.connect();
    const poolRequest = await pool.request();
  console.log(req.body)
    const name2 = req.body.baslik;
    const egitim_id = req.body.video_id
  
  
  
    try {
     
      
     
          const postUserNot = await poolRequest.query(`UPDATE egitimDetail SET Name = '${name2}' WHERE  id = ${egitim_id}`)
  
   
      res.send({ status: 'ok' });
    } catch (error) {
      res.send({ status: 400 });
    }
  
  })
  router.post('/egitimIcerikPut', upload2.array('files'), async (req, res, next) => {
    await pool.connect();
    const poolRequest = await pool.request();
    
  
    const files2 = req.files;
  const videoeklimi = req.body.videoeksiz
    const name2 = req.body.baslik;
    const egitim_id = req.body.video_id
  
  
  
    if (!files2) {
      const error = new Error('No File')
      error.httpStatusCode = 400
      return next(error)
    }
    try {
      let i = 0
      // Dosyanın daha önce yüklenip yüklenmediğini kontrol etmek için sorgu
      files2.forEach(async items => {
        const photoUrl = `assets\\images\\haber\\${items.filename}`
        let name = i + "-" + name2
   
      
          const postUserNot = await poolRequest.query(`UPDATE egitimDetail SET Name = '${name}',Video =' ${photoUrl}' WHERE  id = ${egitim_id}`)
  
       
      })
      res.send({ status: 'ok' });
    } catch (error) {
      res.send({ status: 400 });
    }
  
  })
  
  router.post("/getUserEgitimDetail", async (req, res) => {
    try {
      const { user_id, egitim_id } = req.body;
      console.log(req.body);
      await pool.connect()
      const poolRequest = await pool.request();
      const getDetailKategori = await poolRequest.query(`SELECT * FROM egitimDetail ed WHERE ed.eğitim_id = ${egitim_id}`);
      const dataBasla = getDetailKategori.recordset;
      
      const dataSorgu = await Promise.all(dataBasla.map(async (element) => {
        const getUserData = await poolRequest.query(`SELECT * FROM egitim_user eu WHERE eu.user_id = ${user_id} AND eu.kategori_id = ${egitim_id} AND video_id = ${element.id}`);
        const dataUser = getUserData.recordset;
        
        if (getUserData.rowsAffected == 0) {
          return {
            user_id: user_id,
            kategori_id: element.Eğitim_id,
            video_id: element.id,
            Video: element.Video,
            Name: element.Name,
            is_end: false,
          };
        } else {
          return {
            user_id: dataUser[0].user_id,
            kategori_id: element.Eğitim_id,
            video_id: element.id,
            Video: element.Video,
            Name: element.Name,
            is_end: dataUser[0].is_end,
          };
        }
      }));
      
      if (getDetailKategori.rowsAffected == 0) {
        res.json({
          "status": 400,
          getDetailKategori: []
        });
      } else {
        res.json({
          "status": 200,
          postUserNot: dataSorgu,
        });
      }
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ error: err.message });
    }
  });
  router.post("/posttUserEgitimDetail", async (req, res) => {
    try {
  
      const { user_id, kategori_id, video_id, egitim_suresi, bitirilen_sure } = req.body
      console.log(req.body)
      await pool.connect()
      const poolRequest = await pool.request();
      const postUserNot = await poolRequest.query(`select * from egitim_user where user_id = ${user_id} AND video_id = ${video_id}`);
  console.log(postUserNot.recordset)
      const bugun = new Date();
      const tarihDamgasi = bugun.toISOString().replace(/[:.]/g, '').substring(0, 10);
      let data1 = tarihDamgasi
      let data2 = tarihDamgasi
  
      if (postUserNot.rowsAffected == 0) {
        //ınsert işlemi yapılacak
        let status = (egitim_suresi - bitirilen_sure) > 0 ? 1 : 2
        const dataInsert = await poolRequest.query(`INSERT INTO egitim_user (user_id,kategori_id,video_id,created_date,updated_date,status,is_end,egitim_suresi,bitirilen_sure) VALUES (${user_id},${kategori_id},${video_id},${data1},${data2},${status},${status = 2 ? 1 : 0},${egitim_suresi},${bitirilen_sure})`)
        if (dataInsert.rowsAffected == 0) {
          res.json({
            "status": 400,
            postUserNot: []
          })
        } else {
          res.json({
            "status": 200,
            postUserNot: dataInsert.recordset
          })
        }
      } else {
        let status = (egitim_suresi - bitirilen_sure) > 0 ? 1 : 2
        let created_date = postUserNot.recordset[0].created_date
        const dataUpdate = await poolRequest.query(`UPDATE egitim_user SET status = ${status},updated_date = ${data2}, is_end =${status = 2 ? 1 : 0} WHERE video_id = ${video_id} AND user_id = ${user_id}`)
  
        res.json({
          "status": 200,
          postUserNot: postUserNot.recordset
        })
  
  
      }
    } catch (err) {
      console.error(err.message);
    }
  });
  router.post("/getEgitim", async (req, res) => {
    try {
  
  
  
      await pool.connect()
      const poolRequest = await pool.request();
      const postUserNot = await poolRequest.query(`SELECT * FROM egitim`);
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
  router.post("/getEgitimDetail", async (req, res) => {
    const user_id = req.body.user
    const egitim_id = req.body.egitim_id
  
    try {
  
  
  
      await pool.connect()
      const poolRequest = await pool.request();
      const postUserNot = await poolRequest.query(`SELECT * FROM egitimDetail WHERE eğitim_id = ${egitim_id}`);
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
  router.post("/egitimDelete", async (req, res) => {
  
    const id = req.body.id
    try {
  
  
      await pool.connect()
      const poolRequest = await pool.request();
  
      const postUserNot = await poolRequest.query(`DELETE FROM egitim Where id = ${id}`)
      if (postUserNot.rowsAffected == 0) {
        res.json({
          "status": 400,
          postUserNot: []
        })
      } else {
  
        res.json({
          "status": 200,
          postUserNot: postUserNot.rowsAffected
        })
  
  
      }
    } catch (err) {
      console.error(err.message);
    }
  });
  router.post('/egitimGuncelle', upload2.array('files'), async (req, res, next) => {
    const files = req.files;
    const id = req.body.id;
    const baslik = req.body.baslik
  
  
    try {
      await pool.connect();
      const poolRequest = await pool.request();
  
      // Mevcut video yolunu alın
      const existingVideoQuery = await poolRequest.query(`SELECT Video FROM egitim WHERE id = '${id}'`);
      const existingVideoUrl = existingVideoQuery.recordset[0].Video;
  
      let videoUrl = existingVideoUrl; // Varsayılan olarak mevcut video yolunu kullan
  
      if (files && files.length > 0) { // Dosya seçildiyse
        videoUrl = `assets/images/haber/${files[0].filename}`;
      }
  
      // Videoyu güncelle
      const updateQuery = `UPDATE egitim SET Name = '${baslik}',Video = '${videoUrl}' WHERE id = '${id}'`;
      await poolRequest.query(updateQuery);
  
      res.send({ status: 'ok' });
    } catch (error) {
      res.status(400).send({ status: 'error' });
    }
  });
  router.post("/getSingleEgitim", async (req, res) => {
    try {
  
      const id = req.body.id
  
      await pool.connect()
      const poolRequest = await pool.request();
      const postUserNot = await poolRequest.query(`SELECT * FROM egitim WHERE id = ${id}`);
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