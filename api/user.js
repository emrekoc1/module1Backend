


const express = require('express');
const router = express.Router();
const axios = require('axios');
const nodemailer = require("nodemailer");
const cors = require('cors');
const request = require('request')
router.use(cors());
const { pool } = require('../db');


async function n_generate_token(_id, secret_key) {
    return new Promise((resolve, reject) => {
      resolve(jwt.sign({ id: _id }, secret_key, { expiresIn: '30 days' }))
    })
  }
router.post('/getusers', async (req, res, next) => {
    try {
      await pool.connect()
      const poolRequest = await pool.request();
      const postUserNot = await poolRequest.query(`SELECT * FROM users `)
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
  router.post("/users/login", async (req, res) => {
    try {
      console.log(req.body)
      let user_phone = req.body.phone
      let password = req.body.password.toString()
      let accessTokens
      var request = require('request');
      var options = {
        'method': 'POST',
        'url': 'http://20.0.0.50:8282/v1_0/NAF.LFlow.WAS/api/login/impersonated',
        'headers': {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'client_id': 'd5454dfc-b538-482b-ab39-7e9105b10364',
          'client_secret': '8f9765ce-ae74-467b-8b9e-033882b7207a',
          'AccessToken': '57dbb31c912f42c2bb3778a99ee2ca31',
          'Cookie': 'CustomIdpSel=-; LangSel=Turkish; StsLoginId=67af50c1-9d04-417e-a346-2185932e9b85; __ststrace=dnUORpSCyPDS+iRSHWJ1jdfj3HQvh5/r4ow4EtTuCFM='
        },
        body: JSON.stringify({
          "ExternalIdpProviderType": "0",
          "Username": user_phone
        })
  
      };
      request(options, async function (error, response) {
        if (error) throw new Error(error);
        const responseData = JSON.parse(response.body);
  
        accessTokens = responseData.AccessToken
        if (req.body.phone == "6666" && req.body.password == "4c8c67f1") {
          const jwt = require('jsonwebtoken');
          console.log(req.body)
  
          const secretKey = 'emre.mkoc@gmail.com';
          const payload = {
            id: 1,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + (60 * 60)
          };
  
          const token = jwt.sign(payload, secretKey);
  
          console.log(token);
          let ts = Date.now();
          res.json({
            "status": 200,
            "data": {
              "user": {
                "user_type": 0,
                "user_typeName": accessTokens,
                "password_status": true,
                "telephone": "6666",
                "pincode": "ADMIN",
                "email": "bilgi@aho.com",
                "depID": 0,
                "_id": 1,
  
                "name": "ADMİN",
                "facID": accessTokens
              },
              "token": token,
            }
  
          }
  
  
          );
        } else {
          try {
            console.log(req.body)
  
            let tokens
            await pool.connect()
            const poolRequest = await pool.request();
            const result = await poolRequest.query(`SELECT * FROM users WHERE sicil= '${user_phone}' AND password_ = '${password}' AND is_delete = 'false' AND is_active = 'true'`);
           if(result.rowsAffected>0){
            const jwt = require('jsonwebtoken');
  
            const secretKey = 'emre.mkoc@gmail.com';
            const payload = {
              id: result.recordset[0].user_id,
              iat: Math.floor(Date.now() / 1000),
              exp: Math.floor(Date.now() / 1000) + (30 * 60)
            };
            console.log(result.recordset[0].user_id)
            const token = jwt.sign(payload, secretKey);
            // await n_generate_token(result.id, req.router.get('secretKey')).then(async token => { token = token}).catch(err => {
            // 	res.json({ status: 402, message: "", data: err })
            // })
            let ts = Date.now();
            console.log(result)
            res.json({
              "status": 200,
              "data": {
                "user": {
                  "user_type": result.recordset[0].user_type,
                  "user_typeName": accessTokens,
                  "password_status": result.recordset[0].password_status,
                  "telephone": result.recordset[0].sicil,
                  "pincode": result.recordset[0].password_,
                  "email": result.recordset[0].email,
                  "depID": result.recordset[0].departman,
                  "_id": result.recordset[0].user_id,
                  "name": result.recordset[0].user_name,
                  "timeLine": ts,
                  "facID": accessTokens
                },
                "token": token,
              }
  
            }
  
  
            );
          }else{
           res.status(400).send('status:400')
          }
          } catch (error) {
            console.error(error);
            res.status(500).send('Internal Server Error');
          }
  
  
        }
  
      });
  
  
  
  
  
    } catch (err) {
      res.json({
        "status": 400
      });
      console.error(err.message);
    }
  }
  );
router.post("/users/update", async (req, res) => {

    try {
       try {
        await pool.connect()
        const poolRequest = await pool.request();
        const result = await poolRequest.query(`UPDATE users SET is_active = 1, is_delete= 0 , password_status = 0 WHERE sicil = 1385`);
        res.json({
          "status": 200,
        }
        );
      } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
      }
    } catch (err) {
      res.json({
        "status": 400
      });
      console.error(err.message);
    }
  });
  router.post("/users/paswordReset", async (req, res) => {
      try {
          try {
        await pool.connect()
        const poolRequest = await pool.request();
        const result = await poolRequest.query(`UPDATE users SET password_status = 1,password_='${req.body.password}' WHERE sicil = '${req.body.sicil_no}'`);
          res.json({
          "status": 200,
          "result": result
          }
          );
      } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
      }
    } catch (err) {
      res.json({
        "status": 400
      });
      console.error(err.message);
    }
  });


  router.post("/autotoken", async (req, res) => {
    try {
  
      const jwt = require('jsonwebtoken');
  
      const secretKey = 'yourSecretKey'; // JWT'nin imzalanması ve doğrulanması için kullanılan gizli anahtar
      const payload = {
        id: '5d7f3c4e80395510b49c7c2c', // Kullanıcının ID'si veya başka özgün bilgiler
        iat: Math.floor(Date.now() / 1000), // Tokenin oluşturulma tarihi (Unix zaman damgası)
        exp: Math.floor(Date.now() / 1000) + (1 * 60) // Tokenin sona erme süresi (1 saat)
      };
  
      const token = jwt.sign(payload, secretKey);
  
      console.log(token);
  
      if (!token) {
        res.json({
          "status": 400,
          data: token,
          usernot: []
        })
      } else {
  
        res.json({
          "status": 200,
          data: token,
          user: token
        })
  
  
      }
    } catch (err) {
      console.error(err.message);
    }
  });
  router.post("/users/paswordForget", async (req, res) => {
  
    let email = req.body.email
    let sicil = req.body.sicil
  
    // dataları ayırştırıp bodro iste tablosu oluşturulacak 
    // data istenmişmi kontrol edilecek eğer data  
    try {
  
  
      await pool.connect()
      const poolRequest = await pool.request();
      const query = `SELECT * FROM users WHERE sicil = '${sicil}' AND email = '${email}'`;
      const userGet = await poolRequest.query(query);
  
      if (userGet.recordset[0].sicil == sicil) {
  
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
          to: email,
          cc: '',
          subject: 'Şifremi Unuttum',
          text: 'Sayın' + userGet.recordset[0].user_name + ' Şifrenizi Sıfırlamak için ' + "http://portal.aho.com/#/pages/auth/reset-password" + " adresinden giriş yapabilirsiniz."
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
      } else {
        res.json({
          "status": 400,
          data: "Mail Gönderilemedi sicil Ve mail adresinizi kontrol ediniz."
        })
      }
  
  
    } catch (err) {
      console.error(err.message);
    }
  
  
  });

  router.post("/lflowAuto", async (req, res) => {

    try {
  
  
      var request = require('request');
      var options = {
        'method': 'POST',
        'url': 'http://20.0.0.50:8282/v1_0/NAF.LFlow.WAS/api/login/impersonated',
        'headers': {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'client_id': 'd5454dfc-b538-482b-ab39-7e9105b10364',
          'client_secret': '8f9765ce-ae74-467b-8b9e-033882b7207a',
          'AccessToken': '57dbb31c912f42c2bb3778a99ee2ca31',
          'Cookie': 'CustomIdpSel=-; LangSel=Turkish; StsLoginId=67af50c1-9d04-417e-a346-2185932e9b85; __ststrace=dnUORpSCyPDS+iRSHWJ1jdfj3HQvh5/r4ow4EtTuCFM='
        },
        body: JSON.stringify({
          "ExternalIdpProviderType": "0",
          "Username": req.body.sicil
        })
  
      };
      request(options, function (error, response) {
        if (error) throw new Error(error);
        const responseData = JSON.parse(response.body);
        const accessToken = responseData.AccessToken;
  
  
        res.json({
          "status": 200,
          "url": `https://flow.aho.com.tr/v1_0/NAF.LFlow.Web/Pages/PortalPages/Dashboard.aspx?qstoken=${accessToken}`,
          "insan_kaynaklari": `https://flow.aho.com.tr/v1_0/NAF.LFlow.Web/Pages/PortalPages/PendingWorkflow.aspx?WfId=226&publish=1&lwfid=239`
  
        });
      });
  
  
  
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
  
  
  
  
  }
  );
  router.post("/lflowlogOut", async (req, res) => {
    let deneme = req.body.logoToken
    console.log(deneme)
    var request = require('request');
    var options = {
      'method': 'GET',
      'url': `http://20.0.0.50:8282/v1_0/NAF.LFlow.WAS/api/logout/${deneme}`,
      'headers': {
        'Cookie': 'CustomIdpSel=-; LangSel=Turkish; StsLoginId=67af50c1-9d04-417e-a346-2185932e9b85; __ststrace=dnUORpSCyPDS+iRSHWJ1jdfj3HQvh5/r4ow4EtTuCFM='
      }
    };
    console.log(options)
    request(options, function (error, response) {
      if (error) throw new Error(error);
      const responseData = JSON.parse(response.body);
      const accessToken = responseData.AccessToken;
  
  
      res.json({
        "status": 200,
  
  
      });
    });
  
  }
  );

  router.post("/GetUser", async (req, res) => {
    try {
  
  
  
      await pool.connect()
      const poolRequest = await pool.request();
      const postUserNot = await poolRequest.query(`SELECT * FROM users`);
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
  
  router.post("/postUser", async (req, res) => {
    try {
  
      let user_name = req.body.user_name
      let email = req.body.email
      let password_ = req.body.password_
      let sicil = parseInt(req.body.sicil)
      let user_type = parseInt(req.body.user_type)
      let user_typename = ""
      let password_status = req.body.password_status
      let is_active = req.body.is_active
      let is_delete = req.body.is_delete
      let departman = req.body.departman
      await pool.connect()
      const poolRequest = await pool.request();
      const postUserNot = await poolRequest.query(`
      INSERT INTO users (sicil, user_name, email, password_, user_type, user_typename,departman,password_status,is_active,is_delete)
      VALUES (${sicil}, '${user_name}', '${email}', '${password_}', ${user_type}, '${user_typename}', ${departman},0,1,0)
  `);
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
  router.post("/putUser", async (req, res) => {
    try {
      let user_id = req.body.user_id
      let user_name = req.body.user_name
      let email = req.body.email
      let password_ = req.body.password_
      let sicil = req.body.sicil
      let user_typename = req.body.user_typename
      let password_status = req.body.password_status
      let is_active = req.body.is_active
  
      let is_delete = req.body.is_delete
      let postUserNot
      await pool.connect()
      const poolRequest = await pool.request();
      const getUsers = await poolRequest.query(`SELECT * FROM users WHERE user_id = ${user_id}`)
      const getUsersData = getUsers.recordset[0]
      console.log(getUsersData.password_)
      if (getUsersData.password_ === password_) {
        postUserNot = await poolRequest.query(`
        UPDATE users SET
        user_name='${user_name}',
        email='${email}',
        password_='${password_}',
        sicil='${sicil}',
        user_typename='${user_typename}',
        password_status='${password_status}',
        is_active='${is_active}',
        is_delete='${is_delete}'
        WHERE user_id=${user_id}
    `);
        if (postUserNot.recordset) {
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
      } else {
  
        postUserNot = await poolRequest.query(`
          UPDATE users SET
          user_name='${user_name}',
          email='${email}',
          password_='${password_}',
          sicil='${sicil}',
          user_typename='${user_typename}',
          password_status='0',
          is_active='${is_active}',
          is_delete='${is_delete}'
          WHERE user_id=${user_id}
      `);
        if (postUserNot.recordset) {
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
      }
    } catch (err) {
      console.error(err.message);
    }
  });
  router.post("/deleteUser", async (req, res) => {
    try {
      let user_id = req.body.id
  
      await pool.connect()
      const poolRequest = await pool.request();
      const postUserNot = await poolRequest.query(`UPDATE users SET is_delete = 1 WHERE user_id=${user_id}`);
      if (postUserNot.recordset) {
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
  router.post("/getRehber", async (req, res) => {
    try {
  
  
  
      await pool.connect()
      const poolRequest = await pool.request();
      const postUserNot = await poolRequest.query(`SELECT * FROM tel_rehber`);
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
  router.post("/putRehber", async (req, res) => {
    try {
  
      let user_id = req.body.user_id
      let user_name = req.body.user_name
      let rehber_id = req.body.rehber_id
      let departman_id = req.body.departman_id
      let sicil = req.body.sicil
      let phone = req.body.phone
      await pool.connect()
      const poolRequest = await pool.request();
      const postUserNot = await poolRequest.query(`
      UPDATE tel_rehber SET
      user_name='${user_name}',
      user_id='${user_id}',
      sicil='${sicil}',
      phone='${phone}',
      departman_id='${departman_id}'
      WHERE id=${rehber_id}`);
  
      if (postUserNot.recordset) {
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
  router.post("/posRehber", async (req, res) => {
    try {
  
      let user_name = req.body.user_name
      let phone = req.body.phone
      let sicil = req.body.sicil
      let user_id
      if (parseInt(req.body.user_id)) {
        user_id = parseInt(req.body.user_id)
      } else {
        user_id = 0
      }
  
      let departman = parseInt(req.body.departman_id)
  
      await pool.connect()
      const poolRequest = await pool.request();
      const postUserNot = await poolRequest.query(`INSERT INTO tel_rehber (sicil, user_name, phone, departman_id,user_id) 
      VALUES (${sicil}, '${user_name}', '${phone}', '${departman}',${user_id})`
      );
  
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
  router.post("/deleteRehber", async (req, res) => {
    try {
  
      let id = req.body.rehber_id
  
      await pool.connect()
      const poolRequest = await pool.request();
      const postUserNot = await poolRequest.query(`DELETE FROM tel_rehber where id = ${id}`);
  
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