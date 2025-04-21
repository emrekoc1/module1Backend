
const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const axios = require('axios');
const nodemailer = require("nodemailer");
const cors = require('cors');
const { format } = require('date-fns');
const http = require('http');
const request = require('request')
router.use(cors());
const pool = require('./db');
const { machine } = require('os');
const multer = require('multer');
const path = require('path');
const transliteration = require('transliteration');

const fs = require("fs");



const toDoDocs = multer.diskStorage({

  destination: (req, file, callBack) => {
    const destinationPath = path.join(__dirname, '..', '..', '..', '..', '..', '..', 'wamp64', 'www', 'assets', 'docs');
    //const destinationPath = path.join(__dirname, '..', 'front end', 'front end', 'src', 'assets', 'docs');
    callBack(null, destinationPath)
  },

  filename: (req, file, callBack) => {
    const bugun = new Date();
    const tarihDamgasi = bugun.toISOString().replace(/[:.]/g, '').substring(0, 10); // Sadece '2023-08-25' bölümü
    const originalnameWithoutExtension = path.parse(file.originalname).name;
    const transliteratedName = transliteration.slugify(originalnameWithoutExtension, { lowercase: false });
    callBack(null, `todo_icerik_${tarihDamgasi}${transliteratedName}${path.extname(file.originalname)}`);

  }


})
const uploadTodo = multer({ storage: toDoDocs })

