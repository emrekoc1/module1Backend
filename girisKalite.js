const axios = require('axios');
const nodemailer = require("nodemailer");
const express = require('express');
const router = express.Router();
const cors = require('cors');
const { format } = require('date-fns');
const http = require('http');
const request = require('request');
router.use(cors());
const pool = require('./db'); // PostgreSQL yapılandırması
const { sql, poolPromise } = require('./mspoolKOKPIT'); // MSSQL yapılandırması
const fs = require("fs");
const multer = require('multer');
const path = require('path');
const transliteration = require('transliteration');
const QRCode = require('qrcode');
const cron = require('node-cron');
const { sqls, poolPromises } = require('./portal_Tiger_db'); // MSSQL yapılandırması

function getToken(callback) {
    const tokenOptions = {
        method: 'GET',
        url: 'http://20.0.0.14:32001/api/v1/token',
        headers: {
            Authorization: 'Basic TEVWRUxCSUxJU0lNOkdiVUNoeEU3elFUdzJYWWNjdHdzcTZTQkUzODdLQmF1dE94RWNScnR6cFE9',
            'Content-Type': 'application/json',
            Accept: 'application/json'
        },
        body: 'grant_type=password&username=level&firmno=224&password=l123456*'
    };

    request(tokenOptions, function (error, response, body) {

        if (error) {
            callback(error, null);

            return;
        }
        const access_token = JSON.parse(body); // access_token değerini al
        callback(null, access_token);
    });
}


const kaliteDocs = multer.diskStorage({

    destination: (req, file, callBack) => {
        const destinationPath = path.join(__dirname, '..', '..', '..', '..', '..', '..', 'wamp64', 'www', 'kalite', 'assets', 'docs');
        //const destinationPath = path.join(__dirname, '..', 'front end', 'front end', 'src', 'assets', 'docs');
        callBack(null, destinationPath)
    },

    filename: (req, file, callBack) => {
        const bugun = new Date();
        const tarihDamgasi = bugun.toISOString().replace(/[:.]/g, '').substring(0, 10); // Sadece '2023-08-25' bölümü
        const originalnameWithoutExtension = path.parse(file.originalname).name;
        const transliteratedName = transliteration.slugify(originalnameWithoutExtension, { lowercase: false });
        callBack(null, `girisKalite_${tarihDamgasi}${transliteratedName}_${path.extname(file.originalname)}`);

    }

})
const uygunsuzDocs = multer.diskStorage({

    destination: (req, file, callBack) => {
        const destinationPath = path.join(__dirname, '..', '..', '..', '..', '..', '..', 'wamp64', 'www', 'kalite', 'assets', 'docs');
        //const destinationPath = path.join(__dirname, '..', 'front end', 'front end', 'src', 'assets', 'docs');
        callBack(null, destinationPath)
    },

    filename: (req, file, callBack) => {
        const bugun = new Date();
        const tarihDamgasi = bugun.toISOString().replace(/[:.]/g, '').substring(0, 10); // Sadece '2023-08-25' bölümü
        const originalnameWithoutExtension = path.parse(file.originalname).name;
        const transliteratedName = transliteration.slugify(originalnameWithoutExtension, { lowercase: false });
        callBack(null, `uygunsuzluk_${tarihDamgasi}_${transliteratedName}${path.extname(file.originalname)}`);

    }

})
const uploadDocs = multer({ storage: kaliteDocs })
const kmDocs = multer.diskStorage({

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
        callBack(null, `kmDocs${tarihDamgasi}_${transliteratedName}${path.extname(file.originalname)}`);

    }

})
const uploaKMDocs = multer({ storage: kmDocs })
const uygunsuzlukDocs = multer({ storage: uygunsuzDocs })


