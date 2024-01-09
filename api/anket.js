

const express = require('express');
const router = express.Router();
const axios = require('axios');
const nodemailer = require("nodemailer");
const cors = require('cors');
const http = require('http');
const request = require('request')
router.use(cors());
const { pool } = require('../db');





router.post("/postanket", async (req, res) => {
    try {
      let is_activite
  
      if (req.body.is_activite) {
        is_activite = 1
      } else {
        is_activite = 0
      }
      const date = new Date();
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const formattedDate = `${year}-${month}-${day}`;
      finisDate = formattedDate
      await pool.connect()
      const poolRequest = await pool.request();
      const postnotif = await poolRequest.query(`INSERT INTO anket (anket_baslik, anket_aciklama,created_date,update_date,finish_date,status,is_delete,is_activite)	OUTPUT INSERTED.id VALUES ( '${req.body.baslik}', '${req.body.aciklama}', '${formattedDate}', '${formattedDate}', '${finisDate}', '1', '0', '${is_activite}')`)
      let notif_id = postnotif.recordset[0].id
      departman = req.body.departman
      console.log(req.body.departman)
  
      for (let k = 0; k < departman.length; k++) {
        let depart_id = departman[k]
        const postDepartmanNotif = await poolRequest.query(`INSERT INTO anket_departman (anket_id  , departman)	VALUES ( '${notif_id}', '${depart_id}')`)
      }
  
      soruArray = req.body.soruArray
      for (let index = 0; index < soruArray.length; index++) {
        let soruTekil = soruArray[index]
        const postanket = await poolRequest.query(`INSERT INTO anket_icerik (anket_id , soru_type , soru_basligi)	OUTPUT INSERTED.id VALUES ( '${notif_id}', '${soruTekil.soruType}', '${soruTekil.sorubasligi}')`)
        let anket_id = postanket.recordset[0].id
        if (soruTekil.soruType == 3) {
          const postanketicerik = await poolRequest.query(`INSERT INTO anket_options (anket_id , icerik_id , soru_type , options )	OUTPUT INSERTED.id VALUES ( '${notif_id}','${anket_id}', '${soruTekil.soruType}', '${""}')`)
        } else {
          for (let j = 0; j < soruTekil.soruIcerik.length; j++) {
            const element = soruTekil.soruIcerik[j];
            const postanketicerik = await poolRequest.query(`INSERT INTO anket_options (anket_id , icerik_id , soru_type , options )	OUTPUT INSERTED.id VALUES ( '${notif_id}','${anket_id}', '${soruTekil.soruType}', '${element.value}')`)
          }
  
        }
      }
  
  
      const getDatas = await poolRequest.query("SELECT an.anket_baslik, an.anket_aciklama,ad.departman,ai.soru_basligi, ai.soru_type,ao.options,ai.id as soru_id, an.id as anket_id FROM anket an INNER JOIN anket_departman ad ON  ad.anket_id = an.id INNER JOIN anket_icerik ai ON ai.anket_id = an.id INNER JOIN anket_options ao ON ao.anket_id = an.id AND ao.icerik_id = ai.anket_id")
      if (getDatas.recordset[0] == 0) {
        res.json({
          "status": 400,
          data: []
        })
      } else {
  
        res.json({
          "status": 200,
          data: getDatas
        })
      }
  
  
    } catch (err) {
      console.error(err.message);
    }
  });

  router.post("/getanketicerik", async (req, res) => {
    try {
      await pool.connect()
      const poolRequest = await pool.request();
  
      user_departman = req.body.departman_id
      anket_id = req.body.anket_id
      const getDatas = await poolRequest.query(`SELECT an.anket_baslik, an.anket_aciklama,ad.departman,ai.soru_basligi, ai.soru_type,ao.options,ai.id as soru_id, an.id as anket_id FROM anket an INNER JOIN anket_departman ad ON  ad.anket_id = an.id INNER JOIN anket_icerik ai ON ai.anket_id = an.id INNER JOIN anket_options ao ON ao.icerik_id = ai.id where an.id = '${anket_id}' AND ad.departman = '${user_departman}'`)
      if (getDatas.recordset[0] == 0) {
        res.json({
          "status": 400,
          data: []
        })
      } else {
  
        res.json({
          "status": 200,
          data: getDatas
        })
      }
  
  
    } catch (err) {
      console.error(err.message);
    }
  });

  
