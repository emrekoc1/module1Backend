

const express = require('express');
const router = express.Router();
const axios = require('axios');
const nodemailer = require("nodemailer");
const cors = require('cors');
const request = require('request')
router.use(cors());
const { pool } = require('../db');
const multer = require('multer');
const path = require('path');

const transliteration = require('transliteration');




const storageDocs = multer.diskStorage({

    destination: (req, file, callBack) => {
  
  
  
  
      const destinationPath = path.join(__dirname, '..', '..', '..', '..','..', '..', 'wamp64', 'www', 'assets', 'docs');
      //const destinationPath = path.join(__dirname, '..', 'front end', 'front end', 'src', 'assets', 'docs');
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
  const uploadDocs = multer({ storage: storageDocs })
  router.post('/evrakPost', uploadDocs.array('files'), async (req, res, next) => {
    const bugun = new Date();
    const tarihDamgasi = bugun.toISOString().replace(/[:.]/g, '').substring(0, 10);
    const files = req.files;
    const belge_no = req.body.belge_no;
    const belge_adi = req.body.belge_adi;
    const belge_aciklama = req.body.belge_aciklama;
    const revizyon_tarihi = req.body.revizyon_tarihi;
    const revizyon_no = req.body.revizyon_no;
    const ilgili_birim = req.body.ilgili_birim;
    const is_active = 1
    const b_a_id = req.body.kategori
  
    const is_delete = 0;
    let created_date = tarihDamgasi
  
    if (!files) {
      const error = new Error('No File')
      error.httpStatusCode = 400
      return next(error)
    }
    try {
      let belge_url = `assets\\docs\\${files[0].filename}`
      console.log(req.body)
      await pool.connect()
      const poolRequest = await pool.request();
      // const postUserNot = await poolRequest.query(`INSERT INTO belge_arsiv (belge_no ,belge_url ,belge_adi ,belge_aciklama ,revizyon_tarihi ,revizyon_no , created_date,is_active,is_delete ) 
      // OUTPUT INSERTED.id VALUES('${belge_no}','${belge_url}','${belge_adi}','${belge_aciklama}','${revizyon_tarihi}','${revizyon_no}','${created_date}','${is_active}','${is_delete}')`)
  
      const postUserNot = await poolRequest.query(`INSERT INTO belge_arsiv (belge_no ,belge_url,belge_adi,belge_aciklama,revizyon_no,created_date,is_active,is_delete,b_a_id ) 
    OUTPUT INSERTED.id VALUES('${belge_no}','${belge_url}','${belge_adi}','${belge_aciklama}','${revizyon_no}','${created_date}',${is_active},${is_delete},${b_a_id})`)
      let egitim_id = postUserNot.recordset[0].id
  
      res.send({ status: 200 });
    } catch (error) {
      console.log(error)
    }
  
  })
  router.post('/evrakKategoriPost', async (req, res, next) => {
    const bugun = new Date();
  
    const name = req.body.kategori_baslik
    const birim = req.body.birim
    const description = req.body.kategori_aciklama
    const is_active = 1
    const is_delete = 0;
  
    console.log(req.body)
  
    try {
  
      await pool.connect()
      const poolRequest = await pool.request();
  
      const postUserNot = await poolRequest.query(`INSERT INTO belge_arsiv_kategori (name,description,is_active,is_delete,birim) OUTPUT INSERTED.id VALUES('${name}','${description}',${is_active},${is_delete},${birim})`)
      let egitim_id = postUserNot.recordset[0].id
  
      res.send({ status: 200 });
    } catch (error) {
      console.log(error)
    }
  
  })
  router.post('/evrakGet', async (req, res, next) => {
    try {
      await pool.connect()
      const poolRequest = await pool.request();
      const postUserNot = await poolRequest.query(`SELECT b_a.*,b_a_k.name,b_a_k.id as kategori_id,b_a_k.description FROM belge_arsiv b_a INNER JOIN belge_arsiv_kategori b_a_k ON b_a_k.id = b_a.b_a_id `)
      let egitim_id = postUserNot.recordset
      res.send({
        status: 200, data: egitim_id
      });
    } catch (error) {
      res.send({
        status: 400, data: []
      });
    }
  
  })
  router.post('/kategoriGet', async (req, res, next) => {
    try {
      await pool.connect()
      const poolRequest = await pool.request();
      const postUserNot = await poolRequest.query(`SELECT * FROM  belge_arsiv_kategori `)
      let egitim_id = postUserNot.recordset
      res.send({
        status: 200, data: egitim_id
      });
    } catch (error) {
      res.send({
        status: 400, data: []
      });
    }
  
  })
  
  router.post('/evrakDelete', async (req, res, next) => {
    try {
      await pool.connect()
  
      console.log("buraya istek attımı ")
      const poolRequest = await pool.request();
      const postUserNot = await poolRequest.query(`UPDATE belge_arsiv SET is_delete = 1 WHERE id=${req.body.id} `)
      let egitim_id = postUserNot.recordset
      console.log(req.body.id)
      console.log(egitim_id)
      res.send({
        status: 200, data: egitim_id
      });
    } catch (error) {
      res.send({
        status: 400, data: []
      });
    }
  
  })
  router.post('/evrakPut', uploadDocs.array('files'), async (req, res, next) => {
  
    const files = req.files;
    const belge_no = req.body.belge_no;
    const belge_adi = req.body.belge_adi;
    const belge_aciklama = req.body.belge_aciklama;
    const revizyon_tarihi = req.body.revizyon_tarihi;
    const revizyon_no = req.body.revizyon_no;
    const ilgili_birim = req.body.ilgili_birim;
    const is_active = req.body.ilgili_birim;
    if (req.body.is_active) {
      is_active = 1
    } else {
      is_active = 0
    }
    const is_delete = 0;
    if (req.body.is_delete) {
      is_delete = 1
    } else {
      is_delete = 0
    }
  
    if (!files) {
      const error = new Error('No File')
      error.httpStatusCode = 400
      return next(error)
    }
    let belge_url = `assets\\docs\\${files[0].filename}`
  
    await pool.connect()
    const poolRequest = await pool.request();
    const postUserNot = await poolRequest.query(`UPDATE belge_arsiv SET belge_no='${belge_no}' ,belge_url ='${belge_url}' ,belge_adi ='${belge_adi}' ,belge_aciklama='${belge_aciklama}' ,revizyon_tarihi='${revizyon_tarihi}' ,revizyon_no='${revizyon_no}' ,ilgili_birim='${ilgili_birim}' ,is_active = '${is_active}',is_delete='${is_delete}'`)
    let egitim_id = postUserNot.recordset[0].id
    res.send({ status: 200 });
  })
  router.post('/evrakSingel', async (req, res, next) => {
    try {
      await pool.connect()
      const poolRequest = await pool.request();
      const postUserNot = await poolRequest.query(`SELECT * FROM belge_arsiv WHERE id = ${req.body.id}`)
      let egitim_id = postUserNot.recordset[0]
      res.send({
        status: 200, data: egitim_id
      });
    } catch (error) {
      res.send({
        status: 400, data: []
      });
    }
  
  })


  module.exports = router;