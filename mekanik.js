
const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const axios = require('axios');
const nodemailer = require("nodemailer");
const { format } = require('date-fns');
const cors = require('cors');
const http = require('http');
router.use(cors());
const request = require('request')
const pool = require('./db');
const { machine } = require('os');
const multer = require('multer');
const path = require('path');
const transliteration = require('transliteration');
const fs = require("fs");
router.post('/getMekanikMachineHat', cors(), async (req, res) => {
  try {
    fs.appendFileSync('log.txt', `Request received at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('log.txt', `istekIcerik :  ${JSON.stringify(req.body)}\n`);
    fs.appendFileSync('log.txt', `istekApi /getMekanikMachineHat\n`);
    const result = await pool.query(`SELECT mm.id,mm.machines_name,mm.seri_no,mm.birim_id,mm.durum,mm.hat_id ,machines_kod, (SELECT json_agg(operasyon) 
      FROM (select *from optik_machine_operasyon omo WHERE mm.hat_id = omo.hat_id ) operasyon)  
as operasyon FROM main_machines mm WHERE mm.birim_id = 0`);
    const data = result.rows;
    const datagiden = [{
      id: null,
      machines_name: null,
      kayit_sil: true,
      seri_no: null,
      birim_id: null,
      durum: null,
      operator_production: null,
      makina_kapasite: null,
      operator_planed: null,
      operator_realized: null,
      qr: null,
      birim_name: null,
      operasyon: null,
      hat_id: null,
      duruslar: null,
      uygunsuz: null,
      durus_gir: true,
      realized_amount: null,
      kalite_sunulan: null,
      red_kalite: 0,
      kalite_red: 0,
      kalite_gecen: 0,
      toplamuretilen: null,
      operator: null,
      part_type: null,
      rework: 0,
      planned_amount: null,
      operation_time: null,
      work_id: null,
      vardiya: null,
      urun_kod: null,
      urun_aciklama: null,
      product_id: null,
      dirty: false,
      calisma_suresi: 450
    }]
    data.forEach(items => {
      items.kayit_sil = false,
        items.operator_production = null,
        items.makina_kapasite = null,
        items.operator_planed = null,
        items.operator_realized = null,
        items.duruslar = null,
        items.uygunsuz = null,
        items.durus_gir = true,
        items.realized_amount = null,
        items.kalite_sunulan = null,
        items.red_kalite = 0,
        items.kalite_red = 0,
        items.kalite_gecen = 0,
        items.toplamuretilen = null,
        items.operator = null,
        items.part_type = null,
        items.rework = 0,
        items.planned_amount = null,
        items.operation_time = null,
        items.work_id = null,
        items.vardiya = null,
        items.urun_kod = null,
        items.urun_aciklama = null,
        items.product_id = null,
        items.dirty = false,
        items.calisma_suresi = 450
    })
    res.status(200).json({ status: 200, data: datagiden, makina: data });
    fs.appendFileSync('logResponse.txt', `Request received at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('logResponse.txt', `istekApi /getMekanikMachineHat\n`);
    fs.appendFileSync('logResponse.txt', `Response sent at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('logResponse.txt', `Data: ${JSON.stringify(data)}\n`);
    fs.appendFileSync('logResponse.txt', `**************************************************************\n`);
  } catch (error) {
    fs.appendFileSync('logError.txt', `Error occurred at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('logError.txt', `Error: ${error}\n`);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})
router.post('/getMachineMekanikPark', cors(), async (req, res) => {
  const { product_id, machine_id, created_date, update_date, end_date, status, planned_amount, realized_amount, birim_id } = req.body
  try {

    let bugun = new Date();
    let dun = new Date(bugun);
    dun.setDate(bugun.getDate() - 1);
    let startDate = dun.toISOString().slice(0, 10);
    let finsihDate = bugun.toISOString().slice(0, 10);

    fs.appendFileSync('log.txt', `Request received at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('log.txt', `istekIcerik :  ${JSON.stringify(req.body)}\n`);
    fs.appendFileSync('log.txt', `istekApi getMachineOptikPark\n`);
    const result = await pool.query(`SELECT machine.*,mdizi.id as sira_id,sira,satir,is_hide FROM machine_dizilim as mdizi

    LEFT JOIN
    (
        SELECT mm.machines_name, mm.id, muh.name, mm.hat_id,mm.durum,mm.seri_no,
        (
            SELECT json_agg(isler) 
            FROM (
                SELECT
                    (SELECT json_agg(urunler) FROM (SELECT * FROM m_product_production mpp WHERE mpp.id = mp.product_id) urunler) as urunler,
                    (SELECT json_agg(uretim_sureleri) FROM (SELECT * FROM m_product_machines mpm WHERE mpm.id = mp.operasyon_id) uretim_sureleri) as uretim_sureleri,
                    SUM(mp.production) as uretim, 
                    SUM(mp.red_quailty) as red,
                    SUM(mp.rework) as rework,
                    SUM(wo.planned_amount) as hedef
                FROM m_production mp
                INNER JOIN m_work_order wo ON wo.id = mp.work_id AND wo.created_date BETWEEN $1 AND $2
                WHERE mp.machine_id = mm.id AND mp.production_date BETWEEN $1 AND $2  
                GROUP BY mp.product_id, operasyon_id
            ) isler
        ) as toplamUretim
        FROM main_machines mm 
        INNER JOIN machine_uretim_hat muh ON muh.id = mm.hat_id 
        WHERE mm.birim_id = 0
        ORDER BY mm.hat_id
    )  machine
     ON machine.id = mdizi.machine_id WHERE birim_id =$3 ORDER BY mdizi.id `, [startDate, finsihDate, birim_id]);
    const data = result.rows;
    const siraQuery = await pool.query(`SELECT MAX(sira) FROM machine_dizilim`)
    res.status(200).json({ status: 200, data: data, sira: siraQuery.rows[0].max });
    fs.appendFileSync('logResponse.txt', `Request received at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('logResponse.txt', `istekApi /getMachineOptikPark\n`);
    fs.appendFileSync('logResponse.txt', `Response sent at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('logResponse.txt', `Data: ${JSON.stringify(data)}\n`);
    fs.appendFileSync('logResponse.txt', `**************************************************************\n`);
  } catch (error) {
    fs.appendFileSync('logError.txt', `Error occurred at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('logError.txt', `Error: ${error}\n`);
    res.status(500).json({ error: error });
  }
})
router.post("/raporMekanikHatRapor", cors(), async (req, res) => {
  try {
    const { startDate, endDate, birim } = req.body;


    fs.appendFileSync('log.txt', `Request received at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('log.txt', `istekIcerik :  ${JSON.stringify(req.body)}\n`);
    fs.appendFileSync('log.txt', `istekApi /raporMekanikHatRapor\n`);
    const query = await pool.query(`	
      WITH production_totals AS (
        SELECT 
            mp.work_id,
            SUM(mp.production) AS toplamUretim,
            SUM(mp.red_quailty) AS toplamRed,
            SUM(mp.rework) AS toplamRework
        FROM m_production mp WHERE mp.production_date BETWEEN '${startDate}' and '${endDate}'
        GROUP BY mp.work_id
    ),
    aggregated_data AS (
        SELECT
            muh.name,
            SUM(mwo.planned_amount) AS toplamPlanlanan,
            SUM(COALESCE(pt.toplamUretim, 0)) AS toplamUretim,
            SUM(COALESCE(pt.toplamRed, 0)) AS toplamRed,
            SUM(COALESCE(pt.toplamRework, 0)) AS toplamRework
        FROM machine_uretim_hat muh
        LEFT JOIN main_machines mm ON muh.id = mm.hat_id
        LEFT JOIN m_work_order mwo ON mm.id = mwo.machine_id AND mwo.created_date BETWEEN '${startDate}' and '${endDate}' 
        LEFT JOIN production_totals pt ON mwo.id = pt.work_id 
        WHERE muh.uretim_hat =${birim}
        GROUP BY muh.name, muh.id
        ORDER BY muh.id
    )
    SELECT * FROM aggregated_data;
`)

    const queryData = query.rows

    res.status(200).json({ status: 200, data: queryData });
    fs.appendFileSync('logResponse.txt', `Request received at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('logResponse.txt', `istekApi /raporMekanikHatRapor\n`);
    fs.appendFileSync('logResponse.txt', `Response sent at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('logResponse.txt', `Data: ${JSON.stringify(queryData)}\n`);
    fs.appendFileSync('logResponse.txt', `**************************************************************\n`);

  } catch (error) {
   
    fs.appendFileSync('logError.txt', `Error occurred at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('logError.txt', `Error: ${error}\n`);
    res.status(500).json({ error: error});
  }
});
router.post("/raporMekanikPersonelDurus", cors(), async (req, res) => {
  try {
    const { startDate, endDate, operator_id, tip } = req.body;
    fs.appendFileSync('log.txt', `Request received at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('log.txt', `istekIcerik :  ${JSON.stringify(req.body)}\n`);
    fs.appendFileSync('log.txt', `istekApi /raporMekanikPersonelDurus\n`);

    const query = await pool.query(`	
      SELECT SUM(duration_time) toplamDurus,COUNT(durus_id) as durus_adet, (SELECT name FROM m_durus_sebep WHERE md.durus_id = id AND kaynak = '${tip}') FROM m_durus md INNER JOIN m_production mp  
ON mp.operator_id =${parseInt(operator_id)} AND mp.production_date BETWEEN '${startDate}' and '${endDate}' AND md.work_id = mp.work_id GROUP BY durus_id`)
    const queryData = query.rows
    //burada http://10.0.0.35/3212/getusersOptik  post methodu ile istek atacağım ve gelen veriyi içindeki user_id ile queryData[x].operator_id ile eşit olan varsa gelen veririn user_name bilgisini queryData içerisine yazacağım 
    // Make a POST request to get users data

    res.status(200).json({ status: 200, data: queryData });
    fs.appendFileSync('logResponse.txt', `Request received at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('logResponse.txt', `istekApi /raporMekanikPersonelDurus\n`);
    fs.appendFileSync('logResponse.txt', `Response sent at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('logResponse.txt', `Data: ${JSON.stringify(queryData)}\n`);
    fs.appendFileSync('logResponse.txt', `**************************************************************\n`);
  } catch (error) {
   
    fs.appendFileSync('logError.txt', `Error occurred at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('logError.txt', `Error: ${error}\n`);
    res.status(500).json({ error: error });
  }
});
router.post("/raporMekanikMakinaDurus", cors(), async (req, res) => {
  try {
    const { startDate, endDate, machine_id, tip } = req.body;
    fs.appendFileSync('log.txt', `Request received at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('log.txt', `istekIcerik :  ${JSON.stringify(req.body)}\n`);
    fs.appendFileSync('log.txt', `istekApi /raporMekanikMakinaDurus\n`);

    const query = await pool.query(`	
      SELECT SUM(duration_time) toplamDurus,COUNT(durus_id) as durus_adet,(SELECT name FROM m_durus_sebep WHERE md.durus_id = id) FROM m_durus md INNER JOIN m_production mp  
ON mp.machine_id =${parseInt(machine_id)} AND mp.production_date BETWEEN '${startDate}' and '${endDate}' AND md.work_id = mp.work_id GROUP BY durus_id`)
    const queryData = query.rows
    //burada http://10.0.0.35/3212/getusersOptik  post methodu ile istek atacağım ve gelen veriyi içindeki user_id ile queryData[x].operator_id ile eşit olan varsa gelen veririn user_name bilgisini queryData içerisine yazacağım 
    // Make a POST request to get users data

    res.status(200).json({ status: 200, data: queryData });
    fs.appendFileSync('logResponse.txt', `Request received at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('logResponse.txt', `istekApi /raporMekanikMakinaDurus\n`);
    fs.appendFileSync('logResponse.txt', `Response sent at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('logResponse.txt', `Data: ${JSON.stringify(queryData)}\n`);
    fs.appendFileSync('logResponse.txt', `**************************************************************\n`);
  } catch (error) {
   
    fs.appendFileSync('logError.txt', `Error occurred at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('logError.txt', `Error: ${error}\n`);
    res.status(500).json({ error: error });
  }
});
router.post("/raporDurus", cors(), async (req, res) => {
  try {
    const { birim,startDate,endDate } = req.body;
    fs.appendFileSync('log.txt', `Request received at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('log.txt', `istekIcerik :  ${JSON.stringify(req.body)}\n`);
    fs.appendFileSync('log.txt', `istekApi /raporDurus\n`);

    const query = await pool.query(`	
        SELECT  mds.id , SUM(md.duration_time),COUNT(md.durus_id), mds.name,mds.kaynak, COUNT(DISTINCT md.machine_id) AS machine_count FROM m_work_order mwo INNER JOIN m_durus md ON md.work_id = mwo.id  INNER JOIN  m_durus_sebep mds ON  mds.id = md.durus_id  INNER JOIN main_machines mm ON mm.id = md.machine_id 
      AND mm.birim_id = ${birim - 1}     WHERE created_date between '${startDate}' AND '${endDate}'   GROUP BY mds.id , mds.name,mds.kaynak
      
      
     `)
    const queryData = query.rows
    //burada http://10.0.0.35/3212/getusersOptik  post methodu ile istek atacağım ve gelen veriyi içindeki user_id ile queryData[x].operator_id ile eşit olan varsa gelen veririn user_name bilgisini queryData içerisine yazacağım 
    // Make a POST request to get users data

    res.status(200).json({ status: 200, data: queryData });
    fs.appendFileSync('logResponse.txt', `Request received at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('logResponse.txt', `istekApi /raporDurus\n`);
    fs.appendFileSync('logResponse.txt', `Response sent at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('logResponse.txt', `Data: ${JSON.stringify(queryData)}\n`);
    fs.appendFileSync('logResponse.txt', `**************************************************************\n`);
  } catch (error) {
   
    fs.appendFileSync('logError.txt', `Error occurred at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('logError.txt', `Error: ${error}\n`);
    res.status(500).json({ error: error });
  }
});
router.post("/raporMekanikMakinaDurusDetail", cors(), async (req, res) => {
  try {
    const { startDate, endDate, machine_id, tip, durus_sebep } = req.body;
    fs.appendFileSync('log.txt', `Request received at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('log.txt', `istekIcerik :  ${JSON.stringify(req.body)}\n`);
    fs.appendFileSync('log.txt', `istekApi /raporMekanikMakinaDurusDetail\n`);

    const query = await pool.query(`	
      SELECT md.*,(mp.production+mp.rework+mp.red_quailty)*mp.operasyon_time as calisma_suresi,mp.operator_name,
      (SELECT json_agg(urun) FROM (SELECT * FROM m_product_production mpp WHERE mp.product_id =mpp.id )urun) as urun
      FROM m_durus md
      INNER JOIN m_production mp ON mp.work_id = md.work_id AND mp.production_date BETWEEN '${startDate}' and '${endDate}' 
      WHERE md.durus_id = (SELECT id FROM m_durus_sebep mds WHERE mds.name = '${durus_sebep}') AND md.machine_id = ${machine_id}
     `)
    const queryData = query.rows
    //burada http://10.0.0.35/3212/getusersOptik  post methodu ile istek atacağım ve gelen veriyi içindeki user_id ile queryData[x].operator_id ile eşit olan varsa gelen veririn user_name bilgisini queryData içerisine yazacağım 
    // Make a POST request to get users data

    res.status(200).json({ status: 200, data: queryData });
    fs.appendFileSync('logResponse.txt', `Request received at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('logResponse.txt', `istekApi /raporMekanikMakinaDurusDetail\n`);
    fs.appendFileSync('logResponse.txt', `Response sent at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('logResponse.txt', `Data: ${JSON.stringify(queryData)}\n`);
    fs.appendFileSync('logResponse.txt', `**************************************************************\n`);
  } catch (error) {

    fs.appendFileSync('logError.txt', `Error occurred at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('logError.txt', `Error: ${error}\n`);
    res.status(500).json({ error: error });
  }
});
router.post("/raporMekanikPersonelRapor", cors(), async (req, res) => {
  try {
    const { startDate, endDate, birim } = req.body;
    fs.appendFileSync('log.txt', `Request received at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('log.txt', `istekIcerik :  ${JSON.stringify(req.body)}\n`);
    fs.appendFileSync('log.txt', `istekApi /raporMekanikPersonelRapor\n`);
    const query = await pool.query(`
      


      SELECT datas.operator_name as user_name, 
       SUM(toplamuretim) as toplamuretim,
       SUM(toplamred) as toplamred,
       SUM(diger_kayip) as diger_kayip,
       SUM(toplamplanlanan) as toplamplanlanan,
       SUM(toplamrework) as toplamrework,
       SUM(toplam_kayip) as toplam_kayip,
       datas.operator_id
FROM (
    SELECT mwo.id,
           muh.name, 
           SUM(mp.operator_production) as toplamuretim,
           mp.operator_name,
           CASE 
               WHEN mp.operasyon_time > 0 THEN 
                   (SELECT SUM(duration_time) 
                    FROM m_durus md 
                    INNER JOIN m_durus_sebep sebep ON sebep.id = md.durus_id AND sebep.kaynak = false
                    WHERE mwo.id = md.work_id) / mp.operasyon_time
               ELSE 0
           END as toplam_kayip,
           CASE 
               WHEN mp.operasyon_time > 0 THEN 
                   (SELECT SUM(duration_time) 
                    FROM m_durus md 
                    INNER JOIN m_durus_sebep sebep ON sebep.id = md.durus_id AND sebep.kaynak = true
                    WHERE mwo.id = md.work_id) / mp.operasyon_time
               ELSE 0
           END as diger_kayip,
           SUM(mp.red_quailty) as toplamred,
           SUM(mp.rework) as toplamrework,
            CASE 
    WHEN (SELECT hat_id FROM main_machines mmach WHERE mp.machine_id = mmach.id) != 6 THEN  
        SUM(mwo.operator_planed) 
    ELSE
        SUM(mp.production ) 
END as toplamplanlanan,
           mp.operator_id 
    FROM m_production mp 
    INNER JOIN m_work_order mwo ON mp.work_id = mwo.id 
    INNER JOIN main_machines mm ON mm.id = mp.machine_id 
    INNER JOIN machine_uretim_hat muh on muh.id = mm.hat_id AND muh.uretim_hat = ${birim}  
    WHERE mp.production_date BETWEEN '${startDate}' AND '${endDate}' 
      AND mwo.created_date BETWEEN '${startDate}' AND '${endDate}'
    GROUP BY mp.operator_id, muh.id, mp.id, mwo.id 
    ORDER BY muh.id
) as datas  
GROUP BY datas.operator_id, datas.operator_name;

     `)
    const queryData = query.rows
    //burada http://10.0.0.35/3212/getusersOptik  post methodu ile istek atacağım ve gelen veriyi içindeki user_id ile queryData[x].operator_id ile eşit olan varsa gelen veririn user_name bilgisini queryData içerisine yazacağım 
    // Make a POST request to get users data

    res.status(200).json({ status: 200, data: queryData });
    fs.appendFileSync('logResponse.txt', `Request received at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('logResponse.txt', `istekApi /raporMekanikPersonelRapor\n`);
    fs.appendFileSync('logResponse.txt', `Response sent at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('logResponse.txt', `Data: ${JSON.stringify(queryData)}\n`);
    fs.appendFileSync('logResponse.txt', `**************************************************************\n`);
  } catch (error) {
   
    fs.appendFileSync('logError.txt', `Error occurred at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('logError.txt', `Error: ${error}\n`);
    res.status(500).json({ error: error });
  }
});
router.post("/workorderGuncelle", cors(), async (req, res) => {
  try {

    let data = [
      {
        "id": 1317
      },
      {
        "id": 1304
      },
      {
        "id": 1314
      },
      {
        "id": 1313
      },
      {
        "id": 1329
      },
      {
        "id": 1312
      },
      {
        "id": 1311
      },
      {
        "id": 1316
      },
      {
        "id": 1306
      },
      {
        "id": 1305
      },
      {
        "id": 1308
      },
      {
        "id": 1307
      },
      {
        "id": 1310
      },
      {
        "id": 1309
      },
      {
        "id": 1323
      },
      {
        "id": 1322
      },
      {
        "id": 1321
      },
      {
        "id": 1320
      },
      {
        "id": 1325
      },
      {
        "id": 1324
      }]



    for (let index = 0; index < data.length; index++) {
      const element = await pool.query(`update m_work_order SET operator_planed = planned_amount WHERE id = $1`, [data[index].id])

    }
    //burada http://10.0.0.35/3212/getusersOptik  post methodu ile istek atacağım ve gelen veriyi içindeki user_id ile queryData[x].operator_id ile eşit olan varsa gelen veririn user_name bilgisini queryData içerisine yazacağım 
    // Make a POST request to get users data

    res.status(200).json({ status: 200, data: data });

  } catch (error) {
    res.status(500).json({ error: error });


  }
});
router.post("/raporMekanikMakinaRapor", cors(), async (req, res) => {
  try {
    const { startDate, endDate, birim } = req.body;
    fs.appendFileSync('log.txt', `Request received at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('log.txt', `istekIcerik :  ${JSON.stringify(req.body)}\n`);
    fs.appendFileSync('log.txt', `istekApi /raporMekanikMakinaRapor\n`);
    const query = await pool.query(` 
      SELECT datas.id,
       datas.machines_kod as machines_name, 
       datas.name,
       SUM(toplam_durus) as toplam_durus,
       SUM(durusAdedi) as toplam_durus_adet,
       SUM(toplamplanlanan) as toplamplanlanan,
       SUM(toplamuretim) as toplamuretim,
       SUM(toplamred) as toplamred,
       SUM(diger_kayip) as diger_kayip,
       SUM(toplam_rework) as toplam_rework,
       SUM(toplam_kayip) as toplam_kayip
FROM (
    SELECT mm.machines_kod,
           muh.name,
           SUM(mp.production) as toplamuretim,
           SUM(mp.red_quailty) as toplamred,
           SUM(mp.rework) as toplam_rework,
           mwo.planned_amount as toplamplanlanan,
           mm.id,
           (SELECT SUM(duration_time)
            FROM m_durus md 
            WHERE mwo.id = md.work_id) as toplam_durus,
           (SELECT COUNT(duration_time)
            FROM m_durus md 
            WHERE mwo.id = md.work_id) as durusAdedi,
           CASE 
               WHEN mp.operasyon_time > 0 THEN 
                   (SELECT SUM(duration_time)
                    FROM m_durus md 
                    INNER JOIN m_durus_sebep sebep ON sebep.id = md.durus_id AND sebep.kaynak = false
                    WHERE mwo.id = md.work_id) / mp.operasyon_time
               ELSE 0
           END as toplam_kayip,
           CASE 
               WHEN mp.operasyon_time > 0 THEN 
                   (SELECT SUM(duration_time)
                    FROM m_durus md 
                    INNER JOIN m_durus_sebep sebep ON sebep.id = md.durus_id AND sebep.kaynak = true
                    WHERE mwo.id = md.work_id) / mp.operasyon_time
               ELSE 0
           END as diger_kayip
    FROM main_machines mm
    INNER JOIN m_production mp ON mp.machine_id = mm.id 
        AND mp.production_date BETWEEN '${startDate}' AND '${endDate}' 
    INNER JOIN m_work_order mwo ON mwo.machine_id = mm.id 
        AND mwo.id = mp.work_id 
        AND mwo.created_date BETWEEN '${startDate}' AND '${endDate}'
    INNER JOIN machine_uretim_hat muh ON muh.id = mm.hat_id 
        AND muh.uretim_hat = ${birim}
    WHERE birim_id = ${birim - 1} 
    GROUP BY mm.machines_kod, mm.id, mwo.id, mp.operasyon_time, muh.name
) as datas  
GROUP BY datas.id, datas.machines_kod, datas.name 
ORDER BY datas.name, datas.machines_kod;

     `)
    const queryData = query.rows


    res.status(200).json({ status: 200, data: queryData });
    fs.appendFileSync('logResponse.txt', `Request received at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('logResponse.txt', `istekApi /raporMekanikMakinaRapor\n`);
    fs.appendFileSync('logResponse.txt', `Response sent at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('logResponse.txt', `Data: ${JSON.stringify(queryData)}\n`);
    fs.appendFileSync('logResponse.txt', `**************************************************************\n`);
  } catch (error) {
   
    fs.appendFileSync('logError.txt', `Error occurred at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('logError.txt', `Error: ${error}\n`);
    res.status(500).json({ error: error });
  }
});
router.post("/raporMachineOEE", cors(), async (req, res) => {
  try {
    const { startDate, endDate, birim } = req.body;
    fs.appendFileSync('log.txt', `Request received at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('log.txt', `istekIcerik :  ${JSON.stringify(req.body)}\n`);
    fs.appendFileSync('log.txt', `istekApi /raporMachineOEE\n`);
    const query = await pool.query(` 
 SELECT 
    mm.machines_name,
    mm.id,
    CASE 
        WHEN (kul_sure - planliDurus) = 0 OR harcanan_sure = 0 THEN 0
        ELSE ((((kul_sure - planliDurus - plansiz_durus) / (kul_sure - planliDurus)) * 
              (harcanan_sure / (kul_sure - planliDurus)) * 
              ((harcanan_sure - hurda_sure) / harcanan_sure)) * 100)
    END AS oee,
    CASE 
        WHEN (kul_sure - planliDurus) = 0 THEN 0
        ELSE ((kul_sure - planliDurus - plansiz_durus) / (kul_sure - planliDurus)) * 100 
    END AS kullanilabilir,
    CASE 
        WHEN (kul_sure - planliDurus) = 0 THEN 0
        ELSE (harcanan_sure / (kul_sure - planliDurus)) * 100 
    END AS verimlilik,
    CASE 
        WHEN harcanan_sure = 0 THEN 0
        ELSE ((harcanan_sure - hurda_sure) / harcanan_sure) * 100 
    END AS kalite,
    kul_sure, 
    planliDurus, 
    plansiz_durus, 
    harcanan_sure, 
    hurda_sure
FROM (
    SELECT 
        mp.machine_id,
        SUM(mp.calisma_suresi) AS kul_sure,
        COUNT(mp.calisma_suresi) * 1 AS planliDurus,
        SUM((SELECT SUM(duration_time) FROM m_durus md WHERE md.machine_id = mp.machine_id AND md.work_id = mp.work_id)) AS plansiz_durus,
        SUM(mp.operasyon_time * mp.production) AS harcanan_sure,
        SUM(mp.operasyon_time * (mp.rework + mp.red_quailty)) AS hurda_sure
    FROM m_production mp
    WHERE mp.production_date BETWEEN '${startDate}' AND '${endDate}' 
    GROUP BY mp.machine_id
) AS datas
INNER JOIN main_machines mm ON mm.id = datas.machine_id
WHERE mm.birim_id = ${birim - 1}
ORDER BY oee DESC, mm.machines_name;


     `)
    const queryData = query.rows


    res.status(200).json({ status: 200, data: queryData });
    fs.appendFileSync('logResponse.txt', `Request received at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('logResponse.txt', `istekApi /raporMachineOEE\n`);
    fs.appendFileSync('logResponse.txt', `Response sent at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('logResponse.txt', `Data: ${JSON.stringify(queryData)}\n`);
    fs.appendFileSync('logResponse.txt', `**************************************************************\n`);
  } catch (error) {
  
    fs.appendFileSync('logError.txt', `Error occurred at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('logError.txt', `Error: ${error}\n`);
    res.status(500).json({ error: error });
  }
});
router.post("/raporMachineGunlukOEE", cors(), async (req, res) => {
  try {
    const { startDate, endDate, machine_id } = req.body;
    fs.appendFileSync('log.txt', `Request received at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('log.txt', `istekIcerik :  ${JSON.stringify(req.body)}\n`);
    fs.appendFileSync('log.txt', `istekApi /raporMachineGunlukOEE\n`);
    const query = await pool.query(` 
       SELECT 
     production_date,
      CASE 
        WHEN (kul_sure - planliDurus) = 0 OR (kul_sure - planliDurus - plansiz_durus) = 0 OR harcanan_sure = 0
        THEN 0
        ELSE ((((kul_sure - planliDurus - plansiz_durus) / (kul_sure - planliDurus)) * 
               (harcanan_sure / (kul_sure - planliDurus)) * 
               ((harcanan_sure - hurda_sure) / harcanan_sure)) * 100)
      END AS oee,
      CASE 
        WHEN (kul_sure - planliDurus) = 0
        THEN 0
        ELSE ((kul_sure - planliDurus - plansiz_durus) / (kul_sure - planliDurus)) * 100
      END AS kullanilabilir,
      CASE 
        WHEN (kul_sure - planliDurus) = 0
        THEN 0
        ELSE (harcanan_sure / (kul_sure - planliDurus)) * 100
      END AS verimlilik,
      CASE 
        WHEN harcanan_sure = 0
        THEN 0
        ELSE ((harcanan_sure - hurda_sure) / harcanan_sure) * 100
      END AS kalite,
      kul_sure, planliDurus, plansiz_durus, harcanan_sure, hurda_sure
FROM (
      SELECT 
          mp.machine_id, mp.production_date,
          SUM(mp.calisma_suresi) AS kul_sure,
          COUNT(mp.calisma_suresi) * 45 AS planliDurus,
          SUM((SELECT SUM(duration_time) FROM m_durus md WHERE md.machine_id = mp.machine_id AND md.work_id = mp.work_id)) AS plansiz_durus,
          SUM(mp.operasyon_time * mp.production) AS harcanan_sure,
          SUM(mp.operasyon_time * (mp.rework + mp.red_quailty)) AS hurda_sure
           FROM m_production mp
      WHERE mp.production_date  BETWEEN '${startDate}' AND '${endDate}'  AND mp.machine_id = ${machine_id}
      GROUP BY mp.machine_id,mp.production_date ORDER BY mp.production_date
  ) AS datas
     
     `)
    const queryData = query.rows


    res.status(200).json({ status: 200, data: queryData });
    fs.appendFileSync('logResponse.txt', `Request received at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('logResponse.txt', `istekApi /raporMachineGunlukOEE\n`);
    fs.appendFileSync('logResponse.txt', `Response sent at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('logResponse.txt', `Data: ${JSON.stringify(queryData)}\n`);
    fs.appendFileSync('logResponse.txt', `**************************************************************\n`);
  } catch (error) {
    
    fs.appendFileSync('logError.txt', ` raporMachineGunlukOEE apisine ait Error occurred at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('logError.txt', `Error: ${error}\n`);
    res.status(500).json({ error: error });
  }
});
router.post("/raporMachineGunlukOEETarihDetay", cors(), async (req, res) => {
  try {
    const { startDate, endDate, machine_id } = req.body;
    fs.appendFileSync('log.txt', `Request received at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('log.txt', `istekIcerik :  ${JSON.stringify(req.body)}\n`);
    fs.appendFileSync('log.txt', `istekApi /raporMachineGunlukOEETarihDetay\n`);
    const query = await pool.query(` 
      SELECT mp.production,
        mp.rework,
        mp.red_quailty,
        mp.quality_production,
        mp.operator_name,
        mp.operator_id,
        mp.work_id,
        mp.vardiya_no,
        operasyon_time,
        calisma_suresi,
      (SELECT json_agg(durus) FROM 
      (SELECT m_durus.*,
        (SELECT name FROM m_durus_sebep 
        WHERE m_durus.durus_id = id)
      FROM m_durus 
      WHERE mp.work_id = m_durus.work_id)durus)as duruslar,
      (SELECT json_agg(uygunsuz) FROM 
      (SELECT mu.*,
        (SELECT name
        FROM m_uygunsuzluk_sebep
        WHERE mu.uygunsuz_id = id ) 
      FROM m_uygunsuzluk mu
      WHERE mu.work_id = mp.work_id )uygunsuz)as uygunsuzluklar,
      (select urun_aciklama
      FROM m_product_production mpp
      WHERE mp.product_id = mpp.id),  
      (select urun_kod
      FROM m_product_production mpp
      WHERE mp.product_id = mpp.id)  
      FROM m_production mp
      WHERE mp.machine_id =  ${machine_id} and mp.production_date = '${startDate}'
     `)
    const queryData = query.rows


    res.status(200).json({ status: 200, data: queryData });
    fs.appendFileSync('logResponse.txt', `Request received at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('logResponse.txt', `istekApi /raporMachineGunlukOEETarihDetay\n`);
    fs.appendFileSync('logResponse.txt', `Response sent at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('logResponse.txt', `Data: ${JSON.stringify(queryData)}\n`);
    fs.appendFileSync('logResponse.txt', `**************************************************************\n`);
  } catch (error) {

    fs.appendFileSync('logError.txt', ` raporMachineGunlukOEETarihDetay apisine ait Error occurred at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('logError.txt', `Error: ${error}\n`);
    res.status(500).json({ error: error });
  }
});

router.post('/getRaporUrunSureKontrol', cors(), async (req, res) => {
  try {
    const { startDate, endDate, birim } = req.body;
    fs.appendFileSync('log.txt', `Request received at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('log.txt', `istekIcerik :  ${JSON.stringify(req.body)}\n`);
    fs.appendFileSync('log.txt', `istekApi /getMekanikHatName\n`);



    const result = await pool.query(`SELECT mm.machines_kod ,operator_id,operator_name, product_id, machine_id, operasyon_time,(SELECT urun_aciklama FROM m_product_production mpp WHERE  mp.product_id = mpp.id),(SELECT urun_kod FROM m_product_production mpp WHERE  mp.product_id = mpp.id),
      (SELECT omp.operasyon_name
       FROM m_work_order mwo
       INNER JOIN optik_machine_operasyon omp ON mwo.operasyon_tur = omp.id
       WHERE mwo.id = mp.work_id) as operasyon_name
    FROM m_production mp INNER JOIN main_machines mm ON mm.id = mp.machine_id WHERE mm.birim_id = ${birim-1} AND mp.production_date BETWEEN '${startDate}' AND '${endDate}'  
    GROUP BY mp.product_id, work_id, mp.operator_id, machine_id, operasyon_time,operator_name,mm.machines_kod
    ORDER BY product_id, machine_id,operasyon_name `);
    const data = result.rows;
    const minTimes = {};

    data.forEach(result => {
      const key = `${result.product_id}-${result.machine_id}-${result.operasyon_name}`;
      if (!minTimes[key] || result.operasyon_time < minTimes[key]) {
        minTimes[key] = result.operasyon_time;
      }
    });

    // Sonuçları karşılaştır ve yeni alanı ekle
    const processedResults = data.map(result => {
      const key = `${result.product_id}-${result.machine_id}-${result.operasyon_name}`;
      return {
        ...result,
        is_greater_than_min: result.operasyon_time > minTimes[key]
      };
    });


    res.status(200).json({ status: 200, data: processedResults });
    fs.appendFileSync('logResponse.txt', `Request received at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('logResponse.txt', `istekApi /getMekanikHatName\n`);
    fs.appendFileSync('logResponse.txt', `Response sent at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('logResponse.txt', `Data: ${JSON.stringify(data)}\n`);
    fs.appendFileSync('logResponse.txt', `**************************************************************\n`);
  } catch (error) {
   
    fs.appendFileSync('logError.txt', `Error occurred at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('logError.txt', `Error: ${error}\n`);
    res.status(500).json({ error: error });
  }
})
router.post('/getRaporUrunEnIyiSure', cors(), async (req, res) => {
  try {
    const { urun_kod } = req.body;
    fs.appendFileSync('log.txt', `Request received at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('log.txt', `istekIcerik :  ${JSON.stringify(req.body)}\n`);
    fs.appendFileSync('log.txt', `istekApi /getRaporUrunGecmisAra\n`);


    const result = await pool.query(`
      SELECT 
        mp.operasyon_time,
        mm.machines_kod,
        mm.hat_id,
        mp.operator_id,
        mp.operator_name,
        mp.product_id,
        mp.machine_id,
        (SELECT urun_aciklama FROM m_product_production mpp WHERE mp.product_id = mpp.id) AS urun_aciklama,
        (SELECT urun_kod FROM m_product_production mpp WHERE mp.product_id = mpp.id) AS urun_kod,
        (SELECT omp.operasyon_name
         FROM m_work_order mwo
         INNER JOIN optik_machine_operasyon omp ON mwo.operasyon_tur = omp.id
         WHERE mwo.id = mp.work_id) AS operasyon_name,(SELECT omp.id
         FROM m_work_order mwo
         INNER JOIN optik_machine_operasyon omp ON mwo.operasyon_tur = omp.id
         WHERE mwo.id = mp.work_id) AS operasyon_id
      FROM m_product_production mpp 
      INNER JOIN m_production mp ON mp.product_id = mpp.id 
      INNER JOIN main_machines mm ON mp.machine_id = mm.id
      WHERE mpp.urun_kod = '${urun_kod}'
      GROUP BY mp.product_id, mp.work_id, mp.operator_id, mp.machine_id, mp.operasyon_time, mp.operator_name, mm.machines_kod, mm.hat_id
      ORDER BY operasyon_id
    `);
    const data = result.rows;
    const minTimes = {};
    data.forEach(row => {
      const key = `${row.hat_id}_${row.operasyon_name}`;
      if (!minTimes[key]) {
        minTimes[key] = [];
      }
      if (minTimes[key].length < 2) {
        minTimes[key].push(row);
        minTimes[key].sort((a, b) => a.operasyon_time - b.operasyon_time);
      } else if (row.operasyon_time < minTimes[key][1].operasyon_time) {
        minTimes[key][1] = row;
        minTimes[key].sort((a, b) => a.operasyon_time - b.operasyon_time);
      }
    });

    const processedResults = Object.values(minTimes).flat();

    res.status(200).json({ status: 200, data: processedResults });
    
    fs.appendFileSync('logResponse.txt', `Request received at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('logResponse.txt', `istekApi /getRaporUrunGecmisAra\n`);
    fs.appendFileSync('logResponse.txt', `Response sent at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('logResponse.txt', `Data: ${JSON.stringify(data)}\n`);
    fs.appendFileSync('logResponse.txt', `**************************************************************\n`);
  } catch (error) {
  
    fs.appendFileSync('logError.txt', `Error occurred at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('logError.txt', `Error: ${error}\n`);
    res.status(500).json({ error: error });
  }
})
router.post('/getRaporUrunGecmisAra', cors(), async (req, res) => {
  try {
    const { urun_kod } = req.body;
    fs.appendFileSync('log.txt', `Request received at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('log.txt', `istekIcerik :  ${JSON.stringify(req.body)}\n`);
    fs.appendFileSync('log.txt', `istekApi /getRaporUrunGecmisAra\n`);


    const result = await pool.query(`SELECT SUM(production) as uretilen,mm.machines_kod ,operator_id,operator_name, product_id, machine_id, operasyon_time,(SELECT urun_aciklama FROM m_product_production mpp WHERE  mp.product_id = mpp.id),(SELECT urun_kod FROM m_product_production mpp WHERE  mp.product_id = mpp.id),
      (SELECT omp.operasyon_name
       FROM m_work_order mwo
       INNER JOIN optik_machine_operasyon omp ON mwo.operasyon_tur = omp.id
       WHERE mwo.id = mp.work_id ) as operasyon_name FROM m_product_production mpp 
      INNER JOIN m_production mp ON mp.product_id = mpp.id 
      INNER JOIN main_machines mm ON mp.machine_id = mm.id
      WHERE mpp.urun_kod = '${urun_kod}' AND mp.product_id = mpp.id GROUP BY mp.product_id, work_id, mp.operator_id, machine_id, operasyon_time,operator_name,mm.machines_kod
    ORDER BY product_id, machine_id,operasyon_name `);
    const data = result.rows;
    const minTimes = {};

    data.forEach(result => {
      const key = `${result.product_id}-${result.machine_id}-${result.operasyon_name}`;
      if (!minTimes[key] || result.operasyon_time < minTimes[key]) {
        minTimes[key] = result.operasyon_time;
      }
    });

    // Sonuçları karşılaştır ve yeni alanı ekle
    const processedResults = data.map(result => {
      const key = `${result.product_id}-${result.machine_id}-${result.operasyon_name}`;
      return {
        ...result,
        is_greater_than_min: result.operasyon_time > minTimes[key]
      };
    });


    res.status(200).json({ status: 200, data: processedResults });
    fs.appendFileSync('logResponse.txt', `Request received at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('logResponse.txt', `istekApi /getRaporUrunGecmisAra\n`);
    fs.appendFileSync('logResponse.txt', `Response sent at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('logResponse.txt', `Data: ${JSON.stringify(data)}\n`);
    fs.appendFileSync('logResponse.txt', `**************************************************************\n`);
  } catch (error) {

    fs.appendFileSync('logError.txt', `Error occurred at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('logError.txt', `Error: ${error}\n`);
    res.status(500).json({ error: error });
  }
})
router.post('/getRaporUrunSureKontrolDetay', cors(), async (req, res) => {
  try {
    const { startDate, endDate, birim,machine_id,product_id } = req.body;
    fs.appendFileSync('log.txt', `Request received at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('log.txt', `istekIcerik :  ${JSON.stringify(req.body)}\n`);
    fs.appendFileSync('log.txt', `istekApi /getRaporUrunSureKontrolDetay\n`);


    const result = await pool.query(`SELECT SUM(production) as uretilen, mm.machines_kod ,operator_id,operator_name, product_id, machine_id, operasyon_time,(SELECT urun_aciklama FROM m_product_production mpp WHERE  mp.product_id = mpp.id),(SELECT urun_kod FROM m_product_production mpp WHERE  mp.product_id = mpp.id),
      (SELECT omp.operasyon_name
       FROM m_work_order mwo
       INNER JOIN optik_machine_operasyon omp ON mwo.operasyon_tur = omp.id
       WHERE mwo.id = mp.work_id ) as operasyon_name
    FROM m_production mp 
    INNER JOIN main_machines mm ON mm.id = mp.machine_id 
    WHERE mm.birim_id = ${birim-1} 
    AND mp.production_date BETWEEN '${startDate}' AND '${endDate}'   AND mp.machine_id = ${machine_id} 
    AND mp.product_id = ${product_id} 
    GROUP BY mp.product_id, work_id, mp.operator_id, machine_id, operasyon_time,operator_name,mm.machines_kod
    ORDER BY product_id, machine_id,operasyon_name `);
    const data = result.rows;
    const minTimes = {};

    data.forEach(result => {
      const key = `${result.product_id}-${result.machine_id}-${result.operasyon_name}`;
      if (!minTimes[key] || result.operasyon_time < minTimes[key]) {
        minTimes[key] = result.operasyon_time;
      }
    });

    // Sonuçları karşılaştır ve yeni alanı ekle
    const processedResults = data.map(result => {
      const key = `${result.product_id}-${result.machine_id}-${result.operasyon_name}`;
      return {
        ...result,
        is_greater_than_min: result.operasyon_time > minTimes[key]
      };
    });


    res.status(200).json({ status: 200, data: processedResults });
    fs.appendFileSync('logResponse.txt', `Request received at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('logResponse.txt', `istekApi /getRaporUrunSureKontrolDetay\n`);
    fs.appendFileSync('logResponse.txt', `Response sent at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('logResponse.txt', `Data: ${JSON.stringify(data)}\n`);
    fs.appendFileSync('logResponse.txt', `**************************************************************\n`);
  } catch (error) {
  
    fs.appendFileSync('logError.txt', `Error occurred at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('logError.txt', `Error: ${error}\n`);
    res.status(500).json({ error: error });
  }
})
router.post('/getMekanikHatName', cors(), async (req, res) => {
  try {

    fs.appendFileSync('log.txt', `Request received at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('log.txt', `istekIcerik :  ${JSON.stringify(req.body)}\n`);
    fs.appendFileSync('log.txt', `istekApi /getMekanikHatName\n`);
    const result = await pool.query(`SELECT * FROM machine_uretim_hat WHERE uretim_hat = 1`);
    const data = result.rows;

    res.status(200).json({ status: 200, data: data });
    fs.appendFileSync('logResponse.txt', `Request received at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('logResponse.txt', `istekApi /getMekanikHatName\n`);
    fs.appendFileSync('logResponse.txt', `Response sent at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('logResponse.txt', `Data: ${JSON.stringify(data)}\n`);
    fs.appendFileSync('logResponse.txt', `**************************************************************\n`);
  } catch (error) {
  
    fs.appendFileSync('logError.txt', `Error occurred at ${new Date().toISOString()}:\n`);
    fs.appendFileSync('logError.txt', `Error: ${error}\n`);
    res.status(500).json({ error: error });
  }
})



router.post('/insertProduct', cors(), async (req, res) => {
  const { urun_kod, urun_aciklama, ham_madde, cap, boy } = req.body;
  try {
    const kontrolVarMi = await pool.query('SELECT * FROM m_product_production WHERE urun_kod = $1', [urun_kod]);
    if (kontrolVarMi.rowCount > 0) {
      res.status(200).json({ status: 205, data: "data" });
    } else {
      let hammadde = ham_madde ? ham_madde : 0;
      let caP = cap ? cap : 0;
      let boY = boy ? boy : 0;
      const result = await pool.query('INSERT INTO m_product_production(urun_kod, urun_aciklama, ham_madde, cap, boy) VALUES ($1, $2, $3, $4, $5)', [urun_kod, urun_aciklama, hammadde, caP, boY]);
      res.status(200).json({ status: 200, data: result.rows });
    }
  } catch (error) {
    res.status(500).json({ error: error });

  }
});

router.post('/updateProduct', cors(), async (req, res) => {
  const { urun_kod, urun_aciklama, ham_madde, cap, boy, id } = req.body;
  try {

    const result = await pool.query(`UPDATE m_product_production
    SET  urun_kod=${urun_kod}, urun_aciklama=${urun_aciklama}, ham_madde=${ham_madde}, cap=${cap}, boy=${boy}
    WHERE id=${id}`);
    const data = result.rows;

    res.status(200).json({ status: 200, data: data });
  } catch (error) {
    res.status(500).json({ error: error });

  }
})


router.get('/selectProduct', cors(), async (req, res) => {
  try {

    const result = await pool.query(`SELECT * FROM m_product_production`);
    const data = result.rows;

    res.status(200).json({ status: 200, data: data });
  } catch (error) {
    res.status(500).json({ error: error });

  }
})



router.get('/selecMachine', cors(), async (req, res) => {
  try {

    const result = await pool.query(`SELECT * FROM main_machines`);
    const data = result.rows;

    res.status(200).json({ status: 200, data: data });
  } catch (error) {
    res.status(500).json({ error: error });

  }
})
router.post('/singelSelectProduct', cors(), async (req, res) => {
  const { id } = req.body
  try {

    const result = await pool.query(`SELECT * FROM m_product_production WHERE id = ${id}`);
    const data = result.rows;

    res.status(200).json({ status: 200, data: data });
  } catch (error) {
    res.status(500).json({ error: error });

  }
})
router.post('/postWorkOrder', cors(), async (req, res) => {
  const { product_id, machine_id, status, planned_amount, work_id } = req.body;
  const workOrderUpdate = await pool.query(`UPDATE m_work_order SET status = 2 WHERE machine_id = ${machine_id} AND status = 1`)
  try {
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0]; // Format date as YYYY-MM-DD

    const kontrolResult = await pool.query(`SELECT * FROM m_product_machines WHERE product_id = $1 AND machine_id = $2`, [product_id, machine_id]);
    const dataVar = kontrolResult.rowCount;
    if (dataVar >= 1) {

      const result = await pool.query(`INSERT INTO m_work_order(product_id, machine_id, created_date, update_date, status, planned_amount,realized_amount)
              VALUES ($1, $2, $3, $4, $5, $6,$7)`, [product_id, machine_id, formattedDate, formattedDate, status, planned_amount, 0]);

      const data = result.rows;

      res.status(200).json({ status: 200, data: data });
    } else {
      res.status(201).json({ status: 205, data: "Seçilen ürün için makina bilgisi girilmemiş ilgili sayfaya yönlendirileceksiniz." });
    }

  } catch (error) {
    res.status(500).json({ error: error });

  }

})
router.post('/putWorkOrder', cors(), async (req, res) => {
  const { product_id, machine_id, created_date, update_date, end_date, status, planned_amount, realized_amount } = req.body
  try {

    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1; // Month starts from 0, so add 1
    const year = today.getFullYear();

    const formattedDate = `${day}-${month}-${year}`;
    let guncelmeDate = null
    if (status == 2) {
      guncelmeDate = `${day}-${month}-${year}`;

    }
    const result = await pool.query(`UPDATE m_work_order
    SET  product_id=${product_id}, machine_id=${machine_id}, created_date=${created_date}, update_date=${formattedDate}, end_date=${guncelmeDate}, status=${status}, planned_amount=${planned_amount}, realized_amount=${realized_amount}
    WHERE id=${id}`);
    const data = result.rows;

    res.status(200).json({ status: 200, data: data });
  } catch (error) {
    res.status(500).json({ error: error });

  }
})
router.post('/getDurusSebep', cors(), async (req, res) => {

  try {

    const result = await pool.query(`SELECT * FROM m_durus_sebep`);
    const data = result.rows;
    res.status(200).json({ status: 200, data: data });
  } catch (error) {
    res.status(500).json({ error: error });

  }
})
router.post('/getUygunsuzSebep', cors(), async (req, res) => {

  try {

    const result = await pool.query(`SELECT * FROM m_uygunsuzluk_sebep ORDER BY name`);
    const data = result.rows;
    res.status(200).json({ status: 200, data: data });
  } catch (error) {
    res.status(500).json({ error: error });

  }
})
router.post('/postDurus', cors(), async (req, res) => {
  const { durus_id, machine_id, product_id, work_id, duration_time } = req.body;
  try {
    const started_date = new Date().toISOString();
    const finish_date = new Date().toISOString();
    const result = await pool.query(
      `INSERT INTO m_durus(durus_id, machine_id, product_id, work_id, started_date, finish_date, duration_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [durus_id, machine_id, product_id, work_id, started_date, finish_date, duration_time]
    );
    const data = result.rows;

    res.status(200).json({ status: 200, data: data });
  } catch (error) {
    res.status(500).json({ error: error });

  }
});

router.post('/getMachinePast', cors(), async (req, res) => {
  const { machine_id } = req.body
  let today = new Date().toISOString()
  try {



    const result = await pool.query(`
    WITH ProductionTimeline AS (
        SELECT 
            'Üretim' AS event_type,
            mp.id,
            mp.machine_id,
            mp.product_id,
            mp.created_date AS tarih,
            mp.production AS uretim,
       mpp.urun_aciklama AS urun_aciklama,
            NULL AS durus_id,
            NULL AS durus_sebep,
            NULL AS duration_time
        FROM 
            m_production mp LEFT JOIN m_product_production mpp ON mpp.id = mp.product_id
        WHERE 
            machine_id = $1
          
        UNION ALL
        
        SELECT 
            'Duruş' AS event_type,
            durus.id,
            durus.machine_id,
            durus.product_id,
            durus.started_date AS tarih,
            NULL AS uretim,
        NULL AS urun_aciklama,
    
            durus.durus_id,
            mds.name AS durus_sebep,
            durus.duration_time
        FROM 
            m_durus durus 
        LEFT JOIN 
            m_durus_sebep mds ON durus.durus_id = mds.id
        WHERE 
            durus.machine_id =$2
          

    )
    SELECT 
        * 
    FROM 
        ProductionTimeline 
    ORDER BY 
        tarih`, [machine_id, machine_id]);
    const data = result.rows;
    res.status(200).json({ status: 200, data: data });
  } catch (error) {
    res.status(500).json({ error: error });

  }
})
router.post('/getMachineProduction', cors(), async (req, res) => {
  const { product_id, machine_id, created_date, update_date, end_date, status, planned_amount, realized_amount } = req.body
  try {



    const result = await pool.query(`SELECT 
    mm.id,
    mm.birim_id,
    mm.birim_name,
    mm.durum,
    mm.machines_name,
    mm.qr,
    mm.seri_no,
    SUM(mp.quality_production) AS kalite_sunulan,
    SUM(mp.red_quailty) AS red_kalite,
    pm.operation_time,
    pm.part_type,
    wo.id AS work_id,
    wo.planned_amount,
    wo.realized_amount,
    pp.urun_kod,
    pp.urun_aciklama,
    pp.id AS product_id
FROM 
    main_machines mm 
LEFT JOIN 
    m_work_order wo ON wo.machine_id = mm.id AND wo.status = 1
LEFT JOIN 
    m_production mp ON wo.id = mp.work_id
LEFT JOIN 
    m_product_production pp ON wo.product_id = pp.id 
LEFT JOIN 
    m_product_machines pm ON pm.product_id = pp.id AND pm.machine_id = mm.id 
WHERE 
    mm.birim_id = 0
GROUP BY 
    mm.id,
    mm.birim_id,
    mm.birim_name,
    mm.durum,
    mm.machines_name,
    mm.qr,
    mm.seri_no,
    pm.operation_time,
    pm.part_type,
    wo.id,
	pp.id,
    wo.planned_amount,
    wo.realized_amount,
    pp.urun_kod,
    pp.urun_aciklama;`);
    const data = result.rows;

    res.status(200).json({ status: 200, data: data });
  } catch (error) {
    res.status(500).json({ error: error });

  }
})
router.post('/postMachineProduct', cors(), async (req, res) => {
  const { machine_id, product_id, operasyon_time, part_type } = req.body;

  try {
    const machineProductKontrol = await pool.query(`SELECT * FROM m_product_machines WHERE machine_id = $1 AND product_id = $2`, [machine_id, product_id]);

    if (machineProductKontrol.rowCount > 0) {
      res.status(200).json({ status: 205, data: "data" });
    } else {
      const result = await pool.query(`INSERT INTO m_product_machines (machine_id, product_id, operation_time, part_type) VALUES ($1, $2, $3, $4)`, [machine_id, product_id, operasyon_time, part_type]);
      const data = result.rows;

      res.status(200).json({ status: 200, data: data });
    }
  } catch (error) {
    res.status(500).json({ error: error });
  }
})
router.post('/postProduction', cors(), async (req, res) => {
  const { product_id, machine_id, production, status, quality_production, red_quailty, operator_name, operator_id, work_id } = req.body;
  let today = new Date();
  const started_date = new Date().toISOString();

  let saat = today.getHours() * 256 * 65536 + today.getMinutes() * 65536;
  let vardiya = 0;
  let bugun = today.getFullYear() + "-" + (today.getMonth() + 1) + "-" + (today.getDate());
  if (saat > 119406592 && saat < 287178752) {
    vardiya = 1;
  } else if (saat > 287178752 || saat < 1966080) {
    vardiya = 2;
  }
  try {
    const today = new Date()

    const productionResult = await pool.query(`
      INSERT INTO m_production (
        product_id, machine_id, production, created_date, production_date, finish_date, status, quality_production, red_quailty, operator_name, operator_id, work_id,vardiya_no
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,$13)
      RETURNING *;
    `, [product_id, machine_id, production, started_date, started_date, today, status, quality_production, red_quailty, operator_name, operator_id, work_id, vardiya]);

    if (status == 1) {
      const updateWorkResult = await pool.query(`
      UPDATE m_work_order 
      SET realized_amount = realized_amount + $1 
      WHERE id = $2;
    `, [production, work_id]);
    }


    res.status(200).json({ status: 200, data: productionResult.rows });
  } catch (error) {
    res.status(500).json({ error: error });
  }
});
router.post('/getProductionMachineProductDate', cors(), async (req, res) => {
  const { product_id, machine_id, work_id } = req.body;

  try {
    let today = new Date();
    let saat = today.getHours() * 256 * 65536 + today.getMinutes() * 65536;
    let vardiya = 0;
    let bugun = today.getFullYear() + "-" + (today.getMonth() + 1) + "-" + (today.getDate());
    if (saat > 119406592 && saat < 287178752) {
      vardiya = 1;
    } else if (saat > 287178752 || saat < 1966080) {
      vardiya = 2;
    }

    const vardiyaGet = await pool.query(`SELECT gunlukv${parseInt(vardiya)} as vardiyadeger FROM p_vardiya_bilgileri`)
    let calismaSuresi = vardiyaGet.rows[0].vardiyadeger * 60

    // SQL sorgusunda placeholder kullanarak SQL güvenliğini sağlayın
    const selectProduction = await pool.query(
      `select $1 as vardiya,$2 as vardiya_suresi, SUM(datas.operation_time*datas.toplam_uretim)as toplam_sure FROM(SELECT 
        mp.product_id,
        mp.machine_id,
        SUM(mp.production) AS toplam_uretim,
      SUM(mp.quality_production) AS kalite_uretim,
        mpm.operation_time
    FROM 
        m_production mp
    LEFT JOIN 
        m_product_machines mpm ON mp.machine_id = mpm.machine_id AND mp.product_id = mpm.product_id
    WHERE 
        mp.machine_id = $3 
        AND mp.vardiya_no = $4 
        AND mp.created_date = $5 
    GROUP BY 
        mp.product_id, mp.machine_id, mpm.operation_time) datas`,
      [parseInt(vardiya), calismaSuresi, machine_id, parseInt(vardiya), bugun]
    );

    res.status(200).json({ status: 200, data: selectProduction.rows });
  } catch (error) {
    res.status(500).json({ error: error });

  }
});

module.exports = router;
