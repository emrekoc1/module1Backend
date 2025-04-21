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
const multer = require('multer');
const path = require('path');
const transliteration = require('transliteration');
const { start } = require('repl');
const fs = require('fs').promises;

const QRCode = require('qrcode');


const storageDocs = multer.diskStorage({

  destination: (req, file, callBack) => {
    const destinationPath = path.join(__dirname, '..', '..', '..', '..', '..', '..', 'wamp64', 'www', 'bakim', 'assets', 'docs');
    //const destinationPath = path.join(__dirname, '..', 'front end', 'front end', 'src', 'assets', 'docs');
    callBack(null, destinationPath)
  },

  filename: (req, file, callBack) => {
    const bugun = new Date();
    const tarihDamgasi = bugun.toISOString().replace(/[:.]/g, '').substring(0, 10); // Sadece '2023-08-25' bölümü
    const originalnameWithoutExtension = path.parse(file.originalname).name;
    const transliteratedName = transliteration.slugify(originalnameWithoutExtension, { lowercase: false });
    callBack(null, `bakimDokuman${tarihDamgasi}${transliteratedName}${path.extname(file.originalname)}`);

  }


})
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
const uploadDocs = multer({ storage: storageDocs })
const uploadTodo = multer({ storage: toDoDocs })
router.post('/machineSingleGecmis', cors(), async (req, res) => {
  const id = req.body.machine_id;
  console.log(id)
  try {
    const result = await pool.query(`
    WITH machineGecmisLine AS (
      SELECT
          'Ariza' AS event_type,
          bma.bakim_tarihi as planlanan,
          bmbd.bakim_tarihi as gerceklesen,
          bma.durum as durum,
          bmbd.bakim_tur_name as bakim_tur_name,
          bmbd.bakim_tarihi as bakim_tarihi,
          bma.aciklama as ariza_aciklama,
          (SELECT json_agg(dokuman) 
           FROM (SELECT * FROM b_bakim_dokuman bbdok WHERE bbdok.bakim_detail_id = bmbd.id) dokuman) as dokuman,
          bmbd.aciklama as aciklama,
          bmbd.user_name as user_name,
          bmbd.secimler as secimler,
          bmbd.users as users,
          bmbd.malzemeler as malzemeler      
      FROM b_bakim_table bma 
      LEFT JOIN b_machine_bakim_detail bmbd ON bmbd.bakim_id = bma.id
      WHERE bma.machine_id = $1 AND bma.tur = 1
  
      UNION ALL
  
      SELECT
          'Aylik' AS event_type,
          bma.bakim_tarihi as planlanan,
          bmbd.bakim_tarihi as gerceklesen,
          bma.durum as durum,
          bmbd.bakim_tur_name as bakim_tur_name,
          bmbd.bakim_tarihi as bakim_tarihi,
          bma.aciklama as ariza_aciklama,
          NULL as dokuman,  -- Placeholder for missing column
          bmbd.aciklama as aciklama,
          bmbd.user_name as user_name,
          bmbd.secimler as secimler,
          bmbd.users as users,
          bmbd.malzemeler as malzemeler      
      FROM b_bakim_table bma 
      LEFT JOIN b_machine_bakim_detail bmbd ON bmbd.bakim_id = bma.id 
      WHERE bma.machine_id = $2 AND bma.tur = 0
  )
  SELECT 
      * 
  FROM 
      machineGecmisLine 
  ORDER BY 
  planlanan;
  `, [id, id]);
    const data = result.rows;
    res.status(200).json({ status: 200, data: data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})
router.post('/machineSingleGecmisOzel', cors(), async (req, res) => {
  const id = req.body.machine_id;
  const bakim_id = req.body.bakim_id;
  try {
    const result = await pool.query(`
    WITH machineGecmisLine AS (
      SELECT
          'Ariza' AS event_type,
          bma.bakim_tarihi as planlanan,
          bmbd.bakim_tarihi as gerceklesen,
          bma.durum as durum,
          (SELECT json_agg(dokuman) FROM(SELECT * FROM b_bakim_dokuman bbdok WHERE bbdok.bakim_detail_id = bmbd.id) dokuman) as dokuman,
          bmbd.bakim_tur_name as bakim_tur_name,
          bmbd.bakim_tarihi as bakim_tarihi,
          bma.aciklama as ariza_aciklama,
          bmbd.aciklama as aciklama,
          bmbd.user_name as user_name,
          bmbd.secimler as secimler,
          bmbd.users as users,
          bmbd.malzemeler as malzemeler      
      FROM b_bakim_table bma 
      LEFT JOIN b_machine_bakim_detail bmbd ON bmbd.bakim_id = bma.id
      WHERE bma.machine_id = $1 AND bma.tur = 1 AND bma.id=$4
  
      UNION ALL
  
      SELECT
          'Aylik' AS event_type,
          bma.bakim_tarihi as planlanan,
          bmbd.bakim_tarihi as gerceklesen,
          bma.durum as durum,
          (SELECT json_agg(dokuman) FROM(SELECT * FROM b_bakim_dokuman bbdok WHERE bbdok.bakim_detail_id = bmbd.id) dokuman) as dokuman,

          bmbd.bakim_tur_name as bakim_tur_name,
          bmbd.bakim_tarihi as bakim_tarihi,
          bma.aciklama as ariza_aciklama,

          bmbd.aciklama as aciklama,
          bmbd.user_name as user_name,
          bmbd.secimler as secimler,
          bmbd.users as users,
          bmbd.malzemeler as malzemeler      
      FROM b_bakim_table bma 
      LEFT JOIN b_machine_bakim_detail bmbd ON bmbd.bakim_id = bma.id 
      WHERE bma.machine_id = $2 AND bma.tur = 0 AND bma.id=$3
  )
  SELECT 
      * 
  FROM 
      machineGecmisLine 
  ORDER BY 
  planlanan;
  `, [id, id,bakim_id,bakim_id]);
    const data = result.rows;
    res.status(200).json({ status: 200, data: data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})
router.post('/cihazTopluEkleme', cors(), async (req, res) => {

  try {
    const data = await fs.readFile('duzenli.json', 'utf8');
    const gelenData = JSON.parse(data);
    for (const element of gelenData) {
      const makinaVarmi = await pool.query(
        `SELECT * FROM main_machines WHERE machines_name = $1`,
        [element.machines_kod]
      );
      let machine_id = 0
    
      if (makinaVarmi.rowCount > 0) {
        let updateData = makinaVarmi.rows[0]
        machine_id = updateData.id
        await pool.query(
          `UPDATE main_machines 
           SET machines_kod = $1, machines_model = $2, machines_marka = $3, cihaz_type = $4, yeri = $5, bakim_turu = $6 
           WHERE id = $7`,
          [
            element.machines_kod,
            element.machines_model,
            element.machines_marka,
            element.cihaz_type,
            element.yeri,
            element.bakim_turu,
            machine_id])
      } else {
        const machineData = {
          machines_name: element.machines_name,
          seri_no: element.machine_seri_no,
          birim: element.birim_id,
          machines_kod: element.machines_kod
        };
        const qrData = JSON.stringify(machineData);
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
        const machineInsert = await pool.query(`
        INSERT INTO public.main_machines(
          machines_name, seri_no, birim_id, durum, qr, birim_name, hat_id, bakim_turu, is_fason, machines_model, machines_marka, model_yil, cihaz_type, machines_kod,yeri
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,$15) 
        RETURNING id`,
          [
            element.machines_name,
            element.machine_seri_no,
            element.birim_id,
            0,
            qrCodeData,
            element.birim_name,
            element.hat_id,
            element.bakim_turu,
            false,
            element.machines_model,
            element.machines_marka,
            element.model_yil,
            element.cihaz_type,
            element.machines_kod,
            element.yeri
          ]
        );

        machine_id = machineInsert.rows[0].id;



      }
      let bakim_tarihi = element.bakim_tarih
      if (element.bakim_turu == 6) {
        let [day, month, year] = bakim_tarihi.split('.').map(Number);
        let date = new Date(year, month - 1, day); // month is 0-indexed in JavaScript Date
        for (let index = 0; index < 2; index++) {
          const bakimInsert = await pool.query(
            `INSERT INTO b_bakim_table (machine_id, bakim_tarihi, durum) VALUES ($1, $2, $3)`,
            [machine_id, date.toISOString().split('T')[0], 0]
          );
          date.setMonth(date.getMonth() + 6);
        }
      } else if (element.bakim_turu == 12) {
        let [day, month, year] = bakim_tarihi.split('.').map(Number);
        let date = new Date(year, month - 1, day); // month is 0-indexed in JavaScript Date
        const bakimInsert = await pool.query(
          `INSERT INTO b_bakim_table (machine_id, bakim_tarihi, durum) VALUES ($1, $2, $3)`,
          [machine_id, date.toISOString().split('T')[0], 0]
        );
      } else if (element.bakim_turu == 3) {
        let [day, month, year] = bakim_tarihi.split('.').map(Number);
        let date = new Date(year, month - 1, day); // month is 0-indexed in JavaScript Date
        for (let index = 0; index < 4; index++) {
          const bakimInsert = await pool.query(
            `INSERT INTO b_bakim_table (machine_id, bakim_tarihi, durum) VALUES ($1, $2, $3)`,
            [machine_id, date.toISOString().split('T')[0], 0]
          );
          date.setMonth(date.getMonth() + 3);
        }
      } else if (element.bakim_turu == 1) {
        let [day, month, year] = bakim_tarihi.split('.').map(Number);
        let date = new Date(year, month - 1, day); // month is 0-indexed in JavaScript Date
        for (let index = 0; index < 12; index++) {
          const bakimInsert = await pool.query(
            `INSERT INTO b_bakim_table (machine_id, bakim_tarihi, durum) VALUES ($1, $2, $3)`,
            [machine_id, date.toISOString().split('T')[0], 0]
          );
          date.setMonth(date.getMonth() + 1);
        }
      }

    }



    res.status(200).json({ status: 200, data: data });


  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})

router.post('/getAllHat', cors(), async (req, res) => {

  try {

    const getSql = await pool.query(`SELECT *  FROM machine_uretim_hat `)




    res.status(200).json({ status: 200, data: getSql.rows });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ status: 500, error: error.message });
  }
})
router.post('/cihazBakimOlustur', cors(), async (req, res) => {

  try {
    const { machine_id, bakim_tarih, bakim_turu } = req.body;
    let data = "başarılı";


    const createBakimTarihleri = async (startDate, intervals, intervalLength) => {
      let date = new Date(startDate);
      for (let index = 0; index < intervals; index++) {
        await pool.query(
          `INSERT INTO b_bakim_table (machine_id, bakim_tarihi, durum,tur) VALUES ($1, $2, $3,0)`,
          [machine_id, date.toISOString().split('T')[0], 0]
        );
        date.setMonth(date.getMonth() + intervalLength);
      }
    };

    let [day, month, year] = bakim_tarih.split('.').map(Number);
    let startDate = new Date(year, month - 1, day); // month is 0-indexed in JavaScript Date

    switch (bakim_turu) {
      case 6:
        await createBakimTarihleri(startDate, 2, 6);
        break;
      case 12:
        await createBakimTarihleri(startDate, 1, 12);
        break;
      case 3:
        await createBakimTarihleri(startDate, 4, 3);
        break;
      case 1:
        await createBakimTarihleri(startDate, 12, 1);
        break;
      case 4:
        await createBakimTarihleri(startDate, 4, 4);
        break;
      default:
        throw new Error("Unknown bakim_turu value");
    }

    res.status(200).json({ status: 200, data: data });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ status: 500, error: error.message });
  }
})
router.post('/bakimTarihErtele', cors(), async (req, res) => {

  try {
    const { machine_id,
      bakim_turu,
      bakim_tarih,
      bakim_id,
      eski_bakim_tarih } = req.body;


    const bakimErtele = await pool.query(`UPDATE public.b_bakim_table
    SET bakim_tarihi=$2,erteleme=true, ertelenen_tarih=$3
    WHERE id=$1`, [bakim_id, bakim_tarih, eski_bakim_tarih])





    res.status(200).json({ status: 200, data: bakimErtele.rows });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ status: 500, error: error.message });
  }
})

router.post('/insertMachineDokuman', uploadDocs.array('files'), async (req, res, next) => {
  const { machine_id, machine_name, dokuman_name, dokuman_turu } = req.body

  const files = req.files;



  if (!files) {
    const error = new Error('No File')
    error.httpStatusCode = 400

    return next(error)
  }
  try {
    let belge_url = `assets\\docs\\${files[0].filename}`

    result = await pool.query(`INSERT INTO public.b_main_machine_dokuman(
         name, dokuman_url, machine_id, makina_name,dokuman_turu)
        VALUES ('${dokuman_name}', '${belge_url}', ${machine_id}, '${machine_name}', '${dokuman_turu}');`);

    res.send({ status: 200 });
  } catch (error) {
    res.send({ status: 500,data:error });
  }

})


router.get('/machines', cors(), async (req, res) => {
  const id = req.params.code;
  try {

    const result = await pool.query('SELECT m.*, md.urunkodu,md.id as detail_id, SUM(mp.quantity) AS total_quantity, SUM(mp.qualtiy_quantity) AS total_qualtiy_quantity FROM machines m LEFT JOIN machine_detail md ON m.id = md.machines_id LEFT JOIN machine_product mp ON md.id = mp.machine_detail_id  WHERE  md.bitti = 0 GROUP BY  m.id, m.name, m.eksen, m.tur, m.firma, m.calisiyormu, md.urunkodu,md.id');
    const data = result.rows;

    res.status(200).json({ data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})


router.post('/getMachinesOnarim', cors(), async (req, res) => {

  try {

    const result = await pool.query(`SELECT * FROM `);
    const data = result.rows;
    res.status(200).json({ status: 200, data: data });


  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})

router.post('/insertMachineYeni', cors(), async (req, res) => {
  const {
    bakim_turu,
    birim_id,
    birim_name,
    cihaz_type,
    durum,
    firma,
    hat_id,
    is_fason,
    machines_kod,
    machines_marka,
    machines_model,
    machines_name,
    model_yil,
    seri_no,
    yeri,
    bakim_tarih
  } = req.body;

  try {
    const selectKontrol = await pool.query('SELECT * FROM main_machines WHERE seri_no = $1', [seri_no]);
    const dataVarmi = selectKontrol.rowCount;
    if (dataVarmi > 0) {
      res.status(200).json({ status: 300, data: "Seri Numarası Daha önce verilmiştir." });
    } else {
      try {
        const result = await pool.query(`INSERT INTO main_machines(
          bakim_turu,
	birim_id, 
	birim_name,	
	cihaz_type,
	durum,
	firma,
	hat_id, 
	is_fason, 
	machines_kod,
	machines_marka, 
	machines_model,
	machines_name,
	model_yil, 
	seri_no, 
	yeri)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,$15) RETURNING id`,
          [bakim_turu, birim_id, birim_name, cihaz_type, durum,
            firma, hat_id, is_fason, machines_kod, machines_marka, machines_model, machines_name, model_yil, seri_no, yeri]
        );
        let machine_id = result.rows[0].id;

        const machineData = {
          machine_name: machines_name,
          seri_no: seri_no,
          machine_id: machine_id
        };
        const qrData = JSON.stringify(machineData);
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

        await pool.query('UPDATE main_machines SET qr = $1 WHERE id = $2', [qrCodeData, machine_id]);

        const bakimIntervals = {
          1: 12,
          3: 4,
          4: 3,
          6: 2,
          12: 1
        };

        const intervalMonths = bakimIntervals[bakim_turu];
        if (intervalMonths) {
          let currentBakimTarih = new Date(bakim_tarih);
          for (let index = 0; index < intervalMonths; index++) {
            await pool.query(`INSERT INTO public.b_bakim_table(
              machine_id, bakim_tarihi, durum, tur)
              VALUES ($1, $2, 0, 0)`, [machine_id, currentBakimTarih.toISOString()]);
            currentBakimTarih.setMonth(currentBakimTarih.getMonth() + 12 / intervalMonths);
          }
        }

        res.status(200).json({ status: 200, data: result });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
router.post('/updateMachineYeni', cors(), async (req, res) => {
  const {
    bakim_turu, birim_id, birim_name, cihaz_type, durum, firma, hat_id, is_fason, machines_kod, machines_marka, machines_model, machines_name, model_yil, seri_no, yeri, bakim_tarih, id, bakimTarihiDegitirme, bakimTuruDegistirme
  } = req.body;

  try {

    try {
      const result = await pool.query(`UPDATE main_machines SET
          bakim_turu=$1,
          birim_id=$2, 
          birim_name=$3,	
          cihaz_type=$4,
          durum=$5,
          firma=$6,
          hat_id=$7, 
          is_fason=$8, 
          machines_kod=$9,
          machines_marka=$10, 
          machines_model=$11,
          machines_name=$12,
          model_yil=$13, 
          seri_no=$14, 
          yeri=$15
          WHERE id = $16`,
        [bakim_turu, birim_id, birim_name, cihaz_type, durum,
          firma, hat_id, is_fason, machines_kod, machines_marka, machines_model, machines_name, model_yil, seri_no, yeri, id]
      );


      const bakimIntervals = {
        1: 12,
        3: 4,
        4: 3,
        6: 2,
        12: 1
      };
      if (bakimTarihiDegitirme && !bakimTuruDegistirme) {
        const updateBakimTarihi = await pool.query(`UPDATE b_bakim_table SET bakim_tarihi = $1 
                          WHERE id = (SELECT id FROM b_bakim_table bbt WHERE bbt.machine_id = $2 AND bbt.tur = 0 AND bbt.durum != 3 
                          ORDER BY bbt.bakim_tarihi LIMIT 1)`, [bakim_tarih, id])
      }
      if (bakimTarihiDegitirme && bakimTuruDegistirme) {


        const eskiBakimlariKapat = await pool.query(`UPDATE b_bakim_table SET durum = 3 WHERE machine_id = $1 AND tur = 0`, [id])

        const intervalMonths = bakimIntervals[bakim_turu];
        if (intervalMonths) {
          let currentBakimTarih = new Date(bakim_tarih);
          for (let index = 0; index < intervalMonths; index++) {
            await pool.query(`INSERT INTO public.b_bakim_table(
              machine_id, bakim_tarihi, durum, tur)
              VALUES ($1, $2, 0, 0)`, [id, currentBakimTarih.toISOString()]);
            currentBakimTarih.setMonth(currentBakimTarih.getMonth() + 12 / intervalMonths);
          }
        }

      }

      res.status(200).json({ status: 200, data: result });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal Server Error' });
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
router.post('/makinaSil', cors(), async (req, res) => {
  const {
    bakim_turu, birim_id, birim_name, cihaz_type, durum, firma, hat_id, is_fason, machines_kod, machines_marka, machines_model, machines_name, model_yil, seri_no, yeri, bakim_tarih, id, bakimTarihiDegitirme, bakimTuruDegistirme
  } = req.body;

  try {

    try {
      const result = await pool.query(`UPDATE main_machines SET
          bakim_turu=$1,
          birim_id=$2, 
          birim_name=$3,	
          cihaz_type=$4,
          durum=$5,
          firma=$6,
          hat_id=$7, 
          is_fason=$8, 
          machines_kod=$9,
          machines_marka=$10, 
          machines_model=$11,
          machines_name=$12,
          model_yil=$13, 
          seri_no=$14, 
          yeri=$15,
          is_delete = true,
          is_active = false
          WHERE id = $16`,
        [bakim_turu, birim_id, birim_name, cihaz_type, durum,
          firma, hat_id, is_fason, machines_kod, machines_marka, machines_model, machines_name, model_yil, seri_no, yeri, id]
      );


      const bakimIntervals = {
        1: 12,
        3: 4,
        4: 3,
        6: 2,
        12: 1
      };




      const eskiBakimlariKapat = await pool.query(`UPDATE b_bakim_table SET durum = 3 WHERE machine_id = $1 AND tur = 0`, [id])





      res.status(200).json({ status: 200, data: result });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal Server Error' });
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;

// router.post('/insertMachine', cors(), async (req, res) => {
//   const { planlanan_tarih,
//     machine_name,
//     seri_no,
//     birim,
//     user_name,
//     durum_name,
//     durum,
//     birim_name,
//     hat_id,
//     user_id } = req.body
//   const machineData = {
//     machine_name: machine_name,
//     seri_no: seri_no,
//     birim: birim
//   };
//   const qrData = JSON.stringify(machineData);

//   try {
//     const selectKontrol = await pool.query(`SELECT * FROM main_machines WHERE seri_no ='${seri_no}'`)
//     const dataVarmi = selectKontrol.rowCount
//     if (dataVarmi > 0) {
//       res.status(200).json({ status: 300, data: "Seri Numarası Daha önce verilmiştir." });
//     } else {
//       try {
//         const qrCodeData = await new Promise((resolve, reject) => {
//           QRCode.toDataURL(qrData, (err, url) => {
//             if (err) {
//               console.error(err);
//               reject(err);
//             } else {
//               resolve(url);
//             }
//           });
//         });
//         const result = await pool.query(`INSERT INTO main_machines(machines_name, seri_no, birim_id, durum, qr,birim_name,hat_id)  VALUES ($1, $2, $3, $4, $5,$6,$7) RETURNING id`,
//           [machine_name, seri_no, parseInt(birim), durum, qrCodeData, birim_name, hat_id]
//         );

//         let machine_id = result.rows[0].id;

//         const tarihParcalari = planlanan_tarih.split('-');

//         const yil = parseInt(tarihParcalari[2], 10);
//         const ay = parseInt(tarihParcalari[1], 10) - 1;
//         const gun = parseInt(tarihParcalari[0], 10);
//         const tarihAylik = new Date(yil, ay, gun);
//         tarihAylik.setDate(tarihAylik.getDate() + (1 * 30));
//         const yeniTarih = `${tarihAylik.getDate()}.${tarihAylik.getMonth() + 1}.${tarihAylik.getFullYear()}`;
//         const tarih3Aylik = new Date(yil, ay, gun);
//         tarih3Aylik.setDate(tarih3Aylik.getDate() + (3 * 30));
//         const yeniTarih3 = `${tarih3Aylik.getDate()}.${tarih3Aylik.getMonth() + 1}.${tarih3Aylik.getFullYear()}`;
//         const tarih6Aylik = new Date(yil, ay, gun);
//         tarih6Aylik.setDate(tarih6Aylik.getDate() + (6 * 30));
//         const yeniTarih6 = `${tarih6Aylik.getDate()}.${tarih6Aylik.getMonth() + 1}.${tarih6Aylik.getFullYear()}`;
//         const tarih12Aylik = new Date(yil, ay, gun);
//         tarih12Aylik.setDate(tarih12Aylik.getDate() + (12 * 30));
//         const yeniTarih12 = `${tarih12Aylik.getDate()}.${tarih12Aylik.getMonth() + 1}.${tarih12Aylik.getFullYear()}`;

//         const insertMAchineAylik = await pool.query(`INSERT INTO b_machines_aylik(
//       p_aylik,  machines_id, durum)
//       VALUES ('${yeniTarih}', ${machine_id}, 0);`)
//         const insertMAchine3Aylik = await pool.query(`INSERT INTO b_machines_ucaylik(
//       p_ucaylik,  machines_id, durum)
//       VALUES ('${yeniTarih3}', ${machine_id}, 0);`)
//         const insertMAchine6Aylik = await pool.query(`INSERT INTO b_machines_altiaylik(
//         p_altiaylik,  machines_id, durum)
//         VALUES ('${yeniTarih6}', ${machine_id}, 0);`)
//         const insertMAchine12Aylik = await pool.query(`INSERT INTO b_machines_yillik(
//           p_yillik,  machines_id, durum)
//           VALUES ('${yeniTarih12}', ${machine_id}, 0);`)

//         res.status(200).json({ status: 200, data: result });


//       } catch (error) {
//         console.error(error);
//         res.status(500).json({ error: 'Internal Server Error' });
//       }
//     }

//   } catch (error) {
//     console.error(error)
//   }

// })
router.post('/putGuncelemeMachine', cors(), async (req, res) => {
  const { id, planlanan_tarih,
    machine_name,
    seri_no,
    birim,
    user_name,
    durum_name,
    durum,
    birim_name,
    hat_id,
    user_id } = req.body
  try {

    const result = await pool.query(`Update main_machines SET machines_name=$2, seri_no=$3, birim_id=$4, durum=$5, birim_name=$6,hat_id=$7 WHERE id = $1`,
      [id, machine_name, seri_no, parseInt(birim), durum, birim_name, hat_id]
    );
    res.status(200).json({ status: 200, data: result });

  } catch (error) {
    console.error(error)
  }

})
router.post('/getMachineAllList', cors(), async (req, res) => {
  try {
    let result, data
    result = await pool.query(`
    SELECT 
    mm.machines_name,
    mm.id,
    mm.machines_kod,
    mm.machines_marka,
    mm.yeri,
    mm.bakim_turu,
    (SELECT name FROM b_bakim_turu bbt WHERE mm.bakim_turu = bbt.bakim) AS bakim_tur_name,
    CASE
        WHEN mm.durum = 0 THEN 'Çalışıyor'
        WHEN mm.durum = 1 THEN 'Arızalı'
        WHEN mm.durum = 2 THEN 'Bekliyor'
        ELSE 'Bilinmeyen'
    END AS durum_name,
    (
        SELECT json_agg(bakim) 
        FROM (
            SELECT 
                bbt.tur,
                bbt.id,
                bbt.durum,
                CASE
                    WHEN bbt.durum = 0 AND bbt.tur = 0 THEN 'Bakim Tarihi Bekleniyor'
                    WHEN bbt.durum = 1 AND bbt.tur = 0 THEN 'Elektrik Bakımı Bekliyor'
                    WHEN bbt.durum = 2 AND bbt.tur = 0 THEN 'Mekanik Bakımı Bekliyor'
                    WHEN bbt.durum = 3 AND bbt.tur = 0 THEN 'Bakim Tamamlandı'
                    WHEN bbt.durum = 0 AND bbt.tur = 1 THEN 'Arızalı Makina'
                    WHEN bbt.durum = 1 AND bbt.tur = 1 THEN 'Elektrik Arızası Bekliyor'
                    WHEN bbt.durum = 2 AND bbt.tur = 1 THEN 'Mekanik Arızası Bekliyor'
                    WHEN bbt.durum = 3 AND bbt.tur = 1 THEN 'Arıza Giderildi'
                    ELSE 'Bilinmeyen'
                END AS bakim_turu,
                bbt.bakim_tarihi,
                (
                    SELECT json_agg(bakims) 
                    FROM (
                        SELECT 
                            bmbd.*,
                            (
                                SELECT json_agg(dokuman) 
                                FROM (
                                    SELECT * 
                                    FROM b_bakim_dokuman bbdok 
                                    WHERE bbdok.bakim_detail_id = bmbd.id 
                                ) AS dokuman
                            ) AS dokumans 
                        FROM b_machine_bakim_detail bmbd 
                        WHERE bbt.id = bmbd.bakim_id 
                    ) AS bakims
                ) AS bakims
            FROM b_bakim_table bbt 
            WHERE 
                mm.id = bbt.machine_id AND bbt.durum != 3 
                AND (
                    (bbt.durum IN (0, 1, 2) AND bbt.tur = 1) OR
                    (bbt.durum IN (0, 1, 2) AND bbt.tur = 0)
                )
            ORDER BY 
                CASE 
                    WHEN bbt.durum IN (0, 1, 2) AND bbt.tur = 1 THEN 1
                    WHEN bbt.durum IN (0, 1, 2) AND bbt.tur = 0 THEN 2
                    ELSE 3
                END,
                bbt.bakim_tarihi ASC
            LIMIT 1
        ) AS bakim
    ) AS bakim,
    (
        SELECT json_agg(dokuman) 
        FROM (
            SELECT * 
            FROM b_main_machine_dokuman bmmd 
            WHERE bmmd.machine_id = mm.id
        ) AS dokuman
    ) AS dokuman,
    mm.*
FROM main_machines mm WHERE mm.is_delete = false;

  
    `);
    data = result.rows;


    res.status(200).json({ status: 200, data: data });


  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})
router.post('/getAyrintiMachinesOnarim', cors(), async (req, res) => {
  const { machine_id, type, bakim_id } = req.body
  try {
    let result
    let data
    result = await pool.query(`
      SELECT * FROM b_machine_bakim_detail WHERE type= ${type} AND bakim_id =  ${bakim_id} AND machine_id =  ${machine_id}
  
    `);
    data = result.rows;


    res.status(200).json({ status: 200, data: data });


  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})
router.post('/getMachineDokuman', cors(), async (req, res) => {
  const { machine_id } = req.body
  try {
    let result
    let data

    result = await pool.query(`SELECT * FROM  b_main_machine_dokuman WHERE machine_id = ${machine_id}
        `);
    data = result.rows;


    res.status(200).json({ status: 200, data: data });


  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})
router.post('/todoGetData', cors(), async (req, res) => {

  try {
    let result
    let data

    result = await pool.query(`SELECT * FROM  b_machines_todo`);
    data = result.rows;


    res.status(200).json({ status: 200, data: data });


  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})
router.post('/todoGetDataSingle', cors(), async (req, res) => {
  try {

    const { value } = req.body
    let result, data
    if (parseInt(value) == 2) {
      result = await pool.query(`SELECT * FROM  b_machines_todo WHERE type = 1 OR type = 0`);
    } else {
      result = await pool.query(`SELECT * FROM  b_machines_todo WHERE type = ${value}`);
    }

    data = result.rows;

    res.status(200).json({ status: 200, data: data });


  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})

router.post('/todoPostData', cors(), async (req, res) => {

  try {
    let result
    let data

    result = await pool.query(`INSERT INTO b_machines_todo (aciklama,type)VALUES('${req.body.aciklama}',${req.body.type})`);
    data = result.rows;


    res.status(200).json({ status: 200, data: data });


  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})

router.post('/getGecmisMachinesOnarim', cors(), async (req, res) => {
  const { machine_id, type } = req.body

  try {
    let result
    let data

    switch (type) {
      case 1:
        result = await pool.query(`
      SELECT 
          mm.*,  ma.durum as aylik_durum,
          ma.p_aylik, ma.g_aylik, ma.id AS aylik_id, 
         
          json_agg(mbd_aylik.*) AS aylik_bakim
        
      FROM 
          main_machines mm
      LEFT JOIN 
          b_machines_aylik ma ON ma.machines_id = mm.id
     
      LEFT JOIN 
          b_machine_bakim_detail mbd_aylik ON ma.id = mbd_aylik.bakim_id
       WHERE mm.id = ${machine_id}
      GROUP BY 
          mm.id, ma.p_aylik, ma.g_aylik, ma.id
        `);
        data = result.rows;
        break;
      case 3:
        result = await pool.query(`
        SELECT 
            mm.*, mua.durum as ucaylik_durum,
            mua.id AS ucaylik_id, mua.p_ucaylik, mua.g_ucaylik, 
          json_agg(mbd_ucaylik.*) AS ucaylik_bakim
        FROM 
            main_machines mm
       
        LEFT JOIN 
            b_machines_ucaylik mua ON mua.machines_id = mm.id 
       
        
      
        LEFT JOIN 
            b_machine_bakim_detail mbd_ucaylik ON mua.id = mbd_ucaylik.bakim_id
      WHERE mm.id = ${machine_id}
        GROUP BY 
            mm.id, 
            mua.id, mua.p_ucaylik, mua.g_ucaylik
            `);
        data = result.rows;
        break;
      case 6:
        result = await pool.query(`  SELECT 
            mm.*,maa.durum as alti_durum,
           
            
            maa.id AS altiaylik_id, maa.p_altiaylik, maa.g_altiaylik, 
           
            json_agg(mbd_altiaylik.*) AS altiaylik_bakim
         
        FROM 
            main_machines mm
       
        LEFT JOIN 
            b_machines_altiaylik maa ON maa.machines_id = mm.id
     
        LEFT JOIN 
            b_machine_bakim_detail mbd_altiaylik ON maa.id = mbd_altiaylik.bakim_id
       WHERE mm.id = ${machine_id}
        GROUP BY 
            mm.id,
            maa.id, maa.p_altiaylik, maa.g_altiaylik
           `);
        data = result.rows;
        break;
      case 12:
        result = await pool.query(`
        SELECT 
            mm.*, my.durum as yillik_durum,
           
            my.id AS yillik_id, my.p_yillik, my.g_yillik, 
           
          json_agg(mbd_yillikaylik.*)as yillik_bakim
        FROM 
            main_machines mm
       
        LEFT JOIN 
            b_machines_yillik my ON my.machines_id = mm.id 
       
        LEFT JOIN 
            b_machine_bakim_detail mbd_yillikaylik ON my.id = mbd_yillikaylik.bakim_id WHERE mm.id = ${machine_id}
        GROUP BY 
            mm.id, 
            my.id, my.p_yillik, my.g_yillik`);
        data = result.rows;
        break;
      case 0:
        result = await pool.query(`
        SELECT 
        mm.*, mar.durum as ariza_durum,
       
        mar.id AS ariza_id, mar.ariza_tarih, mar.g_tarih,
      json_agg(mar_detail.*)as ariza_bakim
    FROM 
        main_machines mm
   
    LEFT JOIN 
    b_machines_ariza mar ON mar.machines_id = mm.id 
   
    LEFT JOIN 
        b_machine_bakim_detail mar_detail ON mar.id = mar_detail.bakim_id AND mar_detail.type=0 WHERE mm.id = ${machine_id}
    GROUP BY 
        mm.id, 
        mar.id, mar.ariza_tarih, mar.g_tarih`);
        data = result.rows;
        break;

      default:
        break;
    }

    res.status(200).json({ status: 200, data: data });


  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})




router.post('/putAylikMachinesOnarimGecici', cors(), async (req, res) => {
  try {
  
  const sqlMainMachines = await pool.query(`SELECT * FROM main_machines`)
  const mainMachinesResult = sqlMainMachines.rows
  mainMachinesResult.forEach(async element => {
    const queryBakimQuerys = await pool.query(` SELECT 
                bbt.tur,
                bbt.id,
                bbt.durum,
                CASE
                    WHEN bbt.durum = 0 AND bbt.tur = 0 THEN 'Bakim Tarihi Bekleniyor'
                    WHEN bbt.durum = 1 AND bbt.tur = 0 THEN 'Elektrik Bakımı Bekliyor'
                    WHEN bbt.durum = 2 AND bbt.tur = 0 THEN 'Mekanik Bakımı Bekliyor'
                    WHEN bbt.durum = 3 AND bbt.tur = 0 THEN 'Bakim Tamamlandı'
                    WHEN bbt.durum = 0 AND bbt.tur = 1 THEN 'Arızalı Makina'
                    WHEN bbt.durum = 1 AND bbt.tur = 1 THEN 'Elektrik Arızası Bekliyor'
                    WHEN bbt.durum = 2 AND bbt.tur = 1 THEN 'Mekanik Arızası Bekliyor'
                    WHEN bbt.durum = 3 AND bbt.tur = 1 THEN 'Arıza Giderildi'
                    ELSE 'Bilinmeyen'
                END AS bakim_turu,
                bbt.bakim_tarihi,
                (
                    SELECT json_agg(bakims) 
                    FROM (
                        SELECT 
                            bmbd.*,
                            (
                                SELECT json_agg(dokuman) 
                                FROM (
                                    SELECT * 
                                    FROM b_bakim_dokuman bbdok 
                                    WHERE bbdok.bakim_detail_id = bmbd.id 
                                ) AS dokuman
                            ) AS dokumans 
                        FROM b_machine_bakim_detail bmbd 
                        WHERE bbt.id = bmbd.bakim_id 
                    ) AS bakims
                ) AS bakims
            FROM b_bakim_table bbt 
            WHERE 
                ${element.id} = bbt.machine_id AND bbt.durum != 3 
                AND (
                    (bbt.durum IN (0, 1, 2) AND bbt.tur = 1) OR
                    (bbt.durum IN (0, 1, 2) AND bbt.tur = 0)
                )
            ORDER BY 
                CASE 
                    WHEN bbt.durum IN (0, 1, 2) AND bbt.tur = 1 THEN 1
                    WHEN bbt.durum IN (0, 1, 2) AND bbt.tur = 0 THEN 2
                    ELSE 3
                END,
                bbt.bakim_tarihi ASC
            LIMIT 1`)

  const resultBakim = queryBakimQuerys.rows[0]
    console.log(resultBakim)
    let datas = {
      "machine_id": element.id,
      "ariza_id": 'undefined',
      "bakim_turu": '2',
      "bakim_tarihi": '2024-08-26T08:40:42.572Z',
      "bakim_aciklama": 'deneme yapıld',
      "bakim_tur_name": 'Alt Yapı',
      "bakim_durumu": '3',
      "user_id": '371',
      "user_name": 'EMRE MÜCAHİT KOÇ',
      "islemler": '[{"id":1,"aciklama":"Bilyalar değiştirildi","type":0,"selected":true},{"id":2,"aciklama":"Yağ Değişimi Yapıldı","type":0,"selected":true},{"id":3,"aciklama":"Güç Girişleri Kontrol Edildi","type":1,"selected":true},{"id":4,"aciklama":"Yazılım Güncellemeleri yapıldı","type":1,"selected":true},{"id":5,"aciklama":"Düzeltme Yapıldı","type":0,"selected":true},{"id":6,"aciklama":"Dişliler Değişti","type":0,"selected":true},{"id":7,"aciklama":"Kayış Değişti","type":0,"selected":true},{"id":8,"aciklama":"deneme yapıld","type":1,"selected":true},{"id":9,"aciklama":"1 aylık 1. makina bakım","type":1,"selected":true},{"id":10,"aciklama":"kadir","type":1,"selected":true},{"id":11,"aciklama":"rulman değişimi","type":1,"selected":true},{"id":12,"aciklama":"GENEL","type":1,"selected":true},{"id":13,"aciklama":"GENEL","type":0,"selected":true},{"id":14,"aciklama":"SPİNDEL DEĞİŞTİ","type":1,"selected":true}]',
      "users": '[{"user_id":538,"email":"hyigit@aho.com","selected":true,"user_name":"HAMDİ YİĞİT","sicil":1430}]',
      "malzemeler": '[{"malzeme":"u"}]',
      "makina_bakim_turu": element.bakim_turu,
      "tur": '1',
      "bakip_tur_data": '0'
    }
    const {
      type,
      machine_id,
      bakim_turu,
      bakim_tarihi,
      ariza_id,
      bakim_aciklama,
      bakim_tur_name,
      bakim_detail,
      bakim_durumu,
      user_id,
      bakim_id,
      user_name,
      bakip_tur_data,
      tur,
      islemler, users, malzemeler, dokuman, makina_bakim_turu
    } = datas;
    let bakimdurum = bakim_durumu


    const islemlerParsed = JSON.parse(islemler);
    const usersParsed = JSON.parse(users);
    const malzemelerParsed = JSON.parse(malzemeler);





   
    if (bakimdurum == 3) {
      // const updateMainMachines = await pool.query(`UPDATE main_machines SET durum = 0 WHERE id = $1`, [machine_id]);

      // const sonBakimTarihiGetir = await pool.query(`SELECT max(bakim_tarihi) as bakim_tarihi FROM b_bakim_table WHERE machine_id = $1`, [machine_id]);
      // if (sonBakimTarihiGetir.rows.length === 0 || !sonBakimTarihiGetir.rows[0].bakim_tarihi) {
      //   throw new Error("No previous bakim_tarihi found for the machine");
      // }

      const bakimTarih = bakim_tarihi

      // Function to calculate new date based on months to add
      const calculateNewBakimTarihi = (bakimTarih, monthsToAdd) => {
        const date = new Date(bakimTarih);
        date.setMonth(date.getMonth() + monthsToAdd);
        return date;
      };

      let newBakimTarihi;
      switch (parseInt(makina_bakim_turu)) {
        case 6:
          newBakimTarihi = calculateNewBakimTarihi(bakimTarih, 6);
          break;
        case 12:
          newBakimTarihi = calculateNewBakimTarihi(bakimTarih, 12);
          break;
        case 3:
          newBakimTarihi = calculateNewBakimTarihi(bakimTarih, 3);
          break;
        case 4:
          newBakimTarihi = calculateNewBakimTarihi(bakimTarih, 4);
          break;
        case 1:
          newBakimTarihi = calculateNewBakimTarihi(bakimTarih, 1);
          break;
        default:
          throw new Error("Unknown makina_bakim_turu value");
      }
      if (bakip_tur_data != 1) {
        const bakimInsert = await pool.query(
          `INSERT INTO b_bakim_table (machine_id, bakim_tarihi, durum,tur) VALUES ($1, $2, $3,0)`,
          [machine_id, newBakimTarihi.toISOString(), 0]
        );
      }

    }
  });
  
    
  
    res.status(200).json({ status: 200 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/putAylikMachinesOnarim', uploadDocs.array('files'), cors(), async (req, res) => {
  try {
    const {
      type,
      machine_id,
      bakim_turu,
      bakim_tarihi,
      ariza_id,
      bakim_aciklama,
      bakim_tur_name,
      bakim_detail,
      bakim_durumu,
      user_id,
      bakim_id,
      user_name,
      bakip_tur_data,
      tur,
      islemler, users, malzemeler, dokuman, makina_bakim_turu
    } = req.body;
    console.log(req.body)
    const files = req.files;
    let bakimdurum = bakim_durumu


    if (!files) {
      const error = new Error('No File')
      error.httpStatusCode = 400

      return next(error)
    }
    const islemlerParsed = JSON.parse(islemler);
    const usersParsed = JSON.parse(users);
    const malzemelerParsed = JSON.parse(malzemeler);





    const insertBakimDetail = await pool.query(
      `INSERT INTO b_machine_bakim_detail(
        user_id, user_name, bakim_tarihi, aciklama, bakim_detail, bakim_tur_name, bakim_id, machine_id, secimler, users, malzemeler)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [user_id, user_name, bakim_tarihi, bakim_aciklama, bakim_detail, bakim_tur_name, bakim_id, machine_id, islemlerParsed, usersParsed, malzemelerParsed]
    );
    if (tur == 2) {
      const updateMainMachines = await pool.query(`UPDATE main_machines SET durum = 0 WHERE id =$1`, [machine_id])
      bakimdurum = 3
    }
    const bakim_detail_id = insertBakimDetail.rows[0].id;
    const updateBakim = await pool.query(`UPDATE b_bakim_table SET durum = $2 WHERE id = $1`, [bakim_id, bakimdurum]);

    if (bakimdurum == 3) {
      const updateMainMachines = await pool.query(`UPDATE main_machines SET durum = 0 WHERE id = $1`, [machine_id]);

      const sonBakimTarihiGetir = await pool.query(`SELECT max(bakim_tarihi) as bakim_tarihi FROM b_bakim_table WHERE machine_id = $1`, [machine_id]);
      if (sonBakimTarihiGetir.rows.length === 0 || !sonBakimTarihiGetir.rows[0].bakim_tarihi) {
        throw new Error("No previous bakim_tarihi found for the machine");
      }

      const bakimTarih = new Date(sonBakimTarihiGetir.rows[0].bakim_tarihi);

      // Function to calculate new date based on months to add
      const calculateNewBakimTarihi = (bakimTarih, monthsToAdd) => {
        const date = new Date(bakimTarih);
        date.setMonth(date.getMonth() + monthsToAdd);
        return date;
      };

      let newBakimTarihi;
      switch (parseInt(makina_bakim_turu)) {
        case 6:
          newBakimTarihi = calculateNewBakimTarihi(bakimTarih, 6);
          break;
        case 12:
          newBakimTarihi = calculateNewBakimTarihi(bakimTarih, 12);
          break;
        case 3:
          newBakimTarihi = calculateNewBakimTarihi(bakimTarih, 3);
          break;
        case 4:
          newBakimTarihi = calculateNewBakimTarihi(bakimTarih, 4);
          break;
        case 1:
          newBakimTarihi = calculateNewBakimTarihi(bakimTarih, 1);
          break;
        default:
          throw new Error("Unknown makina_bakim_turu value");
      }
      if (bakip_tur_data != 1) {
        const bakimInsert = await pool.query(
          `INSERT INTO b_bakim_table (machine_id, bakim_tarihi, durum,tur) VALUES ($1, $2, $3,0)`,
          [machine_id, newBakimTarihi.toISOString(), 0]
        );
      }

    }
    files.forEach(async items => {

      let belge_url = `assets\\docs\\${items.filename}`;
      await pool.query(
        `INSERT INTO b_bakim_dokuman(name, url, bakim_detail_id)
        VALUES ($1, $2, $3)`,
        [items.filename, belge_url, bakim_detail_id]
      );

    });
    res.status(200).json({ status: 200 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});




router.post('/getMachinesBakim', cors(), async (req, res) => {

  try {


    const result = await pool.query(`SELECT * FROM main_machines `);
    const data = result.rows;


    res.status(200).json({ status: 200, data: data });


  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})
router.post('/insertMachineAriza', cors(), async (req, res) => {
  const { ariza_tarih, machine_id, aciklama } = req.body;

  try {
    if (!ariza_tarih || !machine_id) {
      return res.status(400).json({ status: 400, message: 'Missing required fields' });
    }


    let [day, month, year] = ariza_tarih.split('.').map(Number);
    let date = new Date(year, month - 1, day);
    let now = new Date();
    let hours = now.getHours();
    let minutes = now.getMinutes();
    let seconds = now.getSeconds();

    // Date nesnesine saati ekle
    date.setHours(hours);
    date.setMinutes(minutes);
    date.setSeconds(seconds);
    const updateMachine = await pool.query(`UPDATE main_machines SET durum = 1 WHERE id = $1`, [machine_id]);
    const insertArizaBakim = await pool.query(`INSERT INTO b_bakim_table (machine_id, bakim_tarihi, durum, tur,aciklama) VALUES ($1, $2, 0, 1,$3)`, [machine_id, date, aciklama]);

    res.status(200).json({ status: 200 });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ status: 500, message: 'Internal server error' });
  }
});

router.post('/getKalibrasyonGecmis', cors(), async (req, res) => {
  try {
    const id = req.body.id
    const result = await pool.query(`SELECT qe.id,qe.ekipman_no,qe.ekipman_name,qe.ekipman_no,qe.ekipman_type,qe.sorumlusu, qe.son_kalibrasyon,qe.gonderme_tarihi,qs.name as durumu,qd.name as birimi,
       qc.sertifika_url,qc.kalibr_sertifika_no, qc.tolerans,qc.seri_no 
       FROM quailty_ekipman qe
       INNER JOIN quality_calibration qc ON qc.ekipman_no = qe.ekipman_no 
       Inner Join quality_status qs ON qs.id = qe.durumu 
       Inner Join quailty_departman qd ON qe.birimi = qd.id WHERE qe.id = ${id}`);
    const data = result.rows;
    res.status(200).json({ status: 200, data: data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})
router.post('/postKalibrasyonMetarial', cors(), async (req, res) => {
  try {
    const { ekipman_no, ekipman_name, ekipman_type, birimi, sorumlusu, durumu, son_kalibrasyon, gonderme_tarihi } = req.body
    const dataGet = await pool.query(`select* from quailty_ekipman WHERE ekipman_no = '${ekipman_no}'`);

    if (dataGet.rows.length === 0) {
      const result = await pool.query(`
      INSERT INTO quailty_ekipman (
          ekipman_no, ekipman_name, ekipman_type,
          birimi, sorumlusu, durumu,
          son_kalibrasyon, gonderme_tarihi
      ) 
      VALUES (
          '${ekipman_no}', '${ekipman_name}', '${ekipman_type}',
          '${birimi}', '${sorumlusu}', '${durumu}',
          '${son_kalibrasyon}', '${gonderme_tarihi}'
      ) 
  `);
      const data = result.rows;
      res.status(200).json({
        data: data,
        status: 200
      });
    } else {
      res.status(200).json({
        status: 205
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})

router.post('/qrMachineSearch', cors(), async (req, res) => {
  const { machine_id, seri_no } = req.body;
  try {
    const quality_status = await pool.query(`SELECT * FROM main_machines WHERE id = ${machine_id} AND seri_no = ${seri_no}`);



    res.status(200).json({
      status: 200,
      quality_status: quality_status.rows,

    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})

router.post('/postKalibrasyonDetail', cors(), async (req, res) => {
  try {
    const { ekipman_no, ekipman_name, ekipman_type, birimi, sorumlusu, durumu, son_kalibrasyon, gonderme_tarihi, seri_no, sertifika_url, kalibr_sertifika_no } = req.body
    const dataGet = await pool.query(`select* from quailty_ekipman WHERE ekipman_no = '${ekipman_no}'`);

    if (dataGet.rows.length !== 0) {
      const result = await pool.query(`
      INSERT INTO quality_calibration ( seri_no, birim, sertifika_url, kalibr_sertifika_no, tolerans, kalibrasyon_tarihi, geceme_tarihi, durumu,
          ekipman_no, ekipman_name, ekipman_type ) VALUES ('${seri_no}','${birimi}', '${sertifika_url}', '${kalibr_sertifika_no}','0'  ,'${son_kalibrasyon}', '${gonderme_tarihi}', '${durumu}','${ekipman_no}' , '${ekipman_name}', '${ekipman_type}') 
  `);
      const data = result.rows;


      if ((dataGet.rows[0].durumu == 1 && durumu == 3) || (dataGet.rows[0].durumu == 2 && durumu == 3) || (dataGet.rows[0].durumu == 3 && durumu == 3))//durum ve tarih güncelle
      {
        const updateData = await pool.query(`
          UPDATE quailty_ekipman
          SET durumu= '${durumu}', son_kalibrasyon='${son_kalibrasyon}', gonderme_tarihi='${gonderme_tarihi}'
          WHERE ekipman_no='${ekipman_no}'`);
      }
      if ((dataGet.rows[0].durumu == 1 && durumu == 2) || (dataGet.rows[0].durumu == 2 && durumu == 1) || (dataGet.rows[0].durumu == 3 && durumu == 1))//durum 
      {


        const updateData = await pool.query(`
          UPDATE quailty_ekipman
          SET durumu= '${durumu}'
          WHERE ekipman_no='${ekipman_no}'`);
      }
      res.status(270).json({
        data: data,
        status: 200
      });
    } else {
      res.status(270).json({
        status: 205
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})
router.post('/getStatusAndDepartment', cors(), async (req, res) => {
  try {
    const quality_status = await pool.query(`select* from quality_status`);
    const quailty_departman = await pool.query(`select* from quailty_departman`);


    res.status(200).json({
      status: 200,
      quality_status: quality_status.rows,
      quailty_departman: quailty_departman.rows
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})
router.post('/isListesi', cors(), async (req, res) => {
  try {
    const result = await pool.query(`
    SELECT 
        tl.*, 
        json_agg(json_build_object('icerik', tld.icerik)) AS todo_list_dokumanlar 
    FROM 
        todo_list tl 
    LEFT JOIN 
        todo_list_dokuman tld ON tl.id = tld.todo_id 
    GROUP BY 
        tl.id ORDER BY tl.id`); const data = result.rows;
    res.status(200).json({ data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})

router.post('/postIsListesi', uploadTodo.array('files'), async (req, res, next) => {


  const files = req.files;
  const today = new Date();
  const day = today.getDate();
  const month = today.getMonth() + 1; // Month starts from 0, so add 1
  const year = today.getFullYear();

  const formattedDate = `${day}-${month}-${year}`;

  if (!files) {
    const error = new Error('No File')
    error.httpStatusCode = 400

    return next(error)
  }
  try {

    result = await pool.query(`INSERT INTO todo_list (name, statu, statu_name, start_date) VALUES ('${req.body.aciklama}', 1, 'Bekliyor', '${formattedDate}')  RETURNING id`);
    const insertedId = result.rows[0].id;
    files.forEach(async items => {
      let belge_url = `assets\\docs\\${items.filename}`
      result = await pool.query(`INSERT INTO todo_list_dokuman(todo_id, icerik)
      VALUES ( ${insertedId}, '${belge_url}')`);

    })

    res.send({ status: 200 });
  } catch (error) {
    res.send({ status: 200,data:error });  }

})
router.post('/todoGuncelle', async (req, res) => {


  const today = new Date();
  const day = today.getDate();
  const month = today.getMonth() + 1; // Month starts from 0, so add 1
  const year = today.getFullYear();

  const formattedDate = `${day}-${month}-${year}`;
  try {

    const statusName = req.body.statu == 2 ? 'Başladı' : 'Tamamlandı';
    const endDate = req.body.statu == 3 ? formattedDate : null; // Assuming formattedDate is already defined

    const query = `
        UPDATE todo_list 
        SET 
            statu = $1, 
            statu_name = $2, 
            end_date = $3 
        WHERE 
            id = $4`;

    const values = [req.body.statu, statusName, endDate, req.body.id];

    const result = await pool.query(query, values);
    res.send({ status: 200 });
  } catch (error) {

    res.send({error:error})
  }

})
router.get('/qrKontrols', cors(), (req, res) => {

  const machineData = {
    machine_id: '2',
    seri_no: '413'
  };

  const qrData = JSON.stringify(machineData); // Verileri JSON formatına çeviriyoruz

  QRCode.toDataURL(qrData, (err, url) => {
    if (err) {
      console.error(err);
      return;
    }
    res.json(url); // QR kodunun veri URL'sini alıyoruz
    // Bu URL'ü kullanarak QR kodunu gösterebilir veya kaydedebilirsiniz
  });

});
const qrKontrol = async () => {
  // Burada sorgunuzu çalıştırabilirsiniz, örneğin:

  const machineData = {
    machine_id: '123',
    seri_no: 'ABC456'
  };

  const qrData = JSON.stringify(machineData); // Verileri JSON formatına çeviriyoruz

  QRCode.toDataURL(qrData, (err, url) => {
    if (err) {
      console.error(err);
      return;
    }
    return url; // QR kodunun veri URL'sini alıyoruz
    // Bu URL'ü kullanarak QR kodunu gösterebilir veya kaydedebilirsiniz
  });
};

module.exports = router;
