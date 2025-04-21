const axios = require('axios');
const nodemailer = require("nodemailer");
const express = require('express');
const router = express.Router();
const cors = require('cors');
const { format } = require('date-fns');
const http = require('http');
const request = require('request')
router.use(cors());
const pool = require('./db');
const fs = require("fs");
const multer = require('multer');
const path = require('path');
const transliteration = require('transliteration');

//Product oluşturma

router.post("/postProduct", cors(), async (req, res) => {
  try {
    const {sku, varytant_id, varyant_sku, fiyat, link} = req.body
    const urunQr = {
        sku: sku,
      };
      const qrData = JSON.stringify(urunQr);
      const qrCodeData = await new Promise((resolve, reject) => {
        QRCode.toDataURL(qrData, (err, url) => {
          if (err) {
            console.error(err);
            reject(err);
          } else {
            resolve(url);
          }
        });
      });
    const productPost = await pool.query(`INSERT INTO bek_product (sku, varytant_id, varyant_sku, fiyat, link, qr) Values($1,$2,$3,$4,$5,$6)`,[sku, varytant_id, varyant_sku, fiyat, link,qrCodeData])

    res.status(200).json({
        status:200,
        data:productPost.rows
    })
  } catch (error) {
    res.status(500).json(error)
        console.error(error)
  }

})
//product listeleme
router.post("/getProduct", cors(), async (req, res) => {
    try {
     
      
      const productGet = await pool.query(`SELECT * FROM bek_product`)
  
      res.status(200).json({
          status:200,
          data:productGet.rows
      })
    } catch (error) {
      res.status(500).json(error)
          console.error(error)
    }
  
  })
// product güncelleme
router.post("/putProduct", cors(), async (req, res) => {
    try {
      const {sku, varytant_id, varyant_sku, fiyat, link,id} = req.body
      
      const productPost = await pool.query(`UPDATE  bek_product SET sku = $1, varytant_id= $2, varyant_sku=$3, fiyat = $4, link= $5 WHERE id = $6`,[sku, varytant_id, varyant_sku, fiyat, link,id])
  
      res.status(200).json({
          status:200,
          data:productPost.rows
      })
    } catch (error) {
      res.status(500).json(error)
          console.error(error)
    }
  
  })

  // product varyantBul
  router.post("/getProduct", cors(), async (req, res) => {
    try {
     
      
      const productGet = await pool.query(`SELECT bp.*, (SELECT json_agg(varyant) FROM (SELECT * FROM bek_product bpJSON WHERE bpJSON.id = bpv.varyant_id ) varyant) as varyant FROM bek_product bp INNER JOIN bak_product_varyant bpv ON bpv.product_id = bp.id `)
  
      res.status(200).json({
          status:200,
          data:productGet.rows
      })
    } catch (error) {
      res.status(500).json(error)
          console.error(error)
    }
  
  })
// depo yeri oluşturma
router.post("/postStokYeri", cors(), async (req, res) => {
    try {
     
      
      const productGet = await pool.query(`INSERT INTO bek_stok_yeri `)
  
      res.status(200).json({
          status:200,
          data:productGet.rows
      })
    } catch (error) {
      res.status(500).json(error)
          console.error(error)
    }
  
  })
// depeo yeri listeleme
// depo yeri günceleme
// stok oluturma product+depo yeri
// ürüne ait stok yerleri ve sum vermek
// product ürün arama stok yeri - link - varyant - fiyat


module.exports = router;
