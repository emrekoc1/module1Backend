
const express = require('express');
const router = express.Router();
const axios = require('axios');
const nodemailer = require("nodemailer");
const cors = require('cors');
const http = require('http');
const request = require('request')
router.use(cors());
const { pool } = require('../db');





router.post("/dilekSikayetKutusu", async (req, res) => {

    let aciklama = req.body.aciklama
    let baslik = req.body.baslik
    let departman = req.body.departman
    let user_id = req.body.user_id
    let okundu = req.body.okundu
  
  
    if (!okundu) {
      user_id = 0
      departman = 0
  
    }
    // dataları ayırştırıp bodro iste tablosu oluşturulacak 
    // data istenmişmi kontrol edilecek eğer data  
    try {
  
  
      await pool.connect()
      const poolRequest = await pool.request();
      const query = `INSERT INTO dilek_sikayet (baslik,aciklama,user_id,dep_id) VALUES ('${baslik}','${aciklama}',${user_id},${departman})`;
      const userGet = await poolRequest.query(query);
  
  
  
      let transporter = nodemailer.createTransport({
        host: '20.0.0.20',
        port: 25,
        secure: false,
  
        auth: {
          user: 'bilgi@aho.com',
          pass: 'Bilgi5858!'
        },
        tls: {
          rejectUnauthorized: false
        }
      });
      let mailOptions = {
        from: 'bilgi@aho.com',
        to: 'ik@aho.com',
        cc: '',
        subject: 'Dilek Sikayet ',
        html: `
      <p>Sayın İlgili,</p>
      <p>Bir adet yeni dilek/şikayetiniz oluşturulmuştur. Açıklama şu şekildedir:</p>
      <p><strong style="font-size: 14px">${baslik}</strong></p>
      <p>${aciklama}</p>
    `
      };
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.log(error);
        } else {
          console.log('Email sent: ' + info.response);
          res.json({
            "status": 200,
            data: "Mail Gönderildi"
          })
        }
      });
  
  
  
    } catch (err) {
      console.error(err.message);
    }
  
  
  });
  
  router.post("/getDilekSikayetKutusu", async (req, res) => {
  
  
  
    // dataları ayırştırıp bodro iste tablosu oluşturulacak 
    // data istenmişmi kontrol edilecek eğer data  
    try {
  
  
      await pool.connect()
      const poolRequest = await pool.request();
      const query = `SELECT ds.baslik,ds.aciklama,ds.user_id,ds.dep_id,u_s.user_name FROM dilek_sikayet ds LEFT JOIN users u_s ON u_s.sicil = ds.user_id `;
      // const query = `SELECT  FROM users u_s `;
      const userGet = await poolRequest.query(query);
      if (userGet.rowsAffected > 0) {
        res.json({
          "status": 200,
          data: userGet.recordsets
        })
      } else {
        res.json({
          "status": 400,
          data: userGet
        })
      }
  
  
  
  
  
  
  
  
  
  
    } catch (err) {
      console.error(err.message);
    }
  
  
  });
  router.post("/deleteDilekSikayetKutusu", async (req, res) => {
  
  
  
    // dataları ayırştırıp bodro iste tablosu oluşturulacak 
    // data istenmişmi kontrol edilecek eğer data  
    try {
  
      await pool.connect()
      const poolRequest = await pool.request();
      const query = `SELECT * FROM dilek_sikayet  `;
      //const query = `DELETE FROM dilek_sikayet WHERE id=${req.body.id} `;
      // const query = `SELECT  FROM users u_s `;
      const userGet = await poolRequest.query(query);
      if (userGet.rowsAffected > 0) {
        res.json({
          "status": 200,
          data: userGet.recordsets
        })
      } else {
        res.json({
          "status": 400,
          data: userGet
        })
      }
  
    } catch (err) {
      console.error(err.message);
    }
  
  
  });


  router.post("/postDepartman", async (req, res) => {
    try {
      let datas =
        ["İDARİ",
          "TEKNİK BÜRO",
          "OPTİK KAPLAMA",
          "TERMAL SİSTEMLER",
          "GÜNDÜZ GÖRÜŞ TEST SİSTEMLERİ",
          "KALİTE ELD",
          "DEPO",
          "LİTOGRAFİ OPTİK KAPLAMA",
          "BİLGİ İŞLEM",
          "GÜNDÜZ GÖRÜŞ",
          "PLANLAMA",
          "KALİTE",
          "OPTİK ÜRETİM",
          "MEKANİK ÜRETİM",
          "TEDARİK ZİNCİRİ",
          "MEKANİK TASARIM",
          "OPTİK TASARIM",
          "TASARIM KALİTE",
          "GÖMÜLÜ YAZILIM",
          "HİZMET SATIŞ",
          "GECE GÖRÜŞ",
          "BAKIM ONARIM",
          "KALİTE GÜVENCE",
          "HURDA FİRE",
          "TEMİN DEPARTMANI",
          "GİRİŞ KALİTE",
          "ELD",
          "OPTİK YAPIŞTIRMA",
          "GEÇİCİ KABUL",
          "LİTOGRAFİ",
          "TEST SİSTEMLERİ",
          "YIKAMA"]
      await pool.connect()
      const poolRequest = await pool.request();
      for (let index = 0; index < datas.length; index++) {
        description = datas[index]
        const query = `INSERT INTO departmant (description) VALUES ('${description}')`
  
        const postQuestion = await poolRequest.query(query);
  
  
  
      }
      const query = `SELECT * FROM  departmant `
  
      const postQuestion = await poolRequest.query(query);
  
      if (!postQuestion.recordset[0]) {
        res.json({
          "status": 400,
          data: []
        })
      } else {
        //const getBodro = await pool.query("SELECT * FROM bodro WHERE user_id = $1 ",[user_id])//tarih alanı ekelenecek
        res.json({
          "status": 200,
          data: postQuestion.recordset
        })
      }
  
    } catch (err) {
      console.error(err.message);
    }
  });
  router.post("/getDepartman", async (req, res) => {
    try {
  
      await pool.connect()
      const poolRequest = await pool.request();
  
      const query = `SELECT * FROM departmant`
  
      const postQuestion = await poolRequest.query(query);
  
      if (!postQuestion.recordset[0]) {
        res.json({
          "status": 400,
          data: []
        })
      } else {
        //const getBodro = await pool.query("SELECT * FROM bodro WHERE user_id = $1 ",[user_id])//tarih alanı ekelenecek
        res.json({
          "status": 200,
          data: postQuestion.recordset
        })
      }
  
    } catch (err) {
      console.error(err.message);
    }
  });
  router.post("/updateDepartman", async (req, res) => {
    try {
  
      await pool.connect()
      const poolRequest = await pool.request();
      for (let index = 0; index < 32; index++) {
        const query = `update departmant set id = '${index}' where id = '${index + 32}'`
  
        const postQuestion = await poolRequest.query(query);
      }
  
  
      if (!postQuestion.recordset[0]) {
        res.json({
          "status": 400,
          data: []
        })
      } else {
        //const getBodro = await pool.query("SELECT * FROM bodro WHERE user_id = $1 ",[user_id])//tarih alanı ekelenecek
        res.json({
          "status": 200,
          data: postQuestion.recordset
        })
      }
  
    } catch (err) {
      console.error(err.message);
    }
  });

  router.post('/postTakvim', async (req, res, next) => {
    try {
      const { text, recurrenceRule, startDate, endDate, allDay, assignor_id, selectedUserId, isChecked, selected, numberField, secilenTekrarGun } = req.body;
  
      let startDateInput = new Date(startDate).toISOString(); // Tarih/saat değerini ISO biçimine dönüştür
      let endDateInput = new Date(endDate).toISOString(); // Tarih/saat değerini ISO biçimine dönüştür
  
      let recurrenceRuleValue
      if (recurrenceRule == '') {
        if (isChecked) {
  
          recurrenceRuleValue = `FREQ=${selected};BYDAY=${secilenTekrarGun};COUNT=${numberField}`;
        }
      } else {
        recurrenceRuleValue = recurrenceRule
      }
  
      await pool.connect()
      const poolRequest = await pool.request();
      console.log("işlem başlatıldı", assignor_id, selectedUserId)
      if (assignor_id != selectedUserId) {
        const getUser = await poolRequest.query(` SELECT * FROM users WHERE user_id = ${selectedUserId}`);
        let userMail = getUser.recordset[0].email
        const getSendUser = await poolRequest.query(` SELECT * FROM users WHERE user_id = ${assignor_id}`);
        let getSendUsername = getSendUser.recordset[0].user_name
        try {
  
          let transporter = nodemailer.createTransport({
            host: '20.0.0.20',
            port: 25,
            secure: false,
  
            auth: {
              user: 'bilgi@aho.com',
              pass: 'Bilgi5858!'
            },
            tls: {
              rejectUnauthorized: false
            }
          });
          let mailOptions = {
            from: 'bilgi@aho.com',
            to: userMail,
            cc: '',
            subject: 'Yeni İş Ataması.',
            text: ' Takviminize ' + getSendUsername + ' kişi tarafından yeni iş açılmıştır http://10.0.0.35:4500/#/apps/takvim adresinden ulaşabilirsiniz.'
          };
          transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
              console.log(error);
            } else {
              console.log('Email sent: ' + info.response);
            }
          });
  
        } catch (err) {
          console.error(err.message);
        }
      }
  
      const query = `
        INSERT INTO appointment (text, assignor_id, startDate, endDate, incumbent, recurrenceRule, allDay)
        VALUES (@text, @assignor_id, @startDate, @endDate, @incumbent, @recurrenceRule, @allDay)
      `;
  
      poolRequest.input('text', text);
      poolRequest.input('assignor_id', assignor_id);
      poolRequest.input('startDate', startDateInput);
      poolRequest.input('endDate', endDateInput);
      poolRequest.input('incumbent', selectedUserId);
      poolRequest.input('recurrenceRule', recurrenceRuleValue);
      poolRequest.input('allDay', allDay);
  
      const postUserNot = await poolRequest.query(query);
  
      const egitim_id = postUserNot.recordset;
  
  
      res.status(200).json({ status: 200, data: egitim_id });
    } catch (error) {
      console.log(error)
      res.send({
        status: 400, data: []
      });
    }
  
  })
  router.post('/putTakvim', async (req, res, next) => {
    try {
      const { id, text, description, startDate, endDate, assignor_id, selectedUserId, recurrenceRule, allDay } = req.body;
      console.log("buradayız", req.body)
      // Tarih/saat değerlerini uygun biçime dönüştürün
      const startDateInput = new Date(startDate).toISOString();
      const endDateInput = new Date(endDate).toISOString();
  
      await pool.connect();
      const poolRequest = await pool.request();
      console.log("buradayız", startDateInput, endDateInput)
      // UPDATE sorgusu ile veriyi güncelleyin
      const query = `
        UPDATE appointment 
        SET 
          startDate = @startDate,
          endDate = @endDate,
          recurrenceRule = @recurrenceRule,
          text = @text,
          allDay = @allDay
        WHERE 
          id = @id
      `;
  
      poolRequest.input('id', id);
      poolRequest.input('startDate', startDateInput);
      poolRequest.input('endDate', endDateInput);
      poolRequest.input('recurrenceRule', recurrenceRule);
      poolRequest.input('text', text);
      poolRequest.input('allDay', allDay);
  
      const postUserNot = await poolRequest.query(query);
  
      res.status(200).json({ status: 200, data: postUserNot.recordset });
    } catch (error) {
      console.error(error);
      res.status(400).json({ status: 400, data: [] });
    }
  });
  router.post('/getTakvim', async (req, res, next) => {
    try {
      let user_id = req.body.user_id
      await pool.connect()
      const poolRequest = await pool.request();
      const postUserNot = await poolRequest.query(`SELECT * FROM appointment WHERE incumbent = ${user_id}`)
      let egitim_id = postUserNot.recordset
      res.send({
        status: 200,
        data: egitim_id
      });
    } catch (error) {
      res.send({
        status: 400, data: []
      });
    }
  
  })
  router.post('/deleteTakvim', async (req, res, next) => {
    try {
      const id = req.body.id;
  
      await pool.connect();
      const poolRequest = await pool.request();
  
      // DELETE sorgusu ile kaydı silin
      const query = `
        DELETE FROM appointment 
        WHERE id = @id
      `;
  
      poolRequest.input('id', id);
  
      const postUserNot = await poolRequest.query(query);
  
      res.status(200).json({ status: 200, data: postUserNot.recordset });
    } catch (error) {
      console.error(error);
      res.status(400).json({ status: 400, data: [] });
    }
  
  })
  
  router.post('/getAtananTakvim', async (req, res, next) => {
    try {
      let assignor_id = req.body.user_id
      await pool.connect()
      const poolRequest = await pool.request();
      const postUserNot = await poolRequest.query(`SELECT * FROM appointment  WHERE assignor_id = ${assignor_id}`)
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

  router.post("/bodroistek", async (req, res) => {
    try {
  
      let user_id = req.body._id
      let user_sicil = req.body.telephone
      await pool.connect()
      const poolRequest = await pool.request();
      let trues = true
      let falses = false
  
      const getData = await poolRequest.query(`SELECT bo.* FROM bodroistek bi INNER JOIN bodro bo ON bi.user_id = '${user_id}' and bi.istekalindi = '${trues}' and bi.isekacildi = '${falses}' AND bo.user_id = '${user_id}' AND bo.user_id = bi.user_id`)
  
      if (!getData.recordset[0]) {
        res.json({
          "status": 400,
          data: []
        })
      } else {
        //const getBodro = await pool.query("SELECT * FROM bodro WHERE user_id = $1 ",[user_id])//tarih alanı ekelenecek
        res.json({
          "status": 200,
          data: getData.recordset
        })
  
        let istektamamla = await poolRequest.query(`UPDATE bodroistek SET isekacildi='${trues}'`)
      }
    } catch (err) {
      console.error(err.message);
    }
  });
  router.post("/mail/send", async (req, res) => {
  
  
    // dataları ayırştırıp bodro iste tablosu oluşturulacak 
    // data istenmişmi kontrol edilecek eğer data  
    try {
  
      let transporter = nodemailer.createTransport({
        host: '20.0.0.20',
        port: 25,
        secure: false,
  
        auth: {
          user: 'bilgi@aho.com',
          pass: 'Bilgi5858!'
        },
        tls: {
          rejectUnauthorized: false
        }
      });
      let mailOptions = {
        from: 'bilgi@aho.com',
        to: req.body.email,
        cc: '',
        subject: 'Bordro Erişim Mailidir.',
        text: 'Sayın' + req.body.name + ' Talep etmiş olduğunuz bordroya ' + "http://portal.aho.com/#/apps/bodro/add-goruntule" + " adresinden ulaşabilirsiniz." + " Paylaşılan link üzerinden bordronuza tek seferlik ulaşabilirisiniz."
      };
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.log(error);
        } else {
          console.log('Email sent: ' + info.response);
        }
      });
  
    } catch (err) {
      console.error(err.message);
    }
  
    try {
      await pool.connect()
      const poolRequest = await pool.request();
      let istekalindi = true
      let istekacildi = false
      const newTarih = new Date()
      const newData = await poolRequest.query(`INSERT INTO bodroistek (user_name,user_id,istenen_ay,istekalindi,isekacildi) VALUES('${req.body.name}','${req.body._id}','${newTarih}','${istekalindi}','${istekacildi}')`)
      const getBodro = await poolRequest.query(`SELECT * FROM bodroistek WHERE user_id = ${req.body._id}`)
      res.json({ "status": 200, newData, getBodro })
    } catch (err) {
      console.error(err.message);
    }
  });


  module.exports = router;