router.post('/kokpitOptikInsert', cors(), async (req, res) => {
    try {


        const getPuanQuery = await pool.query(`
                SELECT 
                SUM(mp.production) AS URETILENADET,
                SUM(mp.rework) AS REWORKADET,
                SUM(wo.planned_amount) AS PLANNED_AMOUNT,
                mpp.urun_kod AS URETILENURUN,
                mpp.urun_aciklama AS urun_adi,
                mm.machines_kod,
                wo.tiger_isemri,
                (SELECT  operasyon_name
                    FROM optik_machine_operasyon where id = wo.operasyon_tur ) as yuzey,
                wo.operasyon_tur,
                mm.hat_id,
                CASE     
                
                    WHEN wo.operasyon_tur = 13 THEN 5
                    WHEN wo.operasyon_tur =2 THEN 1
                        WHEN wo.operasyon_tur =1 THEN 1
                END AS istasyon
            FROM 
                m_production mp
            LEFT JOIN 
                m_product_production mpp ON mp.product_id = mpp.id
            LEFT JOIN 
                m_work_order wo ON mp.work_id = wo.id
            LEFT JOIN 
                main_machines mm ON mm.id = mp.machine_id
            WHERE 
                mp.production_date BETWEEN '2024-06-26' AND '2024-06-26'
            GROUP BY 
                mp.machine_id, mp.product_id, mpp.urun_kod, mm.machines_kod, wo.operasyon_tur, mm.hat_id,wo.tiger_isemri,mpp.urun_aciklama;
    `)
        const datas = getPuanQuery.rows

        let hat2Data = datas.filter(item => item.hat_id === 2);

        // Group data by uretilenurun
        let groupedData = hat2Data.reduce((acc, item) => {
            if (!acc[item.uretilenurun]) {
                acc[item.uretilenurun] = [];
            }
            acc[item.uretilenurun].push(item);
            return acc;
        }, {});

        // Update istasyon based on the specified conditions
        Object.keys(groupedData).forEach(urun => {
            let items = groupedData[urun];
            let uniqueOperasyonTur = new Set(items.map(item => item.operasyon_tur));

            items.forEach(item => {
                if (uniqueOperasyonTur.size > 1) {
                    item.istasyon = 3;
                } else {
                    if (item.operasyon_tur === 12) {
                        item.istasyon = 2;
                    } else {
                        item.istasyon = 4;
                    }
                }
            });
        });

        let updatedData = datas.map(item => {
            if (item.hat_id === 2 && groupedData[item.uretilenurun]) {
                return groupedData[item.uretilenurun].find(updatedItem => updatedItem.machines_kod === item.machines_kod && updatedItem.operasyon_tur === item.operasyon_tur);
            }
            return item;
        });

        // Remove duplicates
        const uniqueUpdatedData = Array.from(new Set(updatedData.map(item => JSON.stringify({
            "uretilenadet": item.uretilenadet,//
            "reworkadet": item.reworkadet,//
            "urun_adi": item.urun_adi,
            "planned_amount": item.planned_amount,//
            "uretilenurun": item.uretilenurun,//
            "machines_kod": item.machines_kod,//
            "yuzey": item.yuzey,
            "istasyon": item.istasyon,
            "is_emri": item.tiger_isemri
        })))).map(item => JSON.parse(item));


        let newEntries = [];

        uniqueUpdatedData.forEach(item => {
            let sameUrunItems = uniqueUpdatedData.filter(i => i.uretilenurun === item.uretilenurun && i.is_emri === item.is_emri);

            if (item.istasyon === 1 && sameUrunItems.every(i => i.istasyon !== 2 && i.istasyon !== 3 && i.istasyon !== 4 && i.istasyon !== 5)) {
                newEntries.push({
                    "uretilenadet": 0,
                    "reworkadet": "0",
                    "planned_amount": item.uretilenadet,
                    "urun_adi": item.urun_adi,
                    "uretilenurun": item.uretilenurun,
                    "machines_kod": null,
                    "yuzey": "R1",
                    "istasyon": 6,
                    "is_emri": item.is_emri
                });
            }

            if (item.istasyon === 2 && sameUrunItems.every(i => i.istasyon > 2 && i.istasyon !== 3 && i.istasyon !== 4 && i.istasyon !== 5)) {
                newEntries.push({
                    "uretilenadet": 0,
                    "reworkadet": "0",
                    "planned_amount": item.uretilenadet,
                    "urun_adi": item.urun_adi,

                    "uretilenurun": item.uretilenurun,
                    "machines_kod": null,
                    "yuzey": "R1",
                    "istasyon": 7,
                    "is_emri": item.is_emri
                });
            }

            if ((item.istasyon === 3 || item.istasyon === 4) && sameUrunItems.every(i => i.istasyon !== 5)) {
                newEntries.push({
                    "uretilenadet": 0,
                    "reworkadet": "0",
                    "planned_amount": item.uretilenadet,
                    "urun_adi": item.urun_adi,

                    "uretilenurun": item.uretilenurun,
                    "machines_kod": null,
                    "yuzey": "R1",
                    "istasyon": 8,
                    "is_emri": item.is_emri
                });
            }
        });

        // Combine the new entries with the unique updated data
        const finalData = [...uniqueUpdatedData, ...newEntries];
        let tarih = '2024-06-27'

        const mssqlPool = await poolPromise; // MSSQL bağlantısı

        for (const element of finalData) {
            const poolRequest = mssqlPool.request();
            const query = `INSERT INTO AHO_OPTIKURETIM (TARIH,
                MAKINEADI,URUNADI,ISEMRI ,
                URETILENURUN,
                PLANLANANADET,
                URETILENADET,
                REWORKADET,
                YUZEY,
                ISTASYON) VALUES(@tarih,@makina,@urun_adi,@isemri,@uretilen,@planlanan,@product,@rework,@yuzey,@istasyon)`
            poolRequest.input('tarih', tarih);
            poolRequest.input('makina', element.machines_kod);
            poolRequest.input('urun_adi', element.urun_adi);
            poolRequest.input('isemri', element.is_emri);
            poolRequest.input('uretilen', element.uretilenurun);
            poolRequest.input('planlanan', element.planned_amount);
            poolRequest.input('product', element.uretilenadet);
            poolRequest.input('rework', element.reworkadet);
            poolRequest.input('yuzey', element.yuzey);
            poolRequest.input('istasyon', element.istasyon);
            const userGet = await poolRequest.query(query);
        }

        res.status(200).json({ status: 200, data: finalData });
    } catch (error) {

        res.status(500).json({ error: error });
    }
})
router.post('/kokpitInsert', cors(), async (req, res) => {
    try {


        const getPuanQuery = await pool.query(`SELECT p_target_bom.kod, p_target_bom.malzeme,p_siparisler.proje FROM p_target_bom INNER JOIN p_siparisler ON p_target_bom.siparis_urun = p_siparisler.malzeme`)
        const datas = getPuanQuery.rows
        await pool.connect();

        datas.forEach(async element => {
            const poolRequest = await mspool.request();
            const query = `INSERT INTO AHO_MALZEMELER (PROJE,MALZEMEKODU,MALZEMEADI) VALUES(@proje,@kod,@malzeme)`
            poolRequest.input('proje', element.proje);
            poolRequest.input('kod', element.kod);
            poolRequest.input('malzeme', element.malzeme);
            const userGet = await poolRequest.query(query);

        });
        res.status(200).json({ status: 200, data: getPuanQuery.rows });
    } catch (error) {

        res.status(500).json({ error: error });
    }
})
router.post('/putGkUrunKontrol', cors(), async (req, res) => {
    const {
        id,
        proje, tur, kaplama_fimasi, lot_numarsi,
        aciklama, gelen_miktar, kabul, ogk, iade,
        rework, bildirim_no, bilgirimVar, status, red_aciklama } = req.body
    try {


        const insertQuery = await pool.query(`UPDATE gk_urun_kontrol
        SET proje=$2, tur=$3,  kaplama_fimasi=$4, aciklama=$5, gelen_miktar=$6, kabul=$7, ogk=$8, iade=$9, rework=$10, bildirim_no=$11, lot=$12,status = $13,red_aciklama=$14
        WHERE id = $1`, [id,
            proje, tur, kaplama_fimasi,
            aciklama, gelen_miktar, kabul, ogk, iade,
            rework, bildirim_no, lot_numarsi, status, red_aciklama
        ])
        let gkk_id = insertQuery.rows;

        res.status(200).json({ status: 200, data: "Kayıt Yapıldı" });
    } catch (error) {

        res.status(500).json({ error: error });
    }
})
router.post('/postGkUrunKontrolGecici', cors(), async (req, res) => {
    const {
        stok_no, stok_aciklama,
        proje, tur, cari, siparis_no, kaplama_fimasi, lot_numarsi,
        aciklama, gelen_miktar, kabul, ogk, iade,
        rework, dokuman, bildirim_no, bilgirimVar, user_id, user_name, cari_kod, firma_lot, kalite_tur } = req.body
    try {

        const created_date = new Date()


        const insertQuery = await pool.query(`
        INSERT INTO gk_urun_kontrol
        (created_date, stok_no, stok_aciklama, 
       
        aciklama, gelen_miktar, lot,user_id,user_name,firma_lot,status,kalite_tur) 
        VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, $9,0,$10) RETURNING  * `,
            [
                created_date, stok_no, stok_aciklama,
                aciklama, gelen_miktar,
                lot_numarsi, user_id, user_name, firma_lot, kalite_tur
            ])


        let gkk_id = insertQuery.rows[0].id;
        const machineData = {

            'stok_no': stok_no,
            'stok_aciklama': stok_aciklama,
            'lot_numarsi': lot_numarsi,
            'cari': "",
            'id': gkk_id
        };
        const qrData = JSON.stringify(machineData);
        // Türkçe karakterlerin doğru işlenmesi için Buffer ile UTF-8 olarak kodla
        const utf8QrData = Buffer.from(qrData, 'utf-8').toString();

        const qrCodeData = await new Promise((resolve, reject) => {
            QRCode.toDataURL(utf8QrData, (err, url) => {
                if (err) {
                    console.error(err);
                    reject(err);
                } else {
                    resolve(url);
                }
            });
        });
        const updateQuery = await pool.query(`Update gk_urun_kontrol SET qr = $1 WHERE id = $2`, [qrCodeData, gkk_id])
        let oncelikVar = await pool.query(`SELECT * FROM gk_oncelik WHERE urun_kodu = $1 AND urun_aciklama = $2 AND lot = $3`, [stok_no, stok_aciklama, lot_numarsi])

        if (oncelikVar.rowCount > 0) {

            let updateOncelikVar = await pool.query(`UPDATE gk_oncelik SET status = $4, olcum_tarihi=$5 WHERE urun_kodu = $1 AND urun_aciklama = $2 AND lot = $3`, [stok_no, stok_aciklama, lot_numarsi, 5, created_date])
        } else {
            let statu
            if (gelen_miktar == kabul) {
                statu = 2
            } else if (gelen_miktar == iade) {
                statu = 3
            } else if (gelen_miktar == ogk) {
                statu = 4
            } else {
                statu = 1
            }


            const insertOncelik = await pool.query(
                `INSERT INTO gk_oncelik (urun_kodu, lot, urun_aciklama, miktar, oncelik, status,  created_date, updated_date, is_active, is_delete, gelis_tarihi, olcum_tarihi) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
     RETURNING *`,
                [stok_no, lot_numarsi, stok_aciklama, gelen_miktar, 0, statu, created_date, created_date, true, false, created_date, created_date]
            );

        }

        const selectQery = await pool.query(`SELECT * FROM gk_urun_kontrol where id=$1`, [gkk_id])
        res.status(200).json({ status: 200, data: selectQery.rows[0] });
    } catch (error) {

        res.status(500).json({ error: error });
    }
})
router.post('/postGkUrunKontrol', cors(), async (req, res) => {
    const {
        stok_no, stok_aciklama,
        proje, tur, cari, siparis_no, kaplama_fimasi, lot_numarsi,
        aciklama, gelen_miktar, kabul, ogk, iade,
        rework, dokuman, bildirim_no, bilgirimVar, user_id, user_name, cari_kod, firma_lot, kalite_tur } = req.body
    try {

        const veriVarmiQuery = await pool.query(`SELECT * FROM gk_urun_kontrol WHERE stok_no = $1 AND lot = $2 AND kalite_tur=$3`, [stok_no, lot_numarsi, kalite_tur])
        if (veriVarmiQuery.rowCount > 0) {
            res.status(200).json({ status: 201, data: veriVarmiQuery.rows });

        } else {
            const created_date = new Date()
            let bidirim_degeri = 0
            if (bilgirimVar == 'false') {

            } else {
                bidirim_degeri = bildirim_no
            }

            let cariGetir, idbul
            if (cari) {
                if (cari == "AHO ÜRETİM") {
                    idbul = 0
                } else if (cari == "FİRMASIZ") {
                    idbul = 1
                } else {
                    cariGetir = await pool.query(`SELECT * FROM s_cari WHERE name = $1`, [cari])

                    if (cariGetir.rowCount > 0) {
                        idbul = cariGetir.rows[0].id
                    } else {
                        // cari insert yapılacak
                        const insertCariQuery = await pool.query(`INSERT INTO s_cari (name, aselsan_okey, is_active,tiger_kod) VALUES($1,$2,$3,$4) RETURNING id`,
                            [cari, false, true, cari_kod])
                        idbul = insertCariQuery.rows[0].id
                    }

                }

            }
            let siparisNO
            if (siparis_no) {
                siparisNO = siparis_no
            } else {
                siparisNO = 0
            }

            const insertQuery = await pool.query(`
            INSERT INTO gk_urun_kontrol
            (created_date, stok_no, stok_aciklama, 
            proje, tur, cari, siparis_no, kaplama_fimasi,
            aciklama, gelen_miktar, kabul, ogk, iade,
            rework, lot,user_id,user_name,status,firma_lot,
            kalite_tur) 
            VALUES 
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,$17,0,$18,$19) RETURNING id`,
                [
                    created_date, stok_no, stok_aciklama,
                    proje, tur, idbul, siparisNO, kaplama_fimasi,
                    aciklama, gelen_miktar, kabul, ogk, iade,
                    rework, lot_numarsi, user_id, user_name, firma_lot, kalite_tur
                ])


            let gkk_id = insertQuery.rows[0].id;
            const machineData = {

                'id': gkk_id
            };
            const qrData = JSON.stringify(machineData);
            // Türkçe karakterlerin doğru işlenmesi için Buffer ile UTF-8 olarak kodla
            const utf8QrData = Buffer.from(qrData, 'utf-8').toString();

            const qrCodeData = await new Promise((resolve, reject) => {
                QRCode.toDataURL(utf8QrData, (err, url) => {
                    if (err) {
                        console.error(err);
                        reject(err);
                    } else {
                        resolve(url);
                    }
                });
            });
            const updateQuery = await pool.query(`Update gk_urun_kontrol SET qr = $1 WHERE id = $2`, [qrCodeData, gkk_id])
            let oncelikVar = await pool.query(`SELECT * FROM gk_oncelik WHERE urun_kodu = $1 AND urun_aciklama = $2 AND lot = $3`, [stok_no, stok_aciklama, lot_numarsi])

            if (oncelikVar.rowCount > 0) {
                let statu
                if (gelen_miktar == kabul) {
                    statu = 2
                } else if (gelen_miktar < kabul && gelen_miktar >= ogk) {
                    statu = 4
                } else if (gelen_miktar == iade) {
                    statu = 3
                } else if (gelen_miktar == ogk) {
                    statu = 4
                } else {
                    statu = 1
                }
                let updateOncelikVar = await pool.query(`UPDATE gk_oncelik SET status = $4, olcum_tarihi=$5 WHERE urun_kodu = $1 AND urun_aciklama = $2 AND lot = $3`, [stok_no, stok_aciklama, lot_numarsi, statu, created_date])
            } else {
                let statu
                if (gelen_miktar == kabul) {
                    statu = 2
                } else if (gelen_miktar == iade) {
                    statu = 3
                } else if (gelen_miktar == ogk) {
                    statu = 4
                } else {
                    statu = 1
                }


                const insertOncelik = await pool.query(
                    `INSERT INTO gk_oncelik (urun_kodu, lot, urun_aciklama, miktar, oncelik, status,  created_date, updated_date, is_active, is_delete, gelis_tarihi, olcum_tarihi) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
         RETURNING *`,
                    [stok_no, lot_numarsi, stok_aciklama, gelen_miktar, 0, statu, created_date, created_date, true, false, created_date, created_date]
                );

            }
            res.status(200).json({ status: 200, data: gkk_id });
        }


    } catch (error) {
        console.error(error)
        res.status(500).json({ error: error });
    }
})
router.post('/postGkDokuman', uploadDocs.array('files'), cors(), async (req, res) => {
    const {
        bagli_id, type } = req.body

    try {
        const files = req.files;



        if (!files) {
            const error = new Error('No File')
            error.httpStatusCode = 400

            return next(error)
        }
        files.forEach(async element => {
            let belge_url = `assets\\docs\\${element.filename}`
            const insertQuery = await pool.query(`INSERT INTO
                 gk_dokuman(url, type, bagli_id,file_name) VALUES ( $1,$4, $2,$3);`,
                [belge_url, bagli_id, element.filename, type])
        });


        res.status(200).json({ status: 200, data: bagli_id });
    } catch (error) {

        res.status(500).json({ error: error });
    }
})