router.get('/getUlkeler', cors(), async (req, res) => {

  try {

    const jsonBomList = fs.readFileSync('countries.json', 'utf8');
    const sqlData = JSON.parse(jsonBomList);



    res.status(200).json({ status: 200, data: sqlData });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})
router.post('/getSehirler', cors(), async (req, res) => {
  const { country_id } = req.body
  try {
    const jsonBomList = fs.readFileSync('states.json', 'utf8');
    const sqlData = JSON.parse(jsonBomList);

    let filterData = sqlData.filter((item) => {

      return parseInt(item.country_id) === parseInt(country_id)
    })

    res.status(200).json({ status: 200, data: filterData });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})
router.post('/getCariCekDuzeltilecekss', cors(), async (req, res) => {
  const { country_id } = req.body
  try {

    const jsonBomList = fs.readFileSync('states.json', 'utf8');
    const sqlData = JSON.parse(jsonBomList);

    let filterData = sqlData.filter((item) => {
      return item.country_id === country_id
    })

    res.status(200).json({ status: 200, data: filterData });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})
router.get('/getSatinalmaType', cors(), async (req, res) => {
  const { country_id } = req.body
  try {

    const getType = await pool.query(`SELECT * FROM s_type `)
    let datas = getType.rows
    let dataArray = []
    datas.forEach(items => {
      dataArray.push({
        selected: false,
        type: items.type,
        id: items.id
      })
    })

    res.status(200).json({ status: 200, data: dataArray });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})
router.get('/getSatinalmaType', cors(), async (req, res) => {
  const { country_id } = req.body
  try {

    const getType = await pool.query(`SELECT * FROM s_type `)
    let datas = getType.rows
    let dataArray = []
    datas.forEach(items => {
      dataArray.push({
        selected: false,
        type: items.type,
        id: items.id
      })
    })

    res.status(200).json({ status: 200, data: dataArray });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})
router.post('/getCariGenelSearch', cors(), async (req, res) => {
  try {
    const name = req.body.name
    const getType = await pool.query(`SELECT 
    sc.*, 
    (SELECT json_agg(contact.*) FROM s_cari_contact contact WHERE sc.id = contact.cari_id) AS contact,
    (SELECT json_agg(scp.*) FROM s_cari_proje scp WHERE sc.id = scp.cari_id) AS proje,
    (SELECT json_agg(sct.*) FROM s_cari_type sct WHERE sc.id = sct.cari_id) AS alan,
    (SELECT json_agg(scc.*) FROM s_cari_comment scc WHERE sc.id = scc.cari_id) AS commnet,
    (SELECT json_agg(sca.*) FROM s_cari_ability sca WHERE sc.id = sca.cari_id) AS ability,
    (SELECT json_agg(scm.*) FROM s_cari_machine scm WHERE sc.id = scm.cari_id) AS machine,
    (select AVG(puan) from s_cari_puan WHERE sc.id = s_cari_puan.cari_id) as puan

FROM 
    s_cari sc
WHERE 
    sc.is_active = true AND sc.name LIKE '%${name}%' ORDER BY sc.id ASC
   `)
    let datas = getType.rows

    const jsonBomList = fs.readFileSync('states.json', 'utf8');
    const sqlData = JSON.parse(jsonBomList);
    const jsonCountry = fs.readFileSync('countries.json', 'utf8');
    const sqlDatas = JSON.parse(jsonCountry);
    for (let items of datas) {
      let filterData = sqlData.find((item) => {
        return item.id === items.city
      })
      let filterDataCount = sqlDatas.find((item) => {
        return parseInt(item.id) === parseInt(items.countrey)
      })
      items.country_name = filterDataCount.name
      items.city_name = filterData.name

    }

    res.status(200).json({ status: 200, data: datas });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})
router.post('/getCariProje', cors(), async (req, res) => {

  const filtre = req.body.filtre
  try {
    const getType = await pool.query(`SELECT 
    sc.*, 
    (SELECT json_agg(contact.*) FROM s_cari_contact contact WHERE sc.id = contact.cari_id) AS contact,
    (SELECT json_agg(scp.*) FROM s_cari_proje scp WHERE sc.id = scp.cari_id AND scp.proje_name = '${filtre}') AS proje,
    (SELECT json_agg(sct.*) FROM s_cari_type sct WHERE sc.id = sct.cari_id) AS alan,
    (SELECT json_agg(scc.*) FROM s_cari_comment scc WHERE sc.id = scc.cari_id) AS commnet,
    (SELECT json_agg(sca.*) FROM s_cari_ability sca WHERE sc.id = sca.cari_id) AS ability,
    (SELECT json_agg(scm.*) FROM s_cari_machine scm WHERE sc.id = scm.cari_id) AS machine
FROM 
    s_cari sc
	INNER JOIN s_cari_proje scp ON sc.id = scp.cari_id AND scp.proje_name = '${filtre}'
WHERE 
    sc.is_active = true 
ORDER BY 
    sc.id ASC
LIMIT 200  
OFFSET 0;`)
    let datas = getType.rows

    const jsonBomList = fs.readFileSync('states.json', 'utf8');
    const sqlData = JSON.parse(jsonBomList);
    const jsonCountry = fs.readFileSync('countries.json', 'utf8');
    const sqlDatas = JSON.parse(jsonCountry);
    for (let items of datas) {
      let filterData = sqlData.find((item) => {
        return item.id === items.city
      })
      let filterDataCount = sqlDatas.find((item) => {
        return parseInt(item.id) === parseInt(items.countrey)
      })
      items.country_name = filterDataCount.name
      items.city_name = filterData.name

    }

    res.status(200).json({ status: 200, data: datas });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})

router.post('/newTypeKaydet', cors(), async (req, res) => {

  const text = req.body.text
  try {
    const getType = await pool.query(`INSERT INTO s_type (type) Values('${text}')`)
    let datas = getType.rows



    res.status(200).json({ status: 200, data: datas });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})
router.post('/newMachineTurKaydet', cors(), async (req, res) => {

  const text = req.body.text
  try {
    const getType = await pool.query(`INSERT INTO s_machine_tur(text) Values('${text}')`)
    let datas = getType.rows



    res.status(200).json({ status: 200, data: datas });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})
router.post('/newMachineOzelikKaydet', cors(), async (req, res) => {

  const text = req.body.text
  try {
    const getType = await pool.query(`INSERT INTO s_machine_ozelik(text) Values('${text}')`)
    let datas = getType.rows



    res.status(200).json({ status: 200, data: datas });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})
router.post('/newKabiliyetKaydet', cors(), async (req, res) => {

  const text = req.body.text
  try {
    const getType = await pool.query(`INSERT INTO s_ability_text(text) Values('${text}')`)
    let datas = getType.rows



    res.status(200).json({ status: 200, data: datas });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})
router.post('/insertAbilityCari', cors(), async (req, res) => {

  const { id, projeler } = req.body
  try {
    const getType = await pool.query(`DELETE FROM s_cari_ability WHERE cari_id = $1`, [id])
    let datas = getType.rows
    projeler.forEach(async items => {

      if (items.teknik_ozelik) {
        const getType = await pool.query(`INSERT INTO s_cari_ability(ability_name,cari_id)VALUES($1,$2)`, [items.teknik_ozelik, id])
        let datas = getType.rows
      }

    })



    res.status(200).json({ status: 200, data: "datas" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})
router.post('/getCariAselsan', cors(), async (req, res) => {

  const filtre = req.body.filtre
  try {
    const getType = await pool.query(`SELECT 
    sc.*, 
    (SELECT json_agg(contact.*) FROM s_cari_contact contact WHERE sc.id = contact.cari_id) AS contact,
    (SELECT json_agg(scp.*) FROM s_cari_proje scp WHERE sc.id = scp.cari_id ) AS proje,
    (SELECT json_agg(sct.*) FROM s_cari_type sct WHERE sc.id = sct.cari_id ) AS alan,
    (SELECT json_agg(scc.*) FROM s_cari_comment scc WHERE sc.id = scc.cari_id) AS commnet,
    (SELECT json_agg(sca.*) FROM s_cari_ability sca WHERE sc.id = sca.cari_id) AS ability,
    (SELECT json_agg(scm.*) FROM s_cari_machine scm WHERE sc.id = scm.cari_id ) AS machine
FROM 
    s_cari sc
WHERE 
    sc.is_active = true AND sc.aselsan_okey = '${filtre}'
ORDER BY 
    sc.id ASC
LIMIT 200  
OFFSET 0;`)
    let datas = getType.rows

    const jsonBomList = fs.readFileSync('states.json', 'utf8');
    const sqlData = JSON.parse(jsonBomList);
    const jsonCountry = fs.readFileSync('countries.json', 'utf8');
    const sqlDatas = JSON.parse(jsonCountry);
    for (let items of datas) {
      let filterData = sqlData.find((item) => {
        return item.id === items.city
      })
      let filterDataCount = sqlDatas.find((item) => {
        return parseInt(item.id) === parseInt(items.countrey)
      })
      items.country_name = filterDataCount.name
      items.city_name = filterData.name

    }

    res.status(200).json({ status: 200, data: datas });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})
router.post('/getCariMachine', cors(), async (req, res) => {

  const filtre = req.body.filtre
  try {
    const getType = await pool.query(`SELECT 
    sc.*, 
    (SELECT json_agg(contact.*) FROM s_cari_contact contact WHERE sc.id = contact.cari_id) AS contact,
    (SELECT json_agg(scp.*) FROM s_cari_proje scp WHERE sc.id = scp.cari_id ) AS proje,
    (SELECT json_agg(sct.*) FROM s_cari_type sct WHERE sc.id = sct.cari_id ) AS alan,
    (SELECT json_agg(scc.*) FROM s_cari_comment scc WHERE sc.id = scc.cari_id) AS commnet,
    (SELECT json_agg(sca.*) FROM s_cari_ability sca WHERE sc.id = sca.cari_id) AS ability,
    (SELECT json_agg(scm.*) FROM s_cari_machine scm WHERE sc.id = scm.cari_id AND scp.makina_turu = '${filtre}') AS machine
FROM 
    s_cari sc
	INNER JOIN s_cari_machine scp ON sc.id = scp.cari_id AND scp.makina_turu = '${filtre}'
WHERE 
    sc.is_active = true 
ORDER BY 
    sc.id ASC
LIMIT 200  
OFFSET 0;`)
    let datas = getType.rows

    const jsonBomList = fs.readFileSync('states.json', 'utf8');
    const sqlData = JSON.parse(jsonBomList);
    const jsonCountry = fs.readFileSync('countries.json', 'utf8');
    const sqlDatas = JSON.parse(jsonCountry);
    for (let items of datas) {
      let filterData = sqlData.find((item) => {
        return item.id === items.city
      })
      let filterDataCount = sqlDatas.find((item) => {
        return parseInt(item.id) === parseInt(items.countrey)
      })
      items.country_name = filterDataCount.name
      items.city_name = filterData.name

    }

    res.status(200).json({ status: 200, data: datas });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})
router.post('/getCariOzelik', cors(), async (req, res) => {

  const filtre = req.body.filtre
  try {
    const getType = await pool.query(`SELECT 
    sc.*, 
    (SELECT json_agg(contact.*) FROM s_cari_contact contact WHERE sc.id = contact.cari_id) AS contact,
    (SELECT json_agg(scp.*) FROM s_cari_proje scp WHERE sc.id = scp.cari_id ) AS proje,
    (SELECT json_agg(sct.*) FROM s_cari_type sct WHERE sc.id = sct.cari_id) AS alan,
    (SELECT json_agg(scc.*) FROM s_cari_comment scc WHERE sc.id = scc.cari_id) AS commnet,
    (SELECT json_agg(sca.*) FROM s_cari_ability sca WHERE sc.id = sca.cari_id  AND scp.ability_name = '${filtre}') AS ability,
    (SELECT json_agg(scm.*) FROM s_cari_machine scm WHERE sc.id = scm.cari_id) AS machine
FROM 
    s_cari sc
	INNER JOIN s_cari_ability scp ON sc.id = scp.cari_id AND scp.ability_name = '${filtre}'
WHERE 
    sc.is_active = true 
ORDER BY 
    sc.id ASC
LIMIT 200  
OFFSET 0;`)
    let datas = getType.rows

    const jsonBomList = fs.readFileSync('states.json', 'utf8');
    const sqlData = JSON.parse(jsonBomList);
    const jsonCountry = fs.readFileSync('countries.json', 'utf8');
    const sqlDatas = JSON.parse(jsonCountry);
    for (let items of datas) {
      let filterData = sqlData.find((item) => {
        return item.id === items.city
      })
      let filterDataCount = sqlDatas.find((item) => {
        return parseInt(item.id) === parseInt(items.countrey)
      })
      items.country_name = filterDataCount.name
      items.city_name = filterData.name

    }

    res.status(200).json({ status: 200, data: datas });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})
router.post('/getCariAlan', cors(), async (req, res) => {

  const filtre = req.body.filtre
  try {
    const getType = await pool.query(`SELECT 
    sc.*, 
    (SELECT json_agg(contact.*) FROM s_cari_contact contact WHERE sc.id = contact.cari_id) AS contact,
    (SELECT json_agg(scp.*) FROM s_cari_proje scp WHERE sc.id = scp.cari_id ) AS proje,
    (SELECT json_agg(sct.*) FROM s_cari_type sct WHERE sc.id = sct.cari_id AND scp.type = '${filtre}') AS alan,
    (SELECT json_agg(scc.*) FROM s_cari_comment scc WHERE sc.id = scc.cari_id) AS commnet,
    (SELECT json_agg(sca.*) FROM s_cari_ability sca WHERE sc.id = sca.cari_id) AS ability,
    (SELECT json_agg(scm.*) FROM s_cari_machine scm WHERE sc.id = scm.cari_id) AS machine
FROM 
    s_cari sc
	INNER JOIN s_cari_type scp ON sc.id = scp.cari_id AND scp.type = '${filtre}'
WHERE 
    sc.is_active = true 
ORDER BY 
    sc.id ASC
LIMIT 200  
OFFSET 0;`)
    let datas = getType.rows

    const jsonBomList = fs.readFileSync('states.json', 'utf8');
    const sqlData = JSON.parse(jsonBomList);
    const jsonCountry = fs.readFileSync('countries.json', 'utf8');
    const sqlDatas = JSON.parse(jsonCountry);
    for (let items of datas) {
      let filterData = sqlData.find((item) => {
        return item.id === items.city
      })
      let filterDataCount = sqlDatas.find((item) => {
        return parseInt(item.id) === parseInt(items.countrey)
      })
      items.country_name = filterDataCount.name
      items.city_name = filterData.name

    }

    res.status(200).json({ status: 200, data: datas });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})
router.get('/getCariGenel', cors(), async (req, res) => {
  try {
    const getType = await pool.query(`SELECT 
    sc.*, 
    (SELECT json_agg(contact.*) FROM s_cari_contact contact WHERE sc.id = contact.cari_id) AS contact,
    (SELECT json_agg(scp.*) FROM s_cari_proje scp WHERE sc.id = scp.cari_id) AS proje,
    (SELECT json_agg(sct.*) FROM s_cari_type sct WHERE sc.id = sct.cari_id) AS alan,
    (SELECT json_agg(scc.*) FROM s_cari_comment scc WHERE sc.id = scc.cari_id) AS commnet,
    (SELECT json_agg(sca.*) FROM s_cari_ability sca WHERE sc.id = sca.cari_id) AS ability,
    (SELECT json_agg(scm.*) FROM s_cari_machine scm WHERE sc.id = scm.cari_id) AS machine,
    (select AVG(puan) from s_cari_puan WHERE sc.id = s_cari_puan.cari_id) as puan

FROM 
    s_cari sc
WHERE 
    sc.is_active = true ORDER BY sc.id ASC
    LIMIT 200  -- Change this to the number of results you want per page
    OFFSET 0; `)
    let datas = getType.rows

    const jsonBomList = fs.readFileSync('states.json', 'utf8');
    const sqlData = JSON.parse(jsonBomList);
    const jsonCountry = fs.readFileSync('countries.json', 'utf8');
    const sqlDatas = JSON.parse(jsonCountry);
    for (let items of datas) {
      let filterData = sqlData.find((item) => {
        return item.id === items.city
      })
      let filterDataCount = sqlDatas.find((item) => {
        return parseInt(item.id) === parseInt(items.countrey)
      })
      items.country_name = filterDataCount.name
      items.city_name = filterData.name

    }

    res.status(200).json({ status: 200, data: datas });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})
router.post('/putCari', cors(), async (req, res) => {
  const { id, name,
    countrey,
    city,
    aselsan_okey,
    is_active,
    proje,
    yetenek,
    payment_method,
    mail,
    birim,
    tiger_kod,
    comment } = req.body
  try {
    const updateCariQuery = await pool.query(`Update s_cari SET name=$2, countrey=$3, city=$4, aselsan_okey=$5, is_active=$6, payment_method=$7,tiger_kod=$8 WHERE id = $1`,
      [id, name, countrey, city, aselsan_okey, is_active, payment_method, tiger_kod])


    res.status(200).json({ status: 200, data: "Kayıt Yapıldı" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})
router.post('/insertTypeCari', cors(), async (req, res) => {
  const { id, type } = req.body
  try {
    const updateCariQuery = await pool.query(`insert into s_cari_type (cari_id,type) VALUES ($1,$2)`,
      [id, type])


    res.status(200).json({ status: 200, data: "Kayıt Yapıldı" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})
router.post('/putProjeCari', cors(), async (req, res) => {
  const { id, projeler } = req.body
  try {

    const deleteCariQuery = await pool.query(`delete from s_cari_proje WHERE cari_id = $1`, [id])
    projeler.forEach(async items => {
      const updateCariQuery = await pool.query(`insert into s_cari_proje (cari_id,proje_name) VALUES ($1,$2)`,
        [id, items.proje])
    })



    res.status(200).json({ status: 200, data: "Kayıt Yapıldı" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})
router.post('/insertProjeCari', cors(), async (req, res) => {
  const { id, proje } = req.body
  try {
    const updateCariQuery = await pool.query(`insert into s_cari_proje (cari_id,proje_name) VALUES ($1,$2)`,
      [id, proje])


    res.status(200).json({ status: 200, data: "Kayıt Yapıldı" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})
router.post('/insertCommentCari', cors(), async (req, res) => {
  const { id, comment, birim } = req.body
  try {
    const updateCariQuery = await pool.query(`insert into s_cari_comment (cari_id,birim,comment1) VALUES ($1,$2,$3)`,
      [id, birim, comment])


    res.status(200).json({ status: 200, data: "Kayıt Yapıldı" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})
router.post('/putTypeCari', cors(), async (req, res) => {
  const { id, typeArray } = req.body
  try {

    const deleteTypeCari = await pool.query(`DELETE FROM  s_cari_type Where cari_id = $1`, [id])
    typeArray.forEach(async items => {
      const updateCariQuery = await pool.query(`insert into s_cari_type (cari_id,type) VALUES ($1,$2)`,
        [id, items.type])
    })



    res.status(200).json({ status: 200, data: "Kayıt Yapıldı" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})


// function getToken(callback) {
//   const tokenOptions = {
//     method: 'GET',
//     url: 'http://20.0.0.14:32001/api/v1/token',
//     headers: {
//       Authorization: 'Basic TEVWRUxCSUxJU0lNOkdiVUNoeEU3elFUdzJYWWNjdHdzcTZTQkUzODdLQmF1dE94RWNScnR6cFE9',
//       'Content-Type': 'application/json',
//       Accept: 'application/json'
//     },
//     body: 'grant_type=password&username=level&firmno=224&password=l123456*'
//   };

//   request(tokenOptions, function (error, response, body) {

//     if (error) {
//       callback(error, null);

//       return;
//     }
//     const access_token = JSON.parse(body); // access_token değerini al
//     callback(null, access_token);
//   });
// }
function makeRequest(options) {
  return new Promise((resolve, reject) => {
    request(options, (error, response, body) => {
      if (error) return reject(error);
      resolve(JSON.parse(body));
    });
  });
}
// router.post('/geciciCari', cors(), async (req, res) => {
//   try {
//     getToken(async (error, access_token) => {
//       if (error) {
//         console.error(error);
//         res.status(500).json({ error: 'Internal Server Error' });
//         return;
//       }

//       // Fetch total count of customers
//       const musteriCountUrl = `http://20.0.0.14:32001/api/v1/queries?tsql=SELECT COUNT(*) as toplam_veri FROM LG_225_CLCARD`;
//       const musteriControlIslem = {
//         method: 'GET',
//         url: musteriCountUrl,
//         headers: {
//           Authorization: `Bearer ${access_token.access_token}`,
//           'Content-Type': 'application/json',
//           Accept: 'application/json'
//         }
//       };

//       try {
//         const countResponse = await makeRequest(musteriControlIslem);
//         const musteriSayisi = countResponse.items[0].toplam_veri; // Adjust to your data structure
//         let offset = 0;
//         const limit = 10;

//         while (offset < musteriSayisi) {
//           const urlUretimEmri = `http://20.0.0.14:32001/api/v1/Arps?offset=${offset}&limit=${limit}`;
//           const optionsUretimEmri = {
//             method: 'GET',
//             url: urlUretimEmri,
//             headers: {
//               Authorization: `Bearer ${access_token.access_token}`,
//               'Content-Type': 'application/json',
//               Accept: 'application/json'
//             }
//           };
//           console.log("Executing query with offset:", offset);

//           const dataResponse = await makeRequest(optionsUretimEmri);
//           const sqlData = dataResponse.items || [];
//           console.log("Data retrieved:", sqlData.length);

//           for (const item of sqlData) {
//             if (item.INTERNAL_REFERENCE != 1) {
//               try {
//                 const selectVarMi = await pool.query(`SELECT * FROM s_cari WHERE tiger_kod LIKE $1`, [`%${item.CODE}%`]);

//                 if (selectVarMi.rowCount === 0) {
//                   const insertCariQuery = await pool.query(
//                     `INSERT INTO s_cari (name, countrey, city, aselsan_okey, is_active, tiger_kod) VALUES($1, $2, $3, $4, $5, $6) RETURNING id`,
//                     [item.TITLE, item.COUNTRY, item.CITY, false, true, item.CODE]
//                   );
//                   const cari_id = insertCariQuery.rows[0].id;
//                   console.log(`Inserted new record with ID: ${cari_id}`);
//                 } else {
//                   console.log("Cari already exists:", item.CODE);
//                 }
//               } catch (dbError) {
//                 console.error('Database Error:', dbError);
//               }
//             }
//           }

//           offset += limit;
//         }

//         res.status(200).json({ message: 'Data processed successfully' });

//       } catch (error) {
//         console.error("Error in musteriControlIslem:", error);
//         res.status(500).json({ error: 'Internal Server Error' });
//       }
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: 'Internal Server Error' });
//   }
// });
router.post('/postNewCari', cors(), async (req, res) => {
  const { cari_name,
    ulke,
    sehir,
    onayli,
    is_active,
    proje,
    yetenek,
    odeme,
    mail,
    birim,
    tiger_kod,
    comment } = req.body
  try {
    const insertCariQuery = await pool.query(`INSERT INTO s_cari (name, countrey, city, aselsan_okey, is_active, payment_method,tiger_kod) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [cari_name, ulke, sehir, onayli, is_active, odeme, tiger_kod])
    const cari_id = insertCariQuery.rows[0].id
    for (let index = 0; index < mail.length; index++) {
      const insertCariMail = await pool.query(`INSERT INTO s_cari_contact(
      cari_id, contact_name, contact_mail,contact_tel)
      VALUES ($1,$2,$3,$4)`, [cari_id, mail[index].userName, mail[index].userMail, mail[index].telefon])
    }

    for (let index = 0; index < proje.length; index++) {
      const insertCariProje = await pool.query(`INSERT INTO s_cari_proje(
      cari_id, proje_name)
      VALUES ($1,$2)`, [cari_id, proje[index].proje])
    }
    for (let index = 0; index < yetenek.length; index++) {
      const insertCariType = await pool.query(`INSERT INTO s_cari_type(
      cari_id, type)
      VALUES ($1,$2)`, [cari_id, yetenek[index].type])
    }
    res.status(200).json({ status: 200, data: "Kayıt Yapıldı" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})
router.post('/postMachineIcerik', cors(), async (req, res) => {
  const { adet, cari_id, makina_turu, teknik_ozelik, teknik_ozelik2 } = req.body

  try {
    const updateMachine = await pool.query(
      `INSERT INTO s_cari_machine (adet, cari_id, makina_turu, teknik_ozelik, teknik_ozelik2) VALUES ($1,$2,$3,$4,$5)`,
      [adet, cari_id, makina_turu, teknik_ozelik, teknik_ozelik2]
    );

    res.status(200).json({ status: 200, data: "Kayıt Yapıldı" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})
router.post('/putMachineIcerik', cors(), async (req, res) => {
  const { adet, cari_id, id, makina_turu, teknik_ozelik, teknik_ozelik2 } = req.body

  try {
    const updateMachine = await pool.query(
      `UPDATE s_cari_machine 
  SET adet = $1, 
      cari_id = $2, 
      makina_turu = $3, 
      teknik_ozelik = $4,
      teknik_ozelik2 = $5
  WHERE id = $6`,
      [parseInt(adet), cari_id, makina_turu, teknik_ozelik, teknik_ozelik2, id]
    );

    res.status(200).json({ status: 200, data: "Kayıt Yapıldı" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})


router.post('/putContactIcerik', cors(), async (req, res) => {
  const { cari_id, id, contact_mail, contact_name, contact_tel } = req.body

  try {
    const updateContact = await pool.query(
      `UPDATE s_cari_contact 
  SET contact_mail = $1, 
      cari_id = $2, 
      contact_name = $3, 
      contact_tel = $4
  WHERE id = $5`,
      [contact_mail, cari_id, contact_name, contact_tel, id]
    );

    res.status(200).json({ status: 200, data: "Kayıt Yapıldı" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})
router.get('/getMachineTur', cors(), async (req, res) => {


  try {
    const getTur = await pool.query(
      `select DISTINCT  text as makina_turu from s_machine_tur`
    );

    const getOzelik = await pool.query(
      `select DISTINCT  text as teknik_ozelik  from s_ability_text  `
    );



    let data = {
      tur: getTur.rows,
      ozellik: getOzelik.rows,

    }
    res.status(200).json({ status: 200, data: data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})
router.post('/putCommentIcerik', cors(), async (req, res) => {
  const { cari_id, id, comment1, user_id, birim } = req.body

  try {
    const updateComment = await pool.query(
      `UPDATE s_cari_comment 
  SET comment1 = $1, 
      cari_id = $2, 
      user_id = $3, 
     birim=$5
  WHERE id = $4`,
      [comment1, cari_id, user_id, id, birim]
    );

    res.status(200).json({ status: 200, data: "Kayıt Yapıldı" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})







module.exports = router;