router.post("/updateanketicerikDuzenle", async (req, res) => {
    try {
      await pool.connect()
      const poolRequest = await pool.request();
  
      user_departman = req.body.departman_id
      anket_id = req.body.anket_id
      const getDatas = await poolRequest.query(`SELECT an.anket_baslik, an.anket_aciklama,an.is_activite,
      ai.soru_basligi, ai.soru_type,ao.options,ao.id as options_id,ai.id as soru_id, an.id as anket_id 
      FROM anket an 
      INNER JOIN anket_icerik ai ON ai.anket_id = an.id 
      INNER JOIN anket_options ao ON ao.icerik_id = ai.id where an.id = '${anket_id}'`)
      if (getDatas.recordset[0] == 0) {
        res.json({
          "status": 400,
          data: []
        })
      } else {
  
        res.json({
          "status": 200,
          data: getDatas
        })
      }
  
  
    } catch (err) {
      console.error(err.message);
    }
  });
  router.post("/getAnketSoruID", async (req, res) => {
    try {
      await pool.connect()
      const poolRequest = await pool.request();
  
      user_departman = req.body.departman_id
      anket_id = req.body.anket_id
      const getDatas = await poolRequest.query(`
      SELECT ai.id,ai.soru_type,ai.soru_basligi,ai.soru_icerigi, FROM anket_icerik ai 
      INNER JOIN anket_options ao ON ao.icerik_id = ai.id where ai.id = '${anket_id}'`)
      if (getDatas.recordset[0] == 0) {
        res.json({
          "status": 400,
          data: []
        })
      } else {
  
        res.json({
          "status": 200,
          data: getDatas
        })
      }
  
  
    } catch (err) {
      console.error(err.message);
    }
  });
  router.post("/updateSoruSingle", async (req, res) => {
    try {
      await pool.connect()
      const poolRequest = await pool.request();
  
      user_departman = req.body.departman_id
      anket_id = req.body.anket_id
      const getDatas = await poolRequest.query(`
      SELECT ai.id,ai.soru_type,ai.soru_basligi,ai.soru_icerigi, FROM anket_icerik ai 
      INNER JOIN anket_options ao ON ao.icerik_id = ai.id where ai.id = '${anket_id}'`)
      if (getDatas.recordset[0] == 0) {
        res.json({
          "status": 400,
          data: []
        })
      } else {
  
        res.json({
          "status": 200,
          data: getDatas
        })
      }
  
  
    } catch (err) {
      console.error(err.message);
    }
  });
  router.post("/deleteSoru", async (req, res) => {
    try {
  
      await pool.connect()
      const poolRequest = await pool.request();
  
      const postUserNot = await poolRequest.query(`DELETE FROM anket_icerik WHERE id = ${req.body.soru_id}`)
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
  router.post("/getanketRapor", async (req, res) => {
    try {
      await pool.connect()
      const poolRequest = await pool.request();
  
  
      const getDatas = await poolRequest.query(`SELECT * FROM anket an `)
  
  
  
      if (getDatas.recordset[0] == 0) {
        res.json({
          "status": 400,
          data: []
        })
      } else {
  
        res.json({
          "status": 200,
          data: getDatas.recordsets[0],
        })
      }
  
  
    } catch (err) {
      console.error(err.message);
    }
  });

  router.post("/getSingleAnketUser", async (req, res) => {
    try {
  
      let anket_id = req.body.anket_id
  
  
      await pool.connect()
      const poolRequest = await pool.request();
  
      const getDatas = await poolRequest.query(`SELECT
      a.id AS anket_id,
      u.user_id,
      u.user_name,
      u.sicil 
  FROM
      anket AS a
  INNER JOIN
      anket_user AS au ON a.id = au.anket_id
  INNER JOIN
      users AS u ON au.user_id = u.user_id WHERE a.id = ${anket_id} `)
  
      const getDatas2 = await poolRequest.query(`SELECT
      a.id AS anket_id,
      u.user_id,
      u.user_name,
      u.sicil 
  FROM
      anket AS a
  INNER JOIN
      anket_user AS au ON a.id = au.anket_id
  INNER JOIN
      users AS u ON au.user_id = u.user_id WHERE a.id = ${anket_id} `)
  
  
      if (getDatas.recordset[0] == 0) {
        res.json({
          "status": 400,
          data: []
        })
      } else {
  
        res.json({
          "status": 200,
          data: getDatas.recordsets[0],
        })
      }
  
  
    } catch (err) {
      console.error(err.message);
    }
  });
  router.post("/getSingleAnketUserID", async (req, res) => {
    try {
  
      let anket_id = req.body.anket_id
      let user_id = req.body.user_id
  
      await pool.connect()
      const poolRequest = await pool.request();
  
      const getDatas = await poolRequest.query(`SELECT
      *
  FROM
      anket_user AS au
  INNER JOIN
      anket_user_quastion AS auq ON au.id = auq.anket_user_id
  INNER JOIN
      quastion_response AS qr ON auq.id = qr.anket_user_quastion_id
  WHERE
      au.anket_id = ${anket_id}
      AND au.user_id = ${user_id}`)
  
  
  
      if (getDatas.recordset[0] == 0) {
        res.json({
          "status": 400,
          data: []
        })
      } else {
  
        res.json({
          "status": 200,
          data: getDatas.recordsets[0],
        })
      }
  
  
    } catch (err) {
      console.error(err.message);
    }
  });
  router.post("/getSingleAnketUsers", async (req, res) => {
    try {
  
      let anket_id = req.body.anket_id
      let user_id = req.body.user_id
  
      await pool.connect()
      const poolRequest = await pool.request();
  
      const getDatas = await poolRequest.query(`
      SELECT us.user_name as user_name, qu.soru_aciklama, qu.soru_id, response FROM anket_user au INNER JOIN users us on us.user_id=au.user_id 
      inner join  anket_user_quastion qu on au.id = qu.anket_user_id INNER JOIN quastion_response qr
      ON qu.id = qr.anket_user_quastion_id WHERE au.anket_id = ${anket_id}`)
  
  
  
      if (getDatas.recordset[0] == 0) {
        res.json({
          "status": 400,
          data: []
        })
      } else {
  
        res.json({
          "status": 200,
          data: getDatas.recordsets[0],
        })
      }
  
  
    } catch (err) {
      console.error(err.message);
    }
  });
  router.post("/getanket", async (req, res) => {
    try {
      await pool.connect()
      const poolRequest = await pool.request();
  
      user_departman = req.body.depID
      user_id = req.body._id
      const getDatas = await poolRequest.query(`SELECT an.anket_baslik, an.anket_aciklama,ad.departman,an.id,an.created_date,an.update_date,an.finish_date,an.status,an.is_delete,an.is_activite FROM anket an INNER JOIN anket_departman ad ON  ad.anket_id = an.id AND ad.departman = '${user_departman}' where is_activite = 1 `)
      const getDatas2 = await poolRequest.query(`SELECT * FROM anket_user WHERE user_id = '${user_id}'`)
  
  
      if (getDatas.recordset[0] == 0) {
        res.json({
          "status": 400,
          data: []
        })
      } else {
  
        res.json({
          "status": 200,
          data: getDatas,
          user: getDatas2
        })
      }
  
  
    } catch (err) {
      console.error(err.message);
    }
  });
  router.post("/anketSil", async (req, res) => {
    try {
      let id = req.body.id
  
  
      await pool.connect()
      const poolRequest = await pool.request();
      const postUserNot = await poolRequest.query(`DELETE FROM anket WHERE id = ${id}`);
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
  router.post("/deleteOptions", async (req, res) => {
    try {
      let id = req.body.option_id
  
  
      await pool.connect()
      const poolRequest = await pool.request();
      const postUserNot = await poolRequest.query(`DELETE FROM anket_options WHERE id = ${id}`);
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
  
router.post("/postanketOptions", async (req, res) => {
    try {
  
      let notif_id = req.body.anket_id
      let soru_id = req.body.soru_id
      let soruType = req.body.soruType
      let options = req.body.options
  
      await pool.connect()
      const poolRequest = await pool.request();
  
      if (soruType == 3) {
        const postanketicerik = await poolRequest.query(`INSERT INTO anket_options (anket_id , icerik_id , soru_type , options )	OUTPUT INSERTED.id VALUES ( '${notif_id}','${soru_id}', '${soruType}', '${""}')`)
      } else {
        const postanketicerik = await poolRequest.query(`INSERT INTO anket_options (anket_id , icerik_id , soru_type , options )	OUTPUT INSERTED.id VALUES ( '${notif_id}','${soru_id}', '${soruType}', '${options}')`)
      }
  
  
      const getDatas = await poolRequest.query("SELECT an.anket_baslik, an.anket_aciklama,ad.departman,ai.soru_basligi, ai.soru_type,ao.options,ai.id as soru_id, an.id as anket_id FROM anket an INNER JOIN anket_departman ad ON  ad.anket_id = an.id INNER JOIN anket_icerik ai ON ai.anket_id = an.id INNER JOIN anket_options ao ON ao.anket_id = an.id AND ao.icerik_id = ai.anket_id")
      if (getDatas.recordset[0] == 0) {
        res.json({
          "status": 400,
          data: []
        })
      } else {
  
        res.json({
          "status": 200,
          data: getDatas
        })
      }
  
  
    } catch (err) {
      console.error(err.message);
    }
  });
  router.post("/putAnket", async (req, res) => {
    try {
  
      let anket_id = req.body.anket_id
  
      let is_activite
      if (req.body.is_activite) {
        is_activite = 1
      } else {
        is_activite = 0
      }
      console.log(is_activite, anket_id)
      await pool.connect()
      const poolRequest = await pool.request();
      const postnotif = await poolRequest.query(`UPDATE anket SET is_activite = '${is_activite}' WHERE id = ${anket_id}`)
      if (postnotif.recordset) {
        res.json({
          "status": 400,
          data: []
        })
      } else {
        //const getBodro = await pool.query("SELECT * FROM bodro WHERE user_id = $1 ",[user_id])//tarih alanı ekelenecek
        res.json({
          "status": 200,
          data: postnotif.recordset
        })
      }
  
    } catch (err) {
      console.error(err.message);
    }
  });
  router.post("/getanketAdmin", async (req, res) => {
    try {
      await pool.connect()
      const poolRequest = await pool.request();
  
      user_departman = req.body.depID
      user_id = req.body._id
  
  
      const getDatas = await poolRequest.query(`SELECT * FROM anket an `)
      const getDatas2 = await poolRequest.query(`SELECT * FROM anket_user WHERE user_id = '${user_id}'`)
  
  
      if (getDatas.recordset[0] == 0) {
        res.json({
          "status": 400,
          data: []
        })
      } else {
  
        res.json({
          "status": 200,
          data: getDatas,
          user: getDatas2
        })
      }
  
  
    } catch (err) {
      console.error(err.message);
    }
  });
  router.post("/postuseranket", async (req, res) => {
    try {
  
  
      await pool.connect()
      const poolRequest = await pool.request();
  
  
      const postanketuser = await poolRequest.query(`INSERT INTO anket_user (anket_id,user_id)	OUTPUT INSERTED.id VALUES ( '${req.body.anket_id}', '${req.body.user_id}')`)
      let anket_id = postanketuser.recordset[0].id
  
      let postanketuserquastionresponse
  
      cevapArray = req.body.data
      let user_quastion_id
      for (let i = 0; i < cevapArray.length; i++) {
        let deger = cevapArray[i]
        if (Array.isArray(deger)) {
          // Dizi öğesi
          const postanketuserquastion = await poolRequest.query(`INSERT INTO anket_user_quastion (anket_user_id,soru_id,soru_aciklama,soru_type)	OUTPUT INSERTED.id VALUES ( '${anket_id}', '${deger[0].soru_id}','${deger[0].soru}','${deger[0].soruType}')`)
          user_quastion_id = postanketuserquastion.recordset[0].id
          for (let j = 0; j < deger.length; j++) {
            postanketuserquastionresponse = await poolRequest.query(`INSERT INTO quastion_response (anket_user_quastion_id,anket_user_id,response)	OUTPUT INSERTED.id VALUES ( '${user_quastion_id}', '${anket_id}','${deger[j].cevap}')`)
            //  user_quastion_id = postanketuserquastion.recordset[0].id
          }
  
        } else if (typeof deger === 'object') {
          // Nesne öğesi
          const postanketuserquastion = await poolRequest.query(`INSERT INTO anket_user_quastion (anket_user_id,soru_id,soru_aciklama,soru_type)	OUTPUT INSERTED.id VALUES ( '${anket_id}', '${deger.soru_id}','${deger.soru}','${deger.soruType}')`)
          user_quastion_id = postanketuserquastion.recordset[0].id
          postanketuserquastionresponse = await poolRequest.query(`INSERT INTO quastion_response (anket_user_quastion_id,anket_user_id,response)	OUTPUT INSERTED.id VALUES ( '${user_quastion_id}', '${anket_id}','${deger.cevap}')`)
  
        }
      }
  
  
  
  
      if (postanketuserquastionresponse.recordset[0] == 0) {
        res.json({
          "status": 400,
          data: []
        })
      } else {
  
        res.json({
          "status": 200,
          data: []
        })
      }
  
  
    } catch (err) {
      console.error(err.message);
    }
  });


  module.exports = router;