router.post('/deleteUygunsuzlukDokuman', cors(), async (req, res) => {
    const {
        id
    } = req.body
    try {

        const insertQuery = await pool.query(`
            DELETE FROM gk_dokuman  WHERE id = $1`, [id])
        let gkk_id = insertQuery.rows

        res.status(200).json({ status: 200, data: "kaydedildi" });
    } catch (error) {

        res.status(500).json({ error: error });
    }
})
router.post('/newUygunsuzlukDokuman', uygunsuzlukDocs.array('files'), cors(), async (req, res) => {
    const {
        bildirim_id, aciklama, tur
    } = req.body
    try {
        const files = req.files;
        if (!files) {
            const error = new Error('No File')
            error.httpStatusCode = 400
            return next(error)
        }
        files.forEach(async element => {
            let belge_url = `assets\\docs\\${element.filename}`
            const insertQuery = await pool.query(`
            INSERT INTO gk_dokuman (url,type,bagli_id,file_name,aciklama) 
            VALUES ($1,$5,$2,$3,$4)`, [belge_url, bildirim_id, element.filename, aciklama, tur])
            let gkk_id = insertQuery.rows
        });
        res.status(200).json({ status: 200, data: "kaydedildi" });
    } catch (error) {

        res.status(500).json({ error: error });
    }
})
router.post('/editUygunsuzlukDokuman', uygunsuzlukDocs.array('files'), cors(), async (req, res) => {
    const {
        id, aciklama
    } = req.body
    try {
        const files = req.files;
        if (!files) {
            const error = new Error('No File')
            error.httpStatusCode = 400
            return next(error)
        }

        files.forEach(async element => {
            let belge_url = `assets\\docs\\${element.filename}`
            const insertQuery = await pool.query(`
            Update gk_dokuman SET  aciklama = $1,url = $2 WHERE id = $3`, [aciklama, belge_url, id])
            let gkk_id = insertQuery.rows
        });
        res.status(200).json({ status: 200, data: "kaydedildi" });
    } catch (error) {

        res.status(500).json({ error: error });
    }
})
router.post('/postGkbildirm', cors(), async (req, res) => {
    const {
        text, dokuman, gk_id
    } = req.body
    try {

        const insertQuery = await pool.query(`
            INSERT INTO gk_gkk (text,gk_id) VALUES ($1,$2) RETURNING id`, [text, gk_id])
        let gkk_id = insertQuery.rows[0].id;

        res.status(200).json({ status: 200, data: gkk_id });
    } catch (error) {

        res.status(500).json({ error: error });
    }
})

