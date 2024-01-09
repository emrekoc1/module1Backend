
const express = require('express');
const router = express.Router();
const axios = require('axios');
const nodemailer = require("nodemailer");
const cors = require('cors');
const request = require('request')
router.use(cors());
const { pool } = require('../db');





router.post("/postnotification", async (req, res) => {
    let baslik = req.body.baslik;
    let aciklama = req.body.aciklama;
    let gelenDepartman = req.body.departman;
    let oncelik = req.body.oncelik;
    let is_activite
    if (req.body.is_activite) {
      is_activite = 1
    } else {
      is_activite = 0
    }
    const bugun = new Date();
    const tarihDamgasi = bugun.toISOString().replace(/[:.]/g, '').substring(0, 10); // Sadece '2023-08-25' bölümü
  
    const departman = gelenDepartman;
  
    try {
  
      await pool.connect()
      const poolRequest = await pool.request();
      const query = `
    INSERT INTO notification_ (duyru_basligi, duyru_aciklama, duyru_oncelik, created_date, is_active)
    OUTPUT INSERTED.id 
    VALUES (@baslik, @aciklama, @oncelik, @tarihDamgasi, @is_activite)
  `;
  
      poolRequest.input('baslik', baslik);
      poolRequest.input('aciklama', aciklama);
      poolRequest.input('oncelik', oncelik);
      poolRequest.input('tarihDamgasi', tarihDamgasi);
      poolRequest.input('is_activite', is_activite);
      const postnotif = await poolRequest.query(
        query
      )
      let notif_id = postnotif.recordset[0].id
      for (let index = 0; index < departman.length; index++) {
        let depart_id = departman[index]
  
        const postDepartmanNotif = await poolRequest.query(`INSERT INTO duyuru_departman (duyuru_id , departman)	VALUES ( '${notif_id}', '${depart_id}')`)
      }
  
      const getDatas = await poolRequest.query("SELECT * FROM notification_")
  
      if (getDatas.recordset[0] == 0) {
        res.json({
          "status": 400,
          data: []
        })
      } else {
  
        res.json({
          "status": 200,
          data: getDatas.recordset
        })
      }
    }
    catch (err) {
      console.error(err.message);
    }
  });
  router.post("/putnotification", async (req, res) => {
    let baslik = req.body.baslik;
    let aciklama = req.body.aciklama;
    let is_activite
    if (req.body.is_activite) {
      is_activite = 1
    } else {
      is_activite = 0
    }
  
  
    try {
      await pool.connect()
      const poolRequest = await pool.request();
      const postnotif = await poolRequest.query(`UPDATE notification_ SET duyru_basligi='${baslik}', duyru_aciklama='${aciklama}', is_active = ${is_activite} `)
      let notif_id = postnotif
  
  
      const getDatas = await poolRequest.query("SELECT * FROM notification_")
  
      if (getDatas.recordset[0] == 0) {
        res.json({
          "status": 400,
          data: []
        })
      } else {
  
        res.json({
          "status": 200,
          data: getDatas.recordset
        })
      }
    }
    catch (err) {
      console.error(err.message);
    }
  });
  router.post("/getnotification", async (req, res) => {
    try {
  
      let user_id = req.body._id
      let departman = req.body.depID
  
      await pool.connect()
      const poolRequest = await pool.request();
      //usernotif ınner joın yapılacaktır. status bilgisi buradan alınacaktır. statusu 1 olan okundu olarak data olmayan renksiz ile gösterilecektir.
      //eğer okundu işaretler ise tabloya yazacak yeşil gösterilecektir.
      const query = `
      SELECT *
      FROM notification_ notif INNER JOIN duyuru_departman db ON db.departman = '${departman}' and notif.id = db.duyuru_id and notif.is_active = 1`;
      // geçici
      const query2 = `
      SELECT *
      FROM duyuru_departman  `;
  
  
      //geçici bitiş
  
      const getData = await poolRequest.query(query);
  
      // const getData = await pool.query(`SELECT user_name,duyru_basligi,duyru_aciklama,id FROM notification INNER JOIN users on departman= ANY(duyru_birimi) and user_id='${user_id}'`)
      const getuserData = await poolRequest.query(`SELECT * FROM usernotification WHERE user_id = '${user_id}'`)
  
      if (!getData.recordset[0]) {
        res.json({
          "status": 400,
          data: [],
          usernot: []
        })
      } else {
  
        res.json({
          "status": 200,
          data: getData,
          user: getuserData
        })
  
  
      }
    } catch (err) {
      console.error(err.message);
    }
  });
  router.post("/updatenotificerikDuzenle", async (req, res) => {
    try {
  
      let id = req.body.id
      console.log(id)
  
      await pool.connect()
      const poolRequest = await pool.request();
      //usernotif ınner joın yapılacaktır. status bilgisi buradan alınacaktır. statusu 1 olan okundu olarak data olmayan renksiz ile gösterilecektir.
      //eğer okundu işaretler ise tabloya yazacak yeşil gösterilecektir.
      const query = `
      SELECT *
      FROM notification_ WHERE id = ${id}`;
      // geçici
  
      //geçici bitiş
  
      const getData = await poolRequest.query(query);
  
      // const getData = await pool.query(`SELECT user_name,duyru_basligi,duyru_aciklama,id FROM notification INNER JOIN users on departman= ANY(duyru_birimi) and user_id='${user_id}'`)
      const getuserData = await poolRequest.query(`SELECT * FROM usernotification WHERE user_id = '${user_id}'`)
  
      if (!getData.recordset[0]) {
        res.json({
          "status": 400,
          data: [],
          usernot: []
        })
      } else {
  
        res.json({
          "status": 200,
          data: getData,
          user: getuserData
        })
  
  
      }
    } catch (err) {
      console.error(err.message);
    }
  });
  router.post("/getAllnotif", async (req, res) => {
    try {
      await pool.connect()
      const poolRequest = await pool.request();
      //usernotif ınner joın yapılacaktır. status bilgisi buradan alınacaktır. statusu 1 olan okundu olarak data olmayan renksiz ile gösterilecektir.
      //eğer okundu işaretler ise tabloya yazacak yeşil gösterilecektir.
      const query = `
      SELECT *
      FROM notification_ notif`;
  
      const getData = await poolRequest.query(query);
      const query2 = `
      SELECT COUNT(userNot.id)-1 as okunan,COUNT(noti.id)-1 as duyuru
      FROM usernotification userNot INNER JOIN notification_ noti ON noti.id = userNot.notifi_id GROUP BY userNot.notifi_id, noti.id`;
  
      const getData2 = await poolRequest.query(query2);
  
  
      if (!getData.recordset[0]) {
        res.json({
          "status": 400,
          data: [],
          usernot: []
        })
      } else {
  
        res.json({
          "status": 200,
          data: getData.recordset,
          data2: getData2.recordset
        })
  
  
      }
    } catch (err) {
      console.error(err.message);
    }
  });
  router.post("/getSingleNotifSum", async (req, res) => {
    try {
      let not_id = req.body.not_id
      await pool.connect()
      const poolRequest = await pool.request();
      //usernotif ınner joın yapılacaktır. status bilgisi buradan alınacaktır. statusu 1 olan okundu olarak data olmayan renksiz ile gösterilecektir.
      //eğer okundu işaretler ise tabloya yazacak yeşil gösterilecektir.
      const query = `
      SELECT * 
      FROM usernotification notif INNER JOIN users users ON notif.user_id = users.user_id WHERE notif.notifi_id = ${not_id} `;
      // const query = `
      // SELECT * 
      // FROM users  `;
  
      const getData = await poolRequest.query(query);
  
  
      if (!getData.recordset[0]) {
        res.json({
          "status": 400,
          data: [],
          usernot: []
        })
      } else {
  
        res.json({
          "status": 200,
          data: getData.recordset,
  
        })
  
  
      }
    } catch (err) {
      console.error(err.message);
    }
  });
  router.post("/getNotifAdmin", async (req, res) => {
    try {
  
      let user_id = req.body._id
      let departman = req.body.depID
  
      await pool.connect()
      const poolRequest = await pool.request();
      //usernotif ınner joın yapılacaktır. status bilgisi buradan alınacaktır. statusu 1 olan okundu olarak data olmayan renksiz ile gösterilecektir.
      //eğer okundu işaretler ise tabloya yazacak yeşil gösterilecektir.
      const query = `
      SELECT *
      FROM notification_ notif `;
      // geçici
  
  
  
      //geçici bitiş
  
      const getData = await poolRequest.query(query);
  
      // const getData = await pool.query(`SELECT user_name,duyru_basligi,duyru_aciklama,id FROM notification INNER JOIN users on departman= ANY(duyru_birimi) and user_id='${user_id}'`)
      const getuserData = await poolRequest.query(`SELECT * FROM usernotification WHERE user_id = '${user_id}'`)
  
      if (!getData.recordset[0]) {
        res.json({
          "status": 400,
          data: [],
          usernot: []
        })
      } else {
  
        res.json({
          "status": 200,
          data: getData,
          user: getuserData
        })
  
  
      }
    } catch (err) {
      console.error(err.message);
    }
  });
  
  router.post("/postUserNot", async (req, res) => {
    try {
  
      let user_id = req.body.user_id
      let not_id = req.body.not
  
      await pool.connect()
      const poolRequest = await pool.request();
  
      const postUserNot = await poolRequest.query(`INSERT INTO usernotification (user_id, notifi_id, status) VALUES('${user_id}','${not_id}','${2}')`, [user_id, not_id, 2])
  
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
  router.post("/duyuruSil", async (req, res) => {
    try {
      let id = req.body.id
  
      await pool.connect()
      const poolRequest = await pool.request();
      const postUserNot = await poolRequest.query(`DELETE FROM notification_ WHERE id = ${id}`);
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