router.post('/getYetkiGetir', cors(), async (req, res) => {
    try {
        const { user_sicil } = req.body

        const getYetkiUser = await pool.query(`
       SELECT * FROM gk_yetkilendirme gky INNER JOIN gk_yetki_list gkyl ON gkyl.id = gky.yetki_id WHERE gky.user_id = $1
        `, [user_sicil]);
        res.status(200).json({ status: 200, data: getYetkiUser.rows });
    } catch (error) {

        res.status(500).json({ error: error });
    }
});
router.post('/putYetki', cors(), async (req, res) => {
    try {
        const { user_sicil, type, is_active } = req.body
        let getYetkiUser
        let data = await pool.query('SELECT * FROM gk_yetkilendirme WHERE user_id = $1 AND yetki_id = $2', [user_sicil, type])
        if (data.rowCount > 0) {
            if (is_active) {

                getYetkiUser = await pool.query(`UPDATE gk_yetkilendirme SET okur_yazar = $1 WHERE user_id = $2 AND yetki_id = $3`, [is_active, user_sicil, type])
            } else {
                getYetkiUser = await pool.query(`DELETE FROM gk_yetkilendirme WHERE  user_id  =$1 AND yetki_id = $2`, [user_sicil, type])
            }
        } else {
            getYetkiUser = await pool.query(`
       INSERT INTO gk_yetkilendirme (user_id, yetki_id, okur_yazar) VALUES ($1,$2,$3)
        `, [user_sicil, type, is_active]);
        }

        res.status(200).json({ status: 200, data: getYetkiUser.rows });
    } catch (error) {

        res.status(500).json({ error: error });
    }
});
router.post('/getBirimCarpan', cors(), async (req, res) => {
    try {
        const { birim } = req.body
        const insertQuery = await pool.query(`
        SELECT *
    FROM gk_birim_carpan gkuk Where birim_id = $1
        `, [birim]);
        res.status(200).json({ status: 200, data: insertQuery.rows });
    } catch (error) {

        res.status(500).json({ error: error });
    }
});
router.post('/getCariSingelGelen', cors(), async (req, res) => {
    try {
        let ayGunler = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
        const { tur, ay, cari_id, kalite_tur } = req.body
        const today = new Date()
        const yil = today.getFullYear()
        const firstDateTimestamp = new Date(yil, ay - 1, 1);
        const firstDateFormat = firstDateTimestamp.toLocaleDateString('tr-TR'); // İstenilen tarih formatı
        const firstDate = firstDateFormat.replace(/\//g, '-'); // Gerektiğinde '/' karakterlerini '-' ile değiştir
        const finishDateTimestamp = new Date(yil, ay - 1, ayGunler[ay - 1]);
        const finishDateFormat = finishDateTimestamp.toLocaleDateString('tr-TR'); // İstenilen tarih formatı
        const finishDate = finishDateFormat.replace(/\//g, '-');
        const selectQuery = await pool.query(`
        SELECT *
    FROM gk_urun_kontrol Where cari= $1 AND tur = $2 AND kalite_tur=$5 AND created_date BETWEEN $3 AND $4
        `, [cari_id, tur, firstDate, finishDate, kalite_tur]);
        res.status(200).json({ status: 200, data: selectQuery.rows });
    } catch (error) {

        res.status(500).json({ error: error });
    }
});
router.post('/getCariTurRapor', cors(), async (req, res) => {
    try {
        let ayGunler = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
        const { tur, ay, kalite_tur } = req.body
        const today = new Date()
        const yil = today.getFullYear()
        const firstDateTimestamp = new Date(yil, ay - 1, 1);
        const firstDateFormat = firstDateTimestamp.toLocaleDateString('tr-TR'); // İstenilen tarih formatı
        const firstDate = firstDateFormat.replace(/\//g, '-'); // Gerektiğinde '/' karakterlerini '-' ile değiştir
        const finishDateTimestamp = new Date(yil, ay - 1, ayGunler[ay - 1]);
        const finishDateFormat = finishDateTimestamp.toLocaleDateString('tr-TR'); // İstenilen tarih formatı
        const finishDate = finishDateFormat.replace(/\//g, '-');
        console.log(req.body)
        const selectQuery = await pool.query(`
        SELECT cari,(select name FROM s_cari WHERE id = cari) as cari_name,SUM(gelen_miktar) as gelen,
SUM(kabul) as kabul,SUM(ogk) as ogk,SUM(iade) as iade,SUM(rework) as rework 
FROM  gk_urun_kontrol 
WHERE tur = $1 AND kalite_tur= $4 AND created_date BETWEEN $2 AND $3 GROUP BY cari
        `, [tur, firstDate, finishDate, kalite_tur]);
        res.status(200).json({ status: 200, data: selectQuery.rows });
    } catch (error) {

        res.status(500).json({ error: error });
    }
});
router.post('/getBirimCarpanGenel', cors(), async (req, res) => {
    try {
        const insertQuery = await pool.query(`
        SELECT *
    FROM gk_birim_carpan gkuk
        `);
        res.status(200).json({ status: 200, data: insertQuery.rows });
    } catch (error) {

        res.status(500).json({ error: error });
    }
});

router.post('/getSingelGkbildirm', cors(), async (req, res) => {
    const {
        bildirim_no
    } = req.body
    try {

        const insertQuery = await pool.query(`
           SELECT gkk.*,(select json_agg(veri) FROM (select * from gk_dokuman 
            WHERE bagli_id = gkk.id AND type = 2) veri) as dokuman FROM gk_gkk gkk WHERE gkk.id= $1`, [bildirim_no])
        let gkk_id = insertQuery.rows;

        res.status(200).json({ status: 200, data: gkk_id });
    } catch (error) {

        res.status(500).json({ error: error });
    }
})
router.post('/gkDepoUrunKod', cors(), async (req, res) => {


    const { urun_kod } = req.body;
    if (!urun_kod) {
        return res.status(400).json({ error: 'Invalid request body: Missing urun_kod' });
    }

    try {
        const resultPortal = await pool.query(`SELECT * FROM portal_tiger_aktif_cari`)
        const cari_yil = resultPortal.rows[0].yil
        const result = await pool.query(`SELECT * FROM gk_depo WHERE urun_kodu LIKE '%${urun_kod}%'`);
        const resultSiparis = await pool.query(`SELECT * FROM p_gunluk_satin_alma WHERE urun_kod LIKE '%${urun_kod}%'`);

        const mssqlPool = await poolPromises; // MSSQL bağlantısı
        const tigerCariOku = mssqlPool.request();
        const flowDataGuncelemeResult = await tigerCariOku.query(`SELECT CODE, NAME
FROM            dbo.LG_225_ITEMS
WHERE        (ACTIVE = 0) AND CODE LIKE '%${urun_kod}%'`);
        let cari = flowDataGuncelemeResult.recordsets[0]

        if (result.rowCount > 0) {
            res.status(200).json({
                status: 200,
                data: result.rows,
                siparis: resultSiparis.rows,
                urun_aciklama: cari
            });
        } else {
            res.status(204).json({
                status: 204,
                data: 'Urun Bulunamadı',
            });
        }
    } catch (error) {
        console.error('Database Error:', error);
        res.status(400).json(error);
    }
});


router.post('/uretimSarfSorgu', cors(), async (req, res) => {
    const { id, kalite_tur } = req.body;
    console.log(req.body);

    getToken(async (error, access_token) => {
        if (error) {
            res.status(500).json({ error: error });
            return;
        }

        // Koşullu WHERE sorgusu oluşturma
        let whereClause = `WHERE id = ${id}`;
        if (kalite_tur) {
            whereClause += ` AND kalite_tur = ${kalite_tur}`;
        }

        const insertQuery = await pool.query(`
            SELECT gkuk.id, gkuk.created_date, gkuk.stok_no, gkuk.status, gkuk.stok_aciklama, gkuk.lot,
                gkuk.proje, gkuk.tur, gkuk.cari, gkuk.siparis_no, gkuk.kaplama_fimasi,
                gkuk.aciklama, gkuk.gelen_miktar, gkuk.kabul, gkuk.ogk, gkuk.iade,
                gkuk.rework, gkuk.bildirim_no, gkuk.qr,
                (SELECT name FROM s_cari WHERE id = gkuk.cari) as cari_name,
                (SELECT id FROM gk_gkk WHERE id = gkuk.bildirim_no ) as gkk_bildirim_no,
                (SELECT json_agg(dokumans.*) FROM (
                    SELECT * FROM gk_dokuman gkd WHERE type=1 AND bagli_id = gkuk.id 
                    UNION 
                    SELECT gkd.* FROM gk_dokuman gkd WHERE type = 2 AND bagli_id = (SELECT id FROM gk_gkk WHERE gkuk.id=gk_id)
                ) as dokumans) as dokumanlar
            FROM gk_urun_kontrol gkuk 
            ${whereClause}
        `);

        if (insertQuery.rowCount > 0) {
            const { stok_no, lot } = insertQuery.rows[0];
            const url = `http://20.0.0.14:32001/api/v1/queries?tsql=${encodeURIComponent(`
                SELECT 
                    proItem.CODE as urun_kod,
                    proItem.NAME as urun_aciklama,
                    sarfSatir.INSLAMOUNT as sarf_miktar,
                    sarfSatir.DATE_ as sarf_tarih 
                FROM LG_225_ITEMS item 
                INNER JOIN LG_225_01_SERILOTN lotBul 
                    ON lotBul.CODE = '${lot}' 
                    AND lotBul.ITEMREF = item.LOGICALREF  
                INNER JOIN LG_225_01_SLTRANS sarfSatir 
                    ON sarfSatir.ITEMREF = item.LOGICALREF 
                    AND sarfSatir.IOCODE = 4 
                    AND sarfSatir.SLREF = lotBul.LOGICALREF 
                    AND sarfSatir.FICHETYPE = 12  
                INNER JOIN LG_225_01_STFICHE fich 
                    ON fich.LOGICALREF = sarfSatir.STFICHEREF  
                INNER JOIN LG_225_PRODORD prod 
                    ON prod.LOGICALREF = fich.PRODORDERREF  
                INNER JOIN LG_225_ITEMS proItem 
                    ON proItem.LOGICALREF = prod.ITEMREF    
                WHERE item.CODE = '${stok_no}'
            `)}`;

            const options = {
                method: 'GET',
                url: url,
                headers: {
                    Authorization: `Bearer ${access_token.access_token}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json'
                }
            };

            request(options, async function (error, response, body) {
                if (error) {
                    res.status(500).json({ error: error });
                    return;
                }

                const parsedBody = JSON.parse(body);
                ambar = parsedBody.items || [];
                res.json({ data: ambar, olcum: insertQuery.rows });
            });
        } else {
            res.json({ olcum: insertQuery.rows, data: [{ "veri gelmedi": "" }] });
        }
    });
});
router.post('/gkUrunKontrolDelete', cors(), async (req, res) => {
    try {
        const { id } = req.body
        const getDepoOncelik = await pool.query(`DELETE FROM gk_urun_kontrol WHERE id = $1`, [id])


        res.status(200).json({ status: 200, data: getDepoOncelik.rows });
    } catch (error) {
        res.status(400).json({ status: 400, data: error });

    }

});
router.post('/girisKaliteDepoOzelGet', cors(), async (req, res) => {
    try {
        const { limit, ofset, depo_adi, kod, filter, kalite_tur } = req.body;

        let arananDeger
        let offset = ofset
        // Parametreli sorgu
        const query = `
        SELECT 
            gd.urun_kodu, 
            gd.urun_aciklama, 
            gd.lot, 
            gd.miktar, 
            gd.id,
            gd.depo, 
            (SELECT qr FROM gk_urun_kontrol gkuk 
                 WHERE 
                     gkuk.stok_no = gd.urun_kodu 
                     AND gkuk.lot = gd.lot AND gkuk.kalite_tur=${kalite_tur}) AS qr,
            (SELECT id FROM gk_urun_kontrol gkuk 
                 WHERE 
                     gkuk.stok_no = gd.urun_kodu 
                     AND gkuk.lot = gd.lot AND gkuk.kalite_tur=${kalite_tur}) AS gkk_id,
            gd.is_active,
            gd.firma_lot,
            (SELECT json_agg(dok) 
             FROM (
                 SELECT 
                     (SELECT json_agg(dokum) 
                      FROM (SELECT * FROM gk_dokuman gkd 
                            WHERE gkd.type = 1 AND gkd.bagli_id = gkuk.id) dokum) AS dokuman,
                     (SELECT json_agg(uygunsuz) 
                      FROM (SELECT * FROM gk_dokuman gkd 
                            WHERE gkd.type = 2 AND gkd.bagli_id = (SELECT id FROM gk_gkk WHERE gk_id = gkuk.id)) uygunsuz) AS uygun_dokuman
                 FROM gk_urun_kontrol gkuk 
                 WHERE 
                     gkuk.stok_no = gd.urun_kodu 
                     AND gkuk.lot = gd.lot AND gkuk.kalite_tur=${kalite_tur}
             ) dok) AS dokumans,
            gd.created_date, 
            gd.gelis_tarih,
            gko.oncelik,
            gko.status,
            gko.proje_kod,
            gko.olcum_tarihi,
            gko.isteyen_user_id,
            gko.id AS oncelik_id,
            gko.is_delete,
            gko.is_active,
            (SELECT user_name FROM gk_user_istek WHERE gko.id = oncelik_id) AS user_name
        FROM 
            gk_depo gd
        LEFT JOIN 
            gk_oncelik gko ON gko.urun_kodu = gd.urun_kodu 
                           
                           AND gko.lot = gd.lot 
                           AND gko.miktar = gd.miktar 
        WHERE 
            gd.is_active = true 
            AND ${filter}
        ORDER BY 
            gko.oncelik DESC NULLS LAST 
        LIMIT ${limit} OFFSET ${offset}`;
        const query2 = `
        SELECT 
           count(id)        
        FROM 
            gk_depo gd
        WHERE 
            gd.is_active = true 
            AND ${filter}
       
       `;
        const getDepoOncelik = await pool.query(query);
        const totoal = await pool.query(query2);

        res.status(200).json({ status: 200, data: getDepoOncelik.rows, totalVeri: totoal.rows[0].count });
    } catch (error) {
        console.error("Sorgu Hatası:", error); // Detaylı hata çıktısı
        res.status(400).json({ status: 400, data: error });
    }
});

router.post('/girisKaliteDepoGet', cors(), async (req, res) => {
    try {
        const { kalite_tur } = req.body
        console.log(kalite_tur)
        const getDepoOncelik = await pool.query(`SELECT 
        gd.urun_kodu, 
        gd.urun_aciklama, 
        gd.lot, 
        gd.miktar, 
        gd.id,
        gd.depo, 
        (select qr FROM gk_urun_kontrol gkuk 
             WHERE 
                 gkuk.stok_no = gd.urun_kodu 
                 AND gkuk.lot = gd.lot  AND gkuk.kalite_tur=${kalite_tur} ),
        (select id FROM gk_urun_kontrol gkuk 
             WHERE 
                 gkuk.stok_no = gd.urun_kodu 
                 AND gkuk.lot = gd.lot  AND gkuk.kalite_tur=${kalite_tur}) as gkk_id,
        gd.is_active,
        gd.firma_lot,
        (SELECT json_agg(dok) 
         FROM (
             SELECT 
                 (SELECT json_agg(dokum) 
                  FROM (SELECT * FROM gk_dokuman gkd 
                        WHERE gkd.type = 1 AND gkd.bagli_id = gkuk.id) dokum) AS dokuman,
                 (SELECT json_agg(uygunsuz) 
                  FROM (SELECT * FROM gk_dokuman gkd 
                        WHERE gkd.type = 2 AND gkd.bagli_id = (SELECT id FROM gk_gkk WHERE gk_id = gkuk.id)) uygunsuz) AS uygun_dokuman
             FROM gk_urun_kontrol gkuk 
             WHERE 
                 gkuk.stok_no = gd.urun_kodu 
                 AND gkuk.lot = gd.lot  AND gkuk.kalite_tur=${kalite_tur}
         ) dok) AS dokumans,
        gd.created_date, 
        gd.gelis_tarih,
        gko.oncelik,
        gko.status,
        gko.proje_kod,
        gko.olcum_tarihi,
        gko.isteyen_user_id,
        gko.id AS oncelik_id,
        gko.is_delete,
        gko.is_active,
        (SELECT user_name FROM gk_user_istek WHERE gko.id = oncelik_id) AS user_name
    FROM 
        gk_depo gd
    LEFT JOIN 
        gk_oncelik gko ON gko.urun_kodu = gd.urun_kodu 
                       
                       AND gko.lot = gd.lot 
                       AND gko.miktar = gd.miktar 
    WHERE 
        gd.is_active = true 
    ORDER BY 
        gko.oncelik DESC NULLS LAST`)


        res.status(200).json({ status: 200, data: getDepoOncelik.rows });
    } catch (error) {
        res.status(400).json({ status: 400, data: error });

    }

});

router.post('/getGkUrunKontrolTumu', cors(), async (req, res) => {
    try {
        const { baslangic, bitis, limit, ofset, filterData, kalite_tur } = req.body;
        console.log(req.body)
        const totalCountQuery = await pool.query(`
            SELECT COUNT(*) as total FROM gk_urun_kontrol WHERE kalite_tur=$1 
        `, [kalite_tur]);
        const totalCount = totalCountQuery.rows[0].total;
        const insertQuery = await pool.query(`
             SELECT gkuk.id, gkuk.created_date, gkuk.stok_no, gkuk.status, gkuk.stok_aciklama, gkuk.lot,
                gkuk.proje, gkuk.tur, gkuk.cari, gkuk.siparis_no, gkuk.kaplama_fimasi,
                gkuk.aciklama, gkuk.gelen_miktar, gkuk.kabul, gkuk.ogk, gkuk.iade,
                gkuk.rework, gkuk.bildirim_no, gkuk.qr,
                (SELECT name FROM s_cari WHERE id = gkuk.cari) AS cari_name,
                (SELECT id FROM gk_gkk WHERE id = gkuk.bildirim_no) AS gkk_bildirim_no,
                (SELECT json_agg(dokumans.*)
                    FROM (
                        SELECT * FROM gk_dokuman gkd WHERE type=1 AND bagli_id = gkuk.id
                        UNION 
                        SELECT gkd.* FROM gk_dokuman gkd WHERE type = 2 AND bagli_id = 
                            (SELECT id FROM gk_gkk WHERE gkuk.id = gk_id)
                    ) AS dokumans) AS dokumanlar
            FROM gk_urun_kontrol gkuk
            WHERE gkuk.kalite_tur=$3
            ${filterData} 
            LIMIT $1 OFFSET $2
        `, [limit, ofset, kalite_tur]);
        res.status(200).json({ status: 200, data: insertQuery.rows, total: totalCount });
    } catch (error) {

        res.status(500).json({ error: error });
    }
});
router.post('/getGkUrunKontrol3', cors(), async (req, res) => {
    try {
        const { baslangic, bitis, limit, ofset, filterData, kalite_tur } = req.body;
        console.log(req.body)
        const totalCountQuery = await pool.query(`
            SELECT COUNT(*) as total FROM gk_urun_kontrol WHERE kalite_tur=$3 AND created_date BETWEEN $1 AND $2
        `, [baslangic, bitis, kalite_tur]);
        const totalCount = totalCountQuery.rows[0].total;
        const insertQuery = await pool.query(`
             SELECT gkuk.id, gkuk.created_date, gkuk.stok_no, gkuk.status, gkuk.stok_aciklama, gkuk.lot,
                gkuk.proje, gkuk.tur, gkuk.cari, gkuk.siparis_no, gkuk.kaplama_fimasi,
                gkuk.aciklama, gkuk.gelen_miktar, gkuk.kabul, gkuk.ogk, gkuk.iade,
                gkuk.rework, gkuk.bildirim_no, gkuk.qr,
                (SELECT name FROM s_cari WHERE id = gkuk.cari) AS cari_name,
                (SELECT id FROM gk_gkk WHERE id = gkuk.bildirim_no) AS gkk_bildirim_no,
                (SELECT json_agg(dokumans.*)
                    FROM (
                        SELECT * FROM gk_dokuman gkd WHERE type=1 AND bagli_id = gkuk.id
                        UNION 
                        SELECT gkd.* FROM gk_dokuman gkd WHERE type = 2 AND bagli_id = 
                            (SELECT id FROM gk_gkk WHERE gkuk.id = gk_id)
                    ) AS dokumans) AS dokumanlar
            FROM gk_urun_kontrol gkuk
            WHERE gkuk.kalite_tur=$5 AND tur is not null AND created_date BETWEEN $1 AND $2 
            ${filterData} 
            LIMIT $3 OFFSET $4
        `, [baslangic, bitis, limit, ofset, kalite_tur]);
        res.status(200).json({ status: 200, data: insertQuery.rows, total: totalCount });
    } catch (error) {

        res.status(500).json({ error: error });
    }
});

router.post('/gkOncelikInsert', async (req, res) => {
    try {
        const today = new Date()
        const { urun_kodu, lot, urun_aciklama, miktar, oncelik, status, proje_kod, isteyen_user_id, created_date, updated_date, is_active, is_delete, gelis_tarihi, olcum_tarihi, user_name, user_id } = req.body
        const text = "INSERT INTO gk_oncelik (urun_kodu,lot ,urun_aciklama ,miktar,oncelik ,status,proje_kod ,isteyen_user_id ,created_date ,updated_date ,is_active ,is_delete ,gelis_tarihi ,olcum_tarihi) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *"

        const values = [urun_kodu, lot, urun_aciklama, miktar, oncelik, status, proje_kod, isteyen_user_id, today, today, is_active, is_delete, gelis_tarihi, olcum_tarihi]

        const rows = await pool.query(text, values)
        const insertUser = await pool.query(`INSERT INTO public.gk_user_istek(user_id, oncelik_id, user_name) VALUES($1,$2,$3)`, [user_id, rows.rows[0].id, user_name])
        return res.status(201).json({ status: 200, data: rows.rows })
    } catch (error) {
        return res.status(400).json({ message: error.message })
    }
})
// update 
router.post('/gkOncelikUpdate', async (req, res) => {
    const today = new Date()
    try {
        const { urun_kodu, lot, urun_aciklama, miktar, oncelik, status, proje_kod, isteyen_user_id, created_date, updated_date, is_active, is_delete, gelis_tarihi, olcum_tarihi, oncelik_id, user_name, user_id } = req.body
        const text = `UPDATE gk_oncelik SET urun_kodu=$1,lot=$2 ,urun_aciklama=$3 ,
        miktar=$4,oncelik=$5 ,status=$6,proje_kod=$7 ,isteyen_user_id=$8 ,updated_date=$9,
        is_active=$10 ,is_delete=$11 ,gelis_tarihi=$12 ,olcum_tarihi=$13 Where id = $14 RETURNING *`
        const values = [urun_kodu, lot, urun_aciklama, miktar, oncelik, status, proje_kod, isteyen_user_id, today, is_active, is_delete, gelis_tarihi, olcum_tarihi, oncelik_id]
        const rows = await pool.query(text, values)
        const veriData = await pool.query(`SELECT * FROM gk_user_istek WHERE  oncelik_id=$1 AND user_id = $2`, [rows.rows[0].id, user_id])
        if (veriData.rowCount > 0) {
            const insertUser = await pool.query(`Update gk_user_istek set user_id=$1,  user_name=$3 WHERE oncelik_id=$2`, [user_id, rows.rows[0].id, user_name])

        } else {
            const insertUser = await pool.query(`INSERT INTO public.gk_user_istek(user_id, oncelik_id, user_name) VALUES($1,$2,$3)`, [user_id, rows.rows[0].id, user_name])

        }
        if (!rows.length)
            return res.status(404).json({ message: 'User not found.' })
        return res.status(200).json({ status: 200, data: rows.rows })
    } catch (error) {

        return res.status(400).json({ message: error.message })
    }

})

router.post('/getPuanlamaTablosuBirimGecici', cors(), async (req, res) => {
    try {
        let ayGunler = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
        const { ay, birim_id, tur, kalite_tur, yil } = req.body
        const today = new Date()
        console.log(req.body)
        const firstDateTimestamp = new Date(yil, ay - 1, 1);
        const firstDateFormat = firstDateTimestamp.toLocaleDateString('tr-TR'); // İstenilen tarih formatı
        const firstDate = firstDateFormat.replace(/\//g, '-'); // Gerektiğinde '/' karakterlerini '-' ile değiştir
        const finishDateTimestamp = new Date(yil, ay - 1, ayGunler[ay - 1]);
        const finishDateFormat = finishDateTimestamp.toLocaleDateString('tr-TR'); // İstenilen tarih formatı
        const finishDate = finishDateFormat.replace(/\//g, '-'); // Gerektiğinde '/' karakterlerini '-' ile değiştir
        const insertQuery = await pool.query(`
               SELECT 
                cari,
                (select name from s_cari WHERE id = cari ) as cari_name,
                MAX(puan_id) AS puan_id,
                MAX(puan) AS puan
            FROM 
                (
                    SELECT 
                        id as cari,
                        0 AS puan_id,
                        0 AS puan,
                        0 AS birim_id
                    FROM 
                        s_cari
					WHERE gecici= 1
                 
                    UNION ALL
            
                    SELECT 
                        cari_id,
                        id AS puan_id,
                        puan AS puan,
                        birim_id AS birim_id
                    FROM 
                        gk_tedarikci_puan 
                    WHERE 
                       birim_id = $1
                       AND yil=2024 AND ay = 12
                ) AS combined_data
            GROUP BY 
                cari;
        `, [birim_id])

        res.status(200).json({ status: 200, data: insertQuery.rows });
    } catch (error) {

        res.status(500).json({ error: error });
    }
})
router.post('/getPuanlamaTablosuBirim', cors(), async (req, res) => {
    try {
        let ayGunler = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
        const { ay, birim_id, tur, kalite_tur, yil } = req.body
        const today = new Date()
        console.log(req.body)
        const firstDateTimestamp = new Date(yil, ay - 1, 1);
        const firstDateFormat = firstDateTimestamp.toLocaleDateString('tr-TR'); // İstenilen tarih formatı
        const firstDate = firstDateFormat.replace(/\//g, '-'); // Gerektiğinde '/' karakterlerini '-' ile değiştir
        const finishDateTimestamp = new Date(yil, ay - 1, ayGunler[ay - 1]);
        const finishDateFormat = finishDateTimestamp.toLocaleDateString('tr-TR'); // İstenilen tarih formatı
        const finishDate = finishDateFormat.replace(/\//g, '-'); // Gerektiğinde '/' karakterlerini '-' ile değiştir
        const insertQuery = await pool.query(`
            SELECT 
                cari,
                (select name from s_cari WHERE id = cari ) as cari_name,
                MAX(puan_id) AS puan_id,
                MAX(puan) AS puan
            FROM 
                (
                    SELECT 
                        cari,
                        0 AS puan_id,
                        0 AS puan,
                        0 AS birim_id
                    FROM 
                        gk_urun_kontrol 
                    WHERE kalite_tur=$7 AND
                        tur = $6 
                        AND created_date BETWEEN $3 AND $4
            
                    UNION ALL
            
                    SELECT 
                        cari_id,
                        id AS puan_id,
                        puan AS puan,
                        birim_id AS birim_id
                    FROM 
                        gk_tedarikci_puan 
                    WHERE 
                        ay = $1 AND yil=$8 AND birim_id = $2 AND tur = $5
                ) AS combined_data
            GROUP BY 
                cari;
        `, [ay, birim_id, firstDate, finishDate, tur, tur, kalite_tur,yil])

        res.status(200).json({ status: 200, data: insertQuery.rows });
    } catch (error) {

        res.status(500).json({ error: error });
    }
})

router.post('/postPuanlamaTablosuBirim', cors(), async (req, res) => {
    try {
        const data = req.body
        const today = new Date()
        data.forEach(async items => {
            const veriKontrol = await pool.query(`SELECT * FROM gk_tedarikci_puan puan WHERE puan.cari_id = ${items.cari_id} AND puan.yil = ${items.yil} AND puan.ay = ${items.ay} AND puan.birim_id= ${items.birim_id}`)
            if (veriKontrol.rowCount > 0) {
                if (items.puan_id == 0) {
                    items.puan_id = veriKontrol.rows[0].id
                }
            }
            if (items.puan_id == 0) {

                const insertQuery = await pool.query(`INSERT INTO gk_tedarikci_puan(
            cari_id, birim_id, puan, ay, created_date, user_id,tur,yil)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        `, [items.cari_id, items.birim_id, items.puan, items.ay, today, items.user_id, items.tur, items.yil])
                const selectBirimCarpan = await pool.query(`SELECT birim_id,carpan FROM gk_birim_carpan WHERE birim_id = $1`, [items.birim_id])
                const selectBirimCarpanVeri = selectBirimCarpan.rows[0].carpan
                let sonuc = (items.puan * selectBirimCarpanVeri) / 100
                const cariPuanSql = await pool.query(`SELECT * FROM s_cari_puan WHERE cari_id = $1 AND ay = $2`, [items.cari_id, items.ay])
                if (cariPuanSql.rowCount > 0) {
                    let cariPuanID = cariPuanSql.rows[0].id
                    let cariPuanDeger = cariPuanSql.rows[0].puan + sonuc
                    const cariPuanUpdate = await pool.query(`UPDATE s_cari_puan SET puan=$1 WHERE id = $2`, [cariPuanDeger, cariPuanID])
                } else {
                    const cariPuanInsert = await pool.query(`INSERT INTO  s_cari_puan (cari_id,ay,created_date,puan) VALUES ($1,$2,$3,$4)`, [items.cari_id, items.ay, today, sonuc])
                }

            } else {

                const selectPuanGetir = await pool.query(`SELECT * FROM gk_tedarikci_puan WHERE id = $1`, [items.puan_id])
                const eskiPuan = selectPuanGetir.rows[0].puan
                const insertQuery = await pool.query(`UPDATE gk_tedarikci_puan SET puan=$1 WHERE id = $2`, [items.puan, items.puan_id])


                const selectBirimCarpan = await pool.query(`SELECT birim_id,carpan FROM gk_birim_carpan WHERE birim_id = $1`, [items.birim_id])
                const selectBirimCarpanVeri = selectBirimCarpan.rows[0].carpan
                let sonuc = (items.puan * selectBirimCarpanVeri) / 100
                let sonucEski = (eskiPuan * selectBirimCarpanVeri) / 100

                const cariPuanSql = await pool.query(`SELECT * FROM s_cari_puan WHERE cari_id = $1 AND ay = $2`, [items.cari_id, items.ay])
                if (cariPuanSql.rowCount > 0) {
                    let cariPuanID = cariPuanSql.rows[0].id
                    let cariPuanDegerEski = cariPuanSql.rows[0].puan - sonucEski
                    let cariPuanDeger = cariPuanDegerEski + sonuc

                    const cariPuanUpdate = await pool.query(`UPDATE s_cari_puan SET puan=$1 WHERE id = $2`, [cariPuanDeger, cariPuanID])
                } else {
                    const cariPuanInsert = await pool.query(`INSERT INTO  s_cari_puan (cari_id,ay,created_date,puan) VALUES ($1,$2,$3,$4)`, [items.cari_id, items.ay, today, sonuc])
                }
            }


        })


        res.status(200).json({ status: 200, data: "veri kaydedildi" });
    } catch (error) {

        res.status(500).json({ error: error });
    }
})

router.post('/getCariPaunKumulatif', cors(), async (req, res) => {
    try {
        const { cari_id, tur, tur_id, startDate, endDate } = req.body


        console.log([startDate.ay, endDate.ay, tur_id, startDate.yil, endDate.yil])
        const getCariPuanQuery = await pool.query(`SELECT cari_id,ROUND(SUM((puan*carpan)/100),2) as avg FROM (
	SELECT 
        ROUND(AVG(gtp.puan)::numeric, 2) as puan,
                gtp.cari_id,
        gtp.birim_id,carpan.carpan,
        (SELECT sc.name FROM s_cari sc WHERE sc.id = gtp.cari_id) AS name
      FROM 
        gk_tedarikci_puan gtp 
	INNER JOIN gk_birim_carpan carpan ON carpan.birim_id = gtp.birim_id
      WHERE 
       ay BETWEEN $1 and $2 AND yil BETWEEN $4 AND $5
        AND  tur = $3 
      GROUP BY 
        gtp.cari_id,carpan.carpan,
        gtp.birim_id
        ORDER BY puan
)as cari_puan
GROUP BY cari_id
 `, [startDate.ay >= endDate.ay ? endDate.ay : startDate.ay, endDate.ay >= startDate.ay ? endDate.ay : startDate.ay,tur, startDate.yil, endDate.yil])



        const getCariPuan = await pool.query(`	SELECT 
        ROUND(AVG(gtp.puan)::numeric, 2) as puan,
                gtp.cari_id,
        gtp.birim_id,
        (SELECT sc.name FROM s_cari sc WHERE sc.id = gtp.cari_id) AS name
      FROM 
        gk_tedarikci_puan gtp 
      WHERE 
       ay BETWEEN $1 and $2 AND yil BETWEEN $4 AND $5
        AND tur = $3 
      GROUP BY 
        gtp.cari_id,
        gtp.birim_id
        ORDER BY puan
        `, [startDate.ay >= endDate.ay ? endDate.ay : startDate.ay, endDate.ay >= startDate.ay ? endDate.ay : startDate.ay, tur_id, startDate.yil, endDate.yil])
        res.status(200).json({ status: 200, data: getCariPuanQuery.rows, tedarikciPuan: getCariPuan.rows });
    } catch (error) {

        res.status(400).json({ error: error });
    }
})


router.post('/getYetkilendirme', cors(), async (req, res) => {
    try {

        const getPuanQuery = await pool.query(`SELECT * FROM  gk_yetkilendirme`)
        res.status(200).json({ status: 200, data: getPuanQuery.rows });
    } catch (error) {

        res.status(500).json({ error: error });
    }
})
router.post('/getCariPaunSingel', cors(), async (req, res) => {
    try {
        const { cari_id } = req.body

        const getPuanQuery = await pool.query(`SELECT * FROM s_cari_puan WHERE cari_id = $1`, [cari_id])

        res.status(200).json({ status: 200, data: getPuanQuery.rows });
    } catch (error) {

        res.status(500).json({ error: error });
    }
})
router.post('/getFilterCariTur', cors(), async (req, res) => {
    try {
        const { tur, kalite_tur } = req.body

        const getPuanQuery = await pool.query(`SELECT cari as cari_id,(select name from s_cari WHERE id = cari) as cari_name, SUM(gelen_miktar) as gelen,SUM(kabul) as kabul,sum(ogk) as ogk,SUM(iade) as iade,
        SUM(rework) as rework FROM gk_urun_kontrol WHERE tur =$1 AND kalite_tur=$2	GROUP by cari`, [tur, kalite_tur])

        res.status(200).json({ status: 200, data: getPuanQuery.rows });
    } catch (error) {

        res.status(500).json({ error: error });
    }
})



router.post('/insertTedarikciZiyaret', cors(), async (req, res) => {
    try {
        const {
            cari_id,
            projes,
            users,
            ziyaret_tur,
            nots, ziyaret_tarih, hafta } = req.body


        const ziyaretInsertQuery = await pool.query(`INSERT INTO km_ziyaret(
            cari_id, ziyaret_tur,ziyaret_tarih,hafta)
            VALUES ($1, $2,$3,$4) RETURNING id`, [cari_id, ziyaret_tur, ziyaret_tarih, hafta])
        let ziyaretID = ziyaretInsertQuery.rows[0].id;
        projes.forEach(async element => {
            const ziyaretProjeInsert = await pool.query(`INSERT INTO km_ziyaret_proje(ziyaret_id,proje)
                VALUES ($1, $2) RETURNING id`, [ziyaretID, element.proje])
        });
        nots.forEach(async element => {
            const ziyaretNotsInsert = await pool.query(`INSERT INTO km_ziyaret_notlar(ziyaret_id,aciklama)
                VALUES ($1, $2) RETURNING id`, [ziyaretID, element.content])
        });
        users.forEach(async element => {
            const ziyaretUsersInsert = await pool.query(`INSERT INTO km_ziyaret_users(ziyaret_id,user_name,user_id,sicil)
                VALUES ($1, $2,$3,$4) RETURNING id`, [ziyaretID, element.user_name, element.user_id, element.sicil])
        });


        res.status(200).json({ status: 200, data: ziyaretID });


    } catch (error) {

        res.status(500).json({ error: error });
    }
})



router.post('/insertTedarikciKMDenetim', uploaKMDocs.array('files'), cors(), async (req, res) => {
    try {
        // const { ziyaretIcerik, ziyaret_id, urun_kod, siparis_no, sunulan, gecen, uygunsuz, created_date, ay, hafta, is_go, step, tur, sartliKabulData, ccIcerik } = req.body
        const ziyaretIcerik2 = ziyaretIcerik ? JSON.parse(ziyaretIcerik) : "";
        let ziyaretID
        if (ziyaret_id != "" && ziyaret_id != null) {
            ziyaretID = ziyaret_id
            const files = req.files;
            const denetimInsertQuery = await pool.query(`INSERT INTO km_denetim(
        ziyaret_id, urun_kod, siparis_no, gelen_miktar, gecen, red, created_date, ay, hafta, is_go)
       VALUES ( $1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`, [ziyaretID, urun_kod, siparis_no, sunulan, gecen, uygunsuz, created_date, ay, hafta, is_go])
            let denetimID = denetimInsertQuery.rows[0].id;
            const parsedSartliKabulData = JSON.parse(sartliKabulData);

            if (parsedSartliKabulData.user_mail && parsedSartliKabulData.user_mail.length > 0) {

                const sartliKabulTalepQuery = await pool.query(`INSERT INTO km_sartli 
                    (ziyaret_id, denetim_id,  onay_aciklama, urun_kodu, gecen, red) 
                    VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`, [ziyaretID, denetimID, parsedSartliKabulData.aciklama, urun_kod, sunulan, uygunsuz])
                // const sartliKabulID = sartliKabulTalepQuery.rows[0].id
                files.forEach(async element => {
                    let belge_url = `assets\\docs\\${element.filename}`
                    const insertQuery = await pool.query(`INSERT INTO
                     gk_dokuman(url, type, bagli_id,file_name) VALUES ( $1,4, $2,$3);`,
                        [belge_url, sartliKabulID, element.filename])
                });

                // let kisiler = "";

                // parsedSartliKabulData.user_mail.forEach((kisis, index) => {
                //     const insertQuery = pool.query(`INSERT INTO km_sartli_onay(sartli_id, user_id) VALUES ($1, $2);`,
                //         [sartliKabulID, kisis.user_id]);

                //     // Son elemanın sonuna virgül ekleme
                //     if (index === parsedSartliKabulData.user_mail.length - 1) {
                //         kisiler += kisis.user_mail; // Son eleman
                //     } else {
                //         kisiler += kisis.user_mail + ","; // Diğer elemanlar
                //     }
                // });

                let kisiler = "ekoc@aho.com.tr,Bilgiislem@aho.com.tr"
                let urun_kod = "deneme urun"
                let sartli = "deneme urun"
                let uygunsuz = "deneme urun"
                let ccIcerik = "ekoc@aho.com.tr"
                let sartliKabulID = 1

                let tableRows = `
                    <tr style="border: 1px solid #ddd;">
                      <th style="border: 1px solid #ddd; padding: 8px;">Ürün Kodu</th>
                      <th style="border: 1px solid #ddd; padding: 8px;">Ürün Açıklama</th>
                      <th style="border: 1px solid #ddd; padding: 8px;">Firma Adı</th>
                      <th style="border: 1px solid #ddd; padding: 8px;">Sunulan Miktari</th>
                      <th style="border: 1px solid #ddd; padding: 8px;">Şartlı Kabule Sunulan Miktar</th>
                      <th style="border: 1px solid #ddd; padding: 8px;">Aksiyon</th>
                    </tr>`;


                tableRows += `
                        <tr style="border: 1px solid #ddd;">
                          <td style="border: 1px solid #ddd; padding: 8px;">${urun_kod}</td>
                          <td style="border: 1px solid #ddd; padding: 8px;">${"urun_aciklama"}</td>
                          <td style="border: 1px solid #ddd; padding: 8px;">${"Firma Ad"}</td>
                          <td style="border: 1px solid #ddd; padding: 8px;">${sartli}</td>
                          <td style="border: 1px solid #ddd; padding: 8px;">${uygunsuz}</td>
                          <td style="border : 1px solid #ddd; padding:8px"><a href="kalite.aho.com/#/sartliKabul/${sartliKabulID}">Göster</a></td>
                          <td style="border : 1px solid #ddd; padding:8px"></td>
                        </tr>`;


                const fs = require('fs');
                const dosyaAdi = 'mailGonder.json';
                const yeniVeri = `Merhaba Firma ziyaretinde ölçüm sonuçlarına göre muayene esnasında ölçüm hataları görülmüştür. Değerlendirmeniz için aşağıdaki tabloda yer alan ürün doküman ve ölçüm sonuçları paylaşılmıştır 
                onay/red kararınıza göre firmadaki ürünler onay/red yapılacaktır. <table>${tableRows}</table>  Link ile giriş yapılamaması durumunda http://kalite.aho.com/#/sartliKabul/${sartliKabulID}  adresinden ulaşabilirsiniz.`
                const toGelen = kisiler
                const cc = ccIcerik
                const subject = "Ürün Şartlı Kabul"

                const mailBilgi = {
                    to: toGelen,
                    cc: ccIcerik,
                    subject: subject,
                    body: yeniVeri
                };

                fs.readFile(dosyaAdi, 'utf8', (err, data) => {
                    if (err) {
                        fs.writeFile(dosyaAdi, JSON.stringify(mailBilgi, null, 2), (err) => {
                            if (err) {
                                console.error("Dosyaya yazma sırasında bir hata oluştu.", err);
                            } else {

                            }
                        });
                    } else {
                        fs.unlink(dosyaAdi, (err) => {
                            if (err) {
                                console.error("Dosya silinirken bir hata oluştu.", err);
                            } else {
                                fs.writeFile(dosyaAdi, JSON.stringify(mailBilgi, null, 2), (err) => {
                                    if (err) {
                                        console.error("Dosyaya yazma sırasında bir hata oluştu.", err);
                                    } else {
                                        let data = {

                                            To: toGelen,
                                            CC: ccIcerik,
                                            Subject: subject,
                                            Body: yeniVeri
                                        }

                                        let config = {
                                            method: 'post',
                                            maxBodyLength: Infinity,
                                            url: 'http://localhost:5004/api/Home/sendMail',
                                            headers: {
                                                'Content-Type': 'application/json'
                                            },
                                            data: data
                                        };
                                        axios.request(config)
                                            .then((response) => {
                                            })
                                            .catch((error) => {
                                                console.log(error);
                                            });
                                    }
                                });
                            }
                        });
                    }
                });
            }


            if (!files) {
                const error = new Error('No File')
                error.httpStatusCode = 400

                return next(error)
            }
            JSON.parse(step).forEach(async element => {
                const denetimAdimlariInsertQuery = await pool.query(`INSERT INTO km_denetim_stpes_app( ziyaret_id, step_id, denetim_id) VALUES ( $1, $2, $3)`, [ziyaretID, element.id, denetimID])
            });
            JSON.parse(tur).forEach(async element => {
                const denetimTurInsertQuery = await pool.query(`INSERT INTO km_denetim_tur_app( ziyaret_id, tur_id, denetim_id) VALUES ( $1, $2, $3)`, [ziyaretID, element.id, denetimID])
            });

            files.forEach(async element => {
                let belge_url = `assets\\docs\\${element.filename}`
                const insertQuery = await pool.query(`INSERT INTO
                 gk_dokuman(url, type, bagli_id,file_name) VALUES ( $1,3, $2,$3);`,
                    [belge_url, denetimID, element.filename])
            });
        } else {
            const ziyaretInsertQuery = await pool.query(`INSERT INTO km_ziyaret(
        cari_id, ziyaret_tur,ziyaret_tarih,hafta)
        VALUES ($1, $2,$3,$4) RETURNING id`, [ziyaretIcerik2.cari_id, ziyaretIcerik2.ziyaret_tur, ziyaretIcerik2.ziyaret_tarih, ziyaretIcerik2.hafta])
            ziyaretID = ziyaretInsertQuery.rows[0].id;
            ziyaretIcerik2.projes.forEach(async element => {
                const ziyaretProjeInsert = await pool.query(`INSERT INTO km_ziyaret_proje(ziyaret_id,proje)
            VALUES ($1, $2) RETURNING id`, [ziyaretID, element.proje])
            });
            ziyaretIcerik2.nots.forEach(async element => {
                const ziyaretNotsInsert = await pool.query(`INSERT INTO km_ziyaret_notlar(ziyaret_id,aciklama)
            VALUES ($1, $2) RETURNING id`, [ziyaretID, element.content])
            });
            ziyaretIcerik2.users.forEach(async element => {
                const ziyaretUsersInsert = await pool.query(`INSERT INTO km_ziyaret_users(ziyaret_id,user_name,user_id,sicil)
            VALUES ($1, $2,$3,$4) RETURNING id`, [ziyaretID, element.user_name, element.user_id, element.sicil])
            });

            const files = req.files;
            const denetimInsertQuery = await pool.query(`INSERT INTO km_denetim(
        ziyaret_id, urun_kod, siparis_no, gelen_miktar, gecen, red, created_date, ay, hafta, is_go)
       VALUES ( $1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`, [ziyaretID, urun_kod, siparis_no, sunulan, gecen, uygunsuz, created_date, ay, hafta, is_go])
            let denetimID = denetimInsertQuery.rows[0].id;

            if (!files) {
                const error = new Error('No File')
                error.httpStatusCode = 400

                return next(error)
            }
            const parsedSartliKabulData = JSON.parse(sartliKabulData);

            if (parsedSartliKabulData.user_mail && parsedSartliKabulData.user_mail.length > 0) {

                const sartliKabulTalepQuery = await pool.query(`INSERT INTO km_sartli 
                    (ziyaret_id, denetim_id,  onay_aciklama, urun_kodu, gecen, red) 
                    VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`, [ziyaretID, denetimID, parsedSartliKabulData.aciklama, urun_kod, sunulan, uygunsuz])
                const sartliKabulID = sartliKabulTalepQuery.rows[0].id
                files.forEach(async element => {
                    let belge_url = `assets\\docs\\${element.filename}`
                    const insertQuery = await pool.query(`INSERT INTO
                     gk_dokuman(url, type, bagli_id,file_name) VALUES ( $1,4, $2,$3);`,
                        [belge_url, sartliKabulID, element.filename])
                });
                let kisiler = "";

                parsedSartliKabulData.user_mail.forEach((kisis, index) => {
                    const insertQuery = pool.query(`INSERT INTO km_sartli_onay(sartli_id, user_id) VALUES ($1, $2);`,
                        [sartliKabulID, kisis.user_id]);

                    // Son elemanın sonuna virgül ekleme
                    if (index === parsedSartliKabulData.user_mail.length - 1) {
                        kisiler += kisis.user_mail; // Son eleman
                    } else {
                        kisiler += kisis.user_mail + ","; // Diğer elemanlar
                    }
                });
                let tableRows = `
                    <tr style="border: 1px solid #ddd;">
                      <th style="border: 1px solid #ddd; padding: 8px;">Ürün Kodu</th>
                      <th style="border: 1px solid #ddd; padding: 8px;">Ürün Açıklama</th>
                      <th style="border: 1px solid #ddd; padding: 8px;">Firma Adı</th>
                      <th style="border: 1px solid #ddd; padding: 8px;">Sunulan Miktari</th>
                      <th style="border: 1px solid #ddd; padding: 8px;">Şartlı Kabule Sunulan Miktar</th>
                      <th style="border: 1px solid #ddd; padding: 8px;">Aksiyon</th>
                    </tr>`;


                tableRows += `
                        <tr style="border: 1px solid #ddd;">
                          <td style="border: 1px solid #ddd; padding: 8px;">${urun_kod}</td>
                          <td style="border: 1px solid #ddd; padding: 8px;">${"urun_aciklama"}</td>
                          <td style="border: 1px solid #ddd; padding: 8px;">${"Firma Ad"}</td>
                          <td style="border: 1px solid #ddd; padding: 8px;">${sunulan}</td>
                          <td style="border: 1px solid #ddd; padding: 8px;">${uygunsuz}</td>
                          <td style="border : 1px solid #ddd; padding:8px"><a href="10.0.0.35:56940/#/sartliKabul/${sartliKabulID}">Göster</a></td>
                        </tr>`;


                const fs = require('fs');
                const dosyaAdi = 'mailGonder.json';
                const yeniVeri = `Merhaba Firma ziyaretinde ölçüm sonuçlarına göre muayene esnasında ölçüm hataları görülmüştür. Değerlendirmeniz için aşağıdaki tabloda yer alan ürün doküman ve ölçüm sonuçları paylaşılmıştır 
                onay/red kararınıza göre firmadaki ürünler onay/red yapılacaktır. <table>${tableRows}</table> `
                const toGelen = kisiler
                const cc = ccIcerik
                const subject = "Ürün Şartlı Kabul"

                const mailBilgi = {
                    to: toGelen,
                    cc: ccIcerik,
                    subject: subject,
                    body: yeniVeri
                };
                fs.readFile(dosyaAdi, 'utf8', (err, data) => {
                    if (err) {
                        fs.writeFile(dosyaAdi, JSON.stringify(mailBilgi, null, 2), (err) => {
                            if (err) {
                                console.error("Dosyaya yazma sırasında bir hata oluştu.", err);
                            } else {

                            }
                        });
                    } else {
                        fs.unlink(dosyaAdi, (err) => {
                            if (err) {
                                console.error("Dosya silinirken bir hata oluştu.", err);
                            } else {
                                fs.writeFile(dosyaAdi, JSON.stringify(mailBilgi, null, 2), (err) => {
                                    if (err) {
                                        console.error("Dosyaya yazma sırasında bir hata oluştu.", err);
                                    } else {


                                        let data = {

                                            To: toGelen,
                                            CC: ccIcerik,
                                            Subject: subject,
                                            Body: yeniVeri
                                        }


                                    }
                                });
                            }
                        });
                    }
                });
            }
            JSON.parse(step).forEach(async element => {
                const denetimAdimlariInsertQuery = await pool.query(`INSERT INTO km_denetim_stpes_app( ziyaret_id, step_id, denetim_id) VALUES ( $1, $2, $3)`, [ziyaretID, element.id, denetimID])
            });
            JSON.parse(tur).forEach(async element => {
                const denetimTurInsertQuery = await pool.query(`INSERT INTO km_denetim_tur_app( ziyaret_id, tur_id, denetim_id) VALUES ( $1, $2, $3)`, [ziyaretID, element.id, denetimID])
            });

            files.forEach(async element => {
                let belge_url = `assets\\docs\\${element.filename}`
                const insertQuery = await pool.query(`INSERT INTO
                 gk_dokuman(url, type, bagli_id,file_name) VALUES ( $1,3, $2,$3);`,
                    [belge_url, denetimID, element.filename])
            });
        }


        res.status(200).json({ status: 200, data: ziyaretID });


    } catch (error) {
        res.status(500).json({ error: error });
    }
})
router.post('/insertTedarikciKMDenetims', uploaKMDocs.array('files'), cors(), async (req, res) => {
    try {
        // const { ziyaretIcerik, ziyaret_id, urun_kod, siparis_no, sunulan, gecen, uygunsuz, created_date, ay, hafta, is_go, step, tur, sartliKabulData, ccIcerik } = req.body
        let kisiler = "idari@aho.com.tr"
        let urun_kod = "deneme urun"
        let sartli = "kokpit test"
        let uygunsuz = "test"
        let ccIcerik = "ekoc@aho.com.tr"
        let sartliKabulID = 1

        let tableRows = `
                    <tr style="border: 1px solid #ddd;">
                      <th style="border: 1px solid #ddd; padding: 8px;">Ürün Kodu</th>
                      <th style="border: 1px solid #ddd; padding: 8px;">Ürün Açıklama</th>
                      <th style="border: 1px solid #ddd; padding: 8px;">Firma Adı</th>
                      <th style="border: 1px solid #ddd; padding: 8px;">Sunulan Miktari</th>
                      <th style="border: 1px solid #ddd; padding: 8px;">Şartlı Kabule Sunulan Miktar</th>
                      <th style="border: 1px solid #ddd; padding: 8px;">Aksiyon</th>
                    </tr>`;


        tableRows += `
                        <tr style="border: 1px solid #ddd;">
                          <td style="border: 1px solid #ddd; padding: 8px;">${urun_kod}</td>
                          <td style="border: 1px solid #ddd; padding: 8px;">${"urun_aciklama"}</td>
                          <td style="border: 1px solid #ddd; padding: 8px;">${"Firma Ad"}</td>
                          <td style="border: 1px solid #ddd; padding: 8px;">${sartli}</td>
                          <td style="border: 1px solid #ddd; padding: 8px;">${uygunsuz}</td>
                          <td style="border : 1px solid #ddd; padding:8px"><a href="kalite.aho.com/#/sartliKabul/${sartliKabulID}">Göster</a></td>
                          <td style="border : 1px solid #ddd; padding:8px"></td>
                        </tr>`;


        const dosyaAdi = 'mailGonder.json';
        const yeniVeri = `TEST MAİLİDİR`
        const toGelen = kisiler
        const cc = ccIcerik
        const subject = "TEST"

        const mailBilgi = {
            to: toGelen,
            cc: ccIcerik,
            subject: subject,
            body: yeniVeri
        };

        fs.readFile(dosyaAdi, 'utf8', (err, data) => {
            if (err) {
                fs.writeFile(dosyaAdi, JSON.stringify(mailBilgi, null, 2), (err) => {
                    if (err) {
                        console.error("Dosyaya yazma sırasında bir hata oluştu.", err);
                    } else {

                    }
                });
            } else {
                fs.unlink(dosyaAdi, (err) => {
                    if (err) {
                        console.error("Dosya silinirken bir hata oluştu.", err);
                    } else {
                        fs.writeFile(dosyaAdi, JSON.stringify(mailBilgi, null, 2), (err) => {
                            if (err) {
                                console.error("Dosyaya yazma sırasında bir hata oluştu.", err);
                            } else {
                                let data = {

                                    To: toGelen,
                                    CC: ccIcerik,
                                    Subject: subject,
                                    Body: yeniVeri
                                }

                                let config = {
                                    method: 'post',
                                    maxBodyLength: Infinity,
                                    url: 'http://localhost:5004/api/Home/sendMail',
                                    headers: {
                                        'Content-Type': 'application/json'
                                    },
                                    data: data
                                };
                                axios.request(config)
                                    .then((response) => {
                                    })
                                    .catch((error) => {
                                        console.log(error);
                                    });
                            }
                        });
                    }
                });
            }
        });



        res.status(200).json({ status: 200, data: ziyaretID });


    } catch (error) {
        res.status(500).json({ error: error });
    }
})
router.post('/sarliKabulUpdate', cors(), async (req, res) => {
    try {
        const { onay, id, user_id } = req.body
        const files = req.files;
        const getKontrol = await pool.query(`SELECT * FROM km_sartli_onay WHERE user_id = ${user_id} AND sartli_id = ${id} `)
        const ziyaretInsertQuery = await pool.query(`UPDATE km_sartli_onay SET onay = ${onay} WHERE user_id = ${user_id} AND sartli_id = ${id} `)
        let ziyaretID = ziyaretInsertQuery.rows;



        res.status(200).json({ status: 200, data: ziyaretID });


    } catch (error) {

        res.status(500).json({ error: error });
    }
})
router.post('/sartliKabulSunulanAll', cors(), async (req, res) => {
    try {
        const { ziyaret_id, konu, aciklama } = req.body

        const files = req.files;
        const ziyaretInsertQuery = await pool.query(`select kmd.siparis_no,kms.id as id,
                                (SELECT sc.name FROM s_cari sc WHERE sc.id = kmz.cari_id) cari_name,
                kms.onay_aciklama,kms.urun_kodu,kms.sunulan,kms.gecen,kms.red,
                        (SELECT json_agg(users) 
                                     FROM (select * from km_sartli_onay
                                                                  WHERE sartli_id = kms.id)users)as users,
                        (SELECT json_agg(dokuman)
                                     FROM (select * from gk_dokuman
                                                                   where type = 4 AND kms.id = bagli_id)dokuman) as dokuman
                from km_sartli kms
                INNER JOIN km_denetim kmd ON kmd.id = kms.denetim_id 
                INNER JOIN km_ziyaret kmz ON kmz.id = kms.ziyaret_id`)
        let ziyaretID = ziyaretInsertQuery.rows;



        res.status(200).json({ status: 200, data: ziyaretID });


    } catch (error) {

        res.status(500).json({ error: error });
    }
})
router.post('/insertTedarikZiyaretNotlari', cors(), async (req, res) => {
    try {
        const { ziyaret_id, konu, aciklama } = req.body

        const files = req.files;
        const ziyaretInsertQuery = await pool.query(`INSERT INTO km_ziyaret_notlar( ziyaret_id, konu, aciklama) VALUES ( $1, $2, $3) RETURNING id`, [ziyaret_id, konu, aciklama])
        let ziyaretID = ziyaretInsertQuery.rows[0].id;



        res.status(200).json({ status: 200, data: ziyaretID });


    } catch (error) {

        res.status(500).json({ error: error });
    }
})

router.post('/getFirmaZiyaret', cors(), async (req, res) => {
    try {
        const sayfa = req.body.sayfa; // req.body üzerinden sayfa numarasını alın
        const sayfaNumarasi = parseInt(sayfa); // Sayfa numarasını integer'a çevirin

        // Eğer sayfaNumarasi 1 ise 0, sayfaNumarasi 2 ise 50, sayfaNumarasi 3 ise 100 olacak şekilde OFFSET değerini hesaplayın
        const goruntulenecek = (sayfaNumarasi - 1) * 50;

        const getFirmaZiyaretQuery = await pool.query(`SELECT *,(select name from s_cari where id = km_ziyaret.cari_id) as cari_name,
        (SELECT json_agg(projes) FROM (SELECT * FROM km_ziyaret_proje WHERE km_ziyaret.id = ziyaret_id) projes) as projes,
        (SELECT json_agg(users) FROM (SELECT * FROM km_ziyaret_users WHERE km_ziyaret.id = ziyaret_id) users) as users,
        (SELECT json_agg(nots) FROM (SELECT * FROM km_ziyaret_notlar WHERE km_ziyaret.id = ziyaret_id) nots) as notlar,
         (select json_agg(dokuman) FROM (SELECT gk_dokuman.*,km_denetim.id as denetim_id FROM gk_dokuman 
                                         INNER JOIN km_denetim ON km_ziyaret.id = km_denetim.ziyaret_id
                                         WHERE gk_dokuman.bagli_id = km_denetim.id AND gk_dokuman.type = 3) dokuman) as dokuman
        FROM km_ziyaret ORDER BY id OFFSET $1 LIMIT 50`,
            [goruntulenecek]
        );
        res.status(200).json({
            status: 200, data: getFirmaZiyaretQuery.rows
        })
    } catch (error) {
        res.status(500).json(error)
    }
})
router.get('/getTurStep', cors(), async (req, res) => {
    try {
        const id = req.body.id
        const getStep = await pool.query(`SELECT * FROM km_denetim_steps`)
        const getTur = await pool.query(`SELECT * FROM km_denetim_tur`)
        res.status(200).json({
            status: 200, step: getStep.rows, tur: getTur.rows
        })
    } catch (error) {
        res.status(500).json(error)
    }
})
router.get('/getFirmaZiyaretNotlar', cors(), async (req, res) => {
    try {
        const id = req.body.id
        const getFirmaZiyaretQuery = await pool.query(`SELECT * FROM km_ziyaret_notlar WHERE ziyaret_id = $1`, [id])
        res.status(200).json({
            status: 200, data: getFirmaZiyaretQuery.rows
        })
    } catch (error) {
        res.status(500).json(error)
    }
})
router.get('/getFirmaDenetimler', cors(), async (req, res) => {
    try {
        const veriSirasi = req.body.veriSirasi
        const getFirmaZiyaretQuery = await pool.query(`SELECT * FROM km_denetim ORDER BY id  OFFSET $1 LIMIT 50`, [veriSirasi])
        res.status(200).json({
            status: 200, data: getFirmaZiyaretQuery.rows
        })
    } catch (error) {
        res.status(500).json(error)
    }
})
router.post('/getSingelZiyaretDenetim', cors(), async (req, res) => {
    try {
        const { id } = req.body
        const veriSirasi = req.body.veriSirasi
        const getFirmaZiyaretQuery = await pool.query(`SELECT kmd.*,(select json_agg(dokuman) from (select kdsa.* from gk_dokuman kdsa
            Where kdsa.bagli_id=kmd.id and kdsa.type = 3)dokuman)as dokumanlar,(select json_agg(steps) from (select kds.* from km_denetim_stpes_app kdsa
            INNER JOIN km_denetim_steps kds ON kdsa.step_id = kds.id Where kdsa.denetim_id=kmd.id)steps)as step,
            (select json_agg(tur) from (select kds.* from km_denetim_tur_app kdsa
            INNER JOIN km_denetim_tur kds ON kdsa.tur_id = kds.id Where kdsa.denetim_id=kmd.id)tur)as tur FROM km_denetim kmd WHERE kmd.ziyaret_id = $2 ORDER BY kmd.id  OFFSET $1 LIMIT 50`, [veriSirasi, id])
        res.status(200).json({
            status: 200, data: getFirmaZiyaretQuery.rows
        })
    } catch (error) {
        res.status(500).json(error)
    }
})
router.get('/getFirmaDenetimlerDokuman', cors(), async (req, res) => {
    try {
        const veriSirasi = req.body.veriSirasi
        const getFirmaZiyaretQuery = await pool.query(`SELECT * FROM gk_dokuman WHERE type = 3 AND bagli_id = $1`, [bagli_id])
        res.status(200).json({
            status: 200, data: getFirmaZiyaretQuery.rows
        })
    } catch (error) {
        res.status(500).json(error)
    }
})

router.post('/cariIsimler', cors(), async (req, res) => {
    try {
        const cariGetir = await pool.query(`	SELECT name, MAX(id) AS id,tiger_kod
            FROM s_cari 
            GROUP BY name,tiger_kod`);
        res.status(200).json({
            status: 200,
            data: cariGetir.rows
        })
    } catch (error) {
        console.error(error)
        res.status(500).json(error)
    }
})


module.exports = router;
