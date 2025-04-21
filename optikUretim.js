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
const { start } = require('repl');
const { sql, poolPromise } = require('./mspoolKOKPIT'); // MSSQL yapılandırması
router.post("/kokpitDataBas", cors(), async (req, res) => {
    try {
        let production_dates = `2025-01-22`;

        const kokpitInserIslemi = await uretimGirisKokpit(production_dates)
        res.status(200).json({ data: kokpitInserIslemi });
    } catch (error) {


        res.status(500).json({ error: error });

    }
});

async function insertOrUpdateProductMachine(pool, id, product_id, part_type, operation_time, makina_kapasite) {
    const operasyonSuresiKontro = await pool.query(
        `SELECT * FROM m_product_machines WHERE machine_id= $1 AND product_id = $2 AND part_type=$3`,
        [id, product_id, part_type]
    );
    let operasyonID;
    if (operasyonSuresiKontro.rowCount < 1) {
        const yeniUrunMakinaQuery = await pool.query(
            `SELECT insertproductmachines($1, $2, $3, $4, $5) AS id`,
            [id, product_id, part_type, operation_time, makina_kapasite]
        );
        operasyonID = yeniUrunMakinaQuery.rows[0].id;
    } else {
        operasyonID = operasyonSuresiKontro.rows[0].id;
    }
    return operasyonID;
}
async function insertOrUpdateWorkOrder(pool, work_id, product_id, id, production_dates, planned_amount, realized_amount, part_type, operator_planed, operator_realized, tiger_isemri) {
    let work = work_id;
    if (!work_id) {
        const result = await pool.query(
            `SELECT insert_work_order($1, $2, $3, $4, $5, $6,$7,$8,$9,$10,$11) as id`,
            [product_id, id, production_dates, production_dates, 1, parseInt(planned_amount), realized_amount ? parseInt(realized_amount) : 0, part_type, parseInt(operator_planed), parseInt(operator_realized), tiger_isemri]
        );
        work = result.rows[0].id;
    } else {
        const yeniUrunQuery = await pool.query(`SELECT * FROM m_work_order WHERE id = $1 AND product_id = $2 AND status = 1`, [work, product_id]);
        if (yeniUrunQuery.rowCount > 0) {
            await pool.query(
                `UPDATE m_work_order SET realized_amount = realized_amount + $1, operator_realized = operator_realized + $3 WHERE id = $2`,
                [realized_amount ? parseInt(realized_amount) : 0, work, operator_realized]
            );
        } else {
            await pool.query(`UPDATE m_work_order SET status = 2 WHERE id = $1`, [work]);
            const result = await pool.query(
                `SELECT insert_work_order($1, $2, $3, $4, $5, $6,$7,$8,$9,$10,$11) as id`,
                [product_id, id, production_dates, production_dates, 1, parseInt(planned_amount), realized_amount ? parseInt(realized_amount) : 0, part_type, parseInt(operator_planed), parseInt(operator_realized), tiger_isemri]
            );
            work = result.rows[0].id;
        }
    }
    return work;
}
async function insertProduction(pool, product_id, id, realized_amount, production_dates, today, kalite_sunulan, kalite_red, operator, vardiya, work, rework, operator_realized, operasyonID, operator_name, operation_time, calisma_suresi, uretimTur) {
    return await pool.query(
        `SELECT insert_production_order ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19) as id`,
        [product_id, id, realized_amount ? parseInt(realized_amount) : 0, production_dates, production_dates, today, 1, kalite_sunulan, kalite_red, operator, vardiya, work, rework, operator_realized, operasyonID, operator_name, operation_time, calisma_suresi, uretimTur]
    );
}
async function insertUygunsuzluk(pool, uygunsuz, work, started_date, finish_date) {
    const { uygunsuz_id, machine_id, product_id, miktar } = uygunsuz;
    return await pool.query(
        `INSERT INTO m_uygunsuzluk (uygunsuz_id, machine_id, product_id, work_id, started_date, finish_date, miktar)
        VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [uygunsuz_id, machine_id, product_id, work, started_date, finish_date, miktar]
    );
}
async function insertDurus(pool, durus, work, started_date, finish_date) {
    const { durus_id, machine_id, product_id, duration_time } = durus;
    return await pool.query(
        `INSERT INTO m_durus (durus_id, machine_id, product_id, work_id, started_date, finish_date, duration_time)
        VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [durus_id, machine_id, product_id, work, started_date, finish_date, duration_time]
    );
}
router.post('/uretimEmriGiris', cors(), async (req, res) => {
    try {
        const data = req.body;
        fs.appendFileSync('log.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('log.txt', `Uretim Siparis :  ${JSON.stringify(req.body)}\n`);
        fs.appendFileSync('log.txt', `istekApi /uretimEmriGiris\n`);
        let today = new Date();
        let production_dates = `${data.production_date.year}-${data.production_date.month}-${data.production_date.day}`;
        const started_date = new Date().toISOString();

        // Her bir data elemanını işlemek için
        data.data.forEach(async element => {
            const { product_id, id, realized_amount, kalite_sunulan, operator_production, calisma_suresi, tiger_isemri, kalite_red, operator, operator_name, vardiya, planned_amount, uretimTur, work_id, part_type, operation_time, rework, makina_kapasite, operator_planed, operator_realized } = element;

            const operasyonID = await insertOrUpdateProductMachine(pool, id, product_id, part_type, operation_time, makina_kapasite);
            const work = await insertOrUpdateWorkOrder(pool, work_id, product_id, id, production_dates, planned_amount, realized_amount, part_type, operator_planed, operator_realized, tiger_isemri);
            const productionResult = await insertProduction(pool, product_id, id, realized_amount, production_dates, today, kalite_sunulan, kalite_red, operator, vardiya, work, rework, operator_realized, operasyonID, operator_name, operation_time, calisma_suresi, uretimTur);

            if (element.uygunsuz) {
                element.uygunsuz.forEach(async uygunsuz => {
                    await insertUygunsuzluk(pool, uygunsuz, work, started_date, new Date().toISOString());
                });
            }

            if (element.duruslar) {
                element.duruslar.forEach(async durus => {
                    await insertDurus(pool, durus, work, started_date, new Date().toISOString());
                });
            }
        });
        const kokpitInserIslemi = await uretimGirisKokpit(production_dates)
        res.status(200).json({ status: 200, data });
    } catch (error) {

        res.status(500).json({ error: error });

    }
});
router.post('/makinaDurusGiris', cors(), async (req, res) => {
    try {
        // Log işlemleri
        fs.appendFileSync('log.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('log.txt', `Üretim Sipariş :  ${JSON.stringify(req.body)}\n`);
        fs.appendFileSync('log.txt', `istekApi /makinaDurusGiris\n`);

        // req.body'den gelen değerleri alalım
        const {
            durus_id,
            durus_name,
            durus_sure,
            machine_id,
            machine_kod,
            operasyon_time,
            operator_id,
            operator_name,
            product_id,
            production,
            production_date,
            uretim_turu, vardiya
        } = req.body;

        // production_date formatlanması
        let production_dates = `${production_date.year}-${production_date.month}-${production_date.day}`;
        let today = new Date();
        const started_date = today.toISOString(); // started_date için bugünün tarihi alınıyor

        // İş emri ekleme işlemi

        const work = await insertOrUpdateWorkOrder(pool, null, product_id, machine_id, production_dates, 0, 0, null, 0, 0, 0);

        // Vardiya değişkenini eklemelisiniz, örnek:

        // Üretim verisi ekleme işlemi
        const productionResult = await insertProduction(pool, product_id, machine_id, 0, production_dates, today, 0, 0, operator_id, vardiya, work, 0, 0, null, operator_name, 0, 420, null);
        let durus = {
            durus_id: durus_id, machine_id: machine_id, product_id: product_id, duration_time: durus_sure
        }
        // Duruş verisi ekleme işlemi
        await insertDurus(pool, durus, work, production_dates, started_date);

        // Başarılı yanıt
        res.json({
            status: 200,
            data: "Kaydedildi"
        });

    } catch (error) {
        console.error("Hata oluştu:", error);
        res.status(500).json({ status: 400, error: error.message });
    }
});
function getWeekdaysCount(startDate, endDate) {
    // Tarihleri Date nesnesine dönüştür
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Başlangıç tarihi bitiş tarihinden büyükse 0 döndür
    if (start > end) return 0;

    let count = 0;

    // Tarihleri döngüyle artırarak hafta içi günlerini kontrol et
    while (start <= end) {
        const day = start.getDay(); // 0 = Pazar, 1 = Pazartesi, ..., 6 = Cumartesi
        if (day !== 0 && day !== 6) { // 0 ve 6 dışındaki günler hafta içidir
            count++;
        }
        start.setDate(start.getDate() + 1); // Bir sonraki güne geç
    }

    return count;
}
router.post('/genelOeeRapor', cors(), async (req, res) => {
    try {
        // Log işlemleri
        fs.appendFileSync('log.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('log.txt', `Üretim Sipariş :  ${JSON.stringify(req.body)}\n`);
        fs.appendFileSync('log.txt', `istekApi /genelOeeRapor\n`);

        // req.body'den gelen değerleri alalım
        const {
            startDate,
            endDate,
            birim
        } = req.body;
        let gunCarp = getWeekdaysCount(startDate, endDate)
        console.log(gunCarp)
        const oeeHesap = await pool.query(`SELECT name,
                                                        hat_id,
                                                        SUM(MACHINA_COUNT) AS MACHINA_COUNT,
                                                        SUM(RUN_TIME) AS RUN_TIME,
                                                        SUM(REEL_TIME) AS REEL_TIME,
                                                        SUM(RUN_REEL_TIME) AS RUN_REEL_TIME,
                                                        SUM(FIRE_TIME) AS FIRE_TIME,
                                                        SUM(planli_durus) AS PLANLI_DURUS,
                                                        SUM(plansiz_durus) AS PLANSIZ_DURUS
                                                    FROM (
                                                        -- İlk sorgudan gelen veri
                                                        SELECT 
                                                            muh.name,
                                                            muh.id AS hat_id,
                                                            COUNT(DISTINCT mm.id) AS MACHINA_COUNT,
                                                            SUM(mp.calisma_suresi) AS RUN_TIME,
                                                            ($4 * 17 * 60) * COUNT(DISTINCT mm.id) AS REEL_TIME,
                                                            SUM(mp.operasyon_time * (mp.production)/(Select makina_kapasite FROM m_product_machines mpm WHERE mpm.id=mp.operasyon_id)) AS RUN_REEL_TIME,
                                                            SUM(mp.operasyon_time * ((mp.rework + mp.red_quailty)/(Select makina_kapasite FROM m_product_machines mpm WHERE mpm.id=mp.operasyon_id))) AS FIRE_TIME,
                                                            45*$4* COUNT(DISTINCT mm.id) AS planli_durus,
                                                            0 AS plansiz_durus
                                                        FROM 
                                                            main_machines mm
                                                        INNER JOIN 
                                                            m_production mp 
                                                            ON mp.machine_id = mm.id 
                                                            AND mp.production_date BETWEEN $1 AND $2
                                                        INNER JOIN 
                                                            machine_uretim_hat muh 
                                                            ON muh.uretim_hat = $3
                                                            AND muh.id = mm.hat_id
                                                        WHERE 
                                                            mm.cihaz_type = 0
                                                        GROUP BY 
                                                            muh.id, muh.name
                                                        
                                                        UNION ALL

                                                        -- İkinci sorgudan gelen veri
                                                        SELECT 
                                                            muh.name,
                                                            muh.id AS hat_id,
                                                            0 AS MACHINA_COUNT,
                                                            0 AS RUN_TIME,
                                                            0 AS REEL_TIME,
                                                            0 AS RUN_REEL_TIME,
                                                            0 AS FIRE_TIME,
                                                            0 AS planli_durus,
                                                            SUM(md.duration_time) AS plansiz_durus
                                                        FROM 
                                                            main_machines mm
                                                        INNER JOIN 
                                                            m_durus md 
                                                            ON md.machine_id = mm.id 
                                                            AND md.started_date BETWEEN $1 AND $2
                                                        INNER JOIN 
                                                            machine_uretim_hat muh 
                                                            ON muh.uretim_hat = $3 
                                                            AND muh.id = mm.hat_id
                                                        WHERE 
                                                            mm.cihaz_type = 0
                                                        GROUP BY 
                                                            muh.id, muh.name
                                                    ) AS combined_data
                                                    GROUP BY 
                                                        name, hat_id
                                                    ORDER BY 
                                                        hat_id;`, [startDate, endDate, birim, gunCarp])
        const oeeHesapGENEL = await pool.query(`
				SELECT 'GENEL' as genel,   SUM(MACHINA_COUNT) AS MACHINA_COUNT,
                                                        SUM(RUN_TIME) AS RUN_TIME,
                                                        SUM(REEL_TIME) AS REEL_TIME,
                                                        SUM(RUN_REEL_TIME) AS RUN_REEL_TIME,
                                                        SUM(FIRE_TIME) AS FIRE_TIME,
                                                        SUM(planli_durus) AS PLANLI_DURUS,
                                                        SUM(plansiz_durus) AS PLANSIZ_DURUS
														FROM(
												    SELECT name,
                                                        hat_id,
                                                        SUM(MACHINA_COUNT) AS MACHINA_COUNT,
                                                        SUM(RUN_TIME) AS RUN_TIME,
                                                        SUM(REEL_TIME) AS REEL_TIME,
                                                        SUM(RUN_REEL_TIME) AS RUN_REEL_TIME,
                                                        SUM(FIRE_TIME) AS FIRE_TIME,
                                                        SUM(planli_durus) AS PLANLI_DURUS,
                                                        SUM(plansiz_durus) AS PLANSIZ_DURUS
                                                    FROM (
                                                        -- İlk sorgudan gelen veri
                                                        SELECT 
                                                            muh.name,
                                                            muh.id AS hat_id,
                                                            COUNT(DISTINCT mm.id) AS MACHINA_COUNT,
                                                            SUM(mp.calisma_suresi) AS RUN_TIME,
                                                            ($4 * 17 * 60) * COUNT(DISTINCT mm.id) AS REEL_TIME,
                                                            SUM(mp.operasyon_time * (mp.production)/(Select makina_kapasite FROM m_product_machines mpm WHERE mpm.id=mp.operasyon_id)) AS RUN_REEL_TIME,
                                                            SUM(mp.operasyon_time * ((mp.rework + mp.red_quailty)/(Select makina_kapasite FROM m_product_machines mpm WHERE mpm.id=mp.operasyon_id))) AS FIRE_TIME,
                                                            45*$4* COUNT(DISTINCT mm.id) AS planli_durus,
                                                            0 AS plansiz_durus
                                                        FROM 
                                                            main_machines mm
                                                        INNER JOIN 
                                                            m_production mp 
                                                            ON mp.machine_id = mm.id 
                                                            AND mp.production_date BETWEEN $1 AND $2
                                                        INNER JOIN 
                                                            machine_uretim_hat muh 
                                                            ON muh.uretim_hat =  $3
                                                            AND muh.id = mm.hat_id
                                                        WHERE 
                                                            mm.cihaz_type = 0
                                                        GROUP BY 
                                                            muh.id, muh.name
                                                        
                                                        UNION ALL

                                                        -- İkinci sorgudan gelen veri
                                                        SELECT 
                                                            muh.name,
                                                            muh.id AS hat_id,
                                                            0 AS MACHINA_COUNT,
                                                            0 AS RUN_TIME,
                                                            0 AS REEL_TIME,
                                                            0 AS RUN_REEL_TIME,
                                                            0 AS FIRE_TIME,
                                                            0 AS planli_durus,
                                                            SUM(md.duration_time) AS plansiz_durus
                                                        FROM 
                                                            main_machines mm
                                                        INNER JOIN 
                                                            m_durus md 
                                                            ON md.machine_id = mm.id 
                                                            AND md.started_date BETWEEN $1 AND $2
                                                        INNER JOIN 
                                                            machine_uretim_hat muh 
                                                            ON muh.uretim_hat = $3
                                                            AND muh.id = mm.hat_id
                                                        WHERE 
                                                            mm.cihaz_type = 0
                                                        GROUP BY 
                                                            muh.id, muh.name
                                                    ) AS combined_data
                                                    GROUP BY 
                                                        name, hat_id
                                                    ORDER BY 
                                                        hat_id
														)  AS combined_data
															`, [startDate, endDate, birim, gunCarp])
        res.json({
            status: 200,
            data: oeeHesap.rows,
            genel:oeeHesapGENEL.rows[0]
        });

    } catch (error) {
        console.error("Hata oluştu:", error);
        res.status(500).json({ status: 400, error: error.message });
    }
});
router.post('/genelOeeHatRapor', cors(), async (req, res) => {
    try {
        // Log işlemleri
        fs.appendFileSync('log.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('log.txt', `Üretim Sipariş :  ${JSON.stringify(req.body)}\n`);
        fs.appendFileSync('log.txt', `istekApi /genelOeeRapor\n`);

        // req.body'den gelen değerleri alalım
        const {
            startDate,
            endDate,
            birim
        } = req.body;
        let gunCarp = getWeekdaysCount(startDate, endDate)
        const oeeHesap = await pool.query(`SELECT machines_name as name,
                                                    
                                                        SUM(MACHINA_COUNT) AS MACHINA_COUNT,
                                                        SUM(RUN_TIME) AS RUN_TIME,
                                                        SUM(REEL_TIME) AS REEL_TIME,
                                                        SUM(RUN_REEL_TIME) AS RUN_REEL_TIME,
                                                        SUM(FIRE_TIME) AS FIRE_TIME,
                                                        SUM(planli_durus) AS PLANLI_DURUS,
                                                        SUM(plansiz_durus) AS PLANSIZ_DURUS
                                                    FROM (
                                                        SELECT 
                                                            mm.machines_name,
                                                            
                                                            COUNT(DISTINCT mm.id) AS MACHINA_COUNT,
                                                            SUM(mp.calisma_suresi) AS RUN_TIME,
                                                            ($4 * 17 * 60) * COUNT(DISTINCT mm.id) AS REEL_TIME,
                                                            SUM(mp.operasyon_time * (mp.production)/(Select makina_kapasite FROM m_product_machines mpm WHERE mpm.id=mp.operasyon_id)) AS RUN_REEL_TIME,
                                                            SUM(mp.operasyon_time * ((mp.rework + mp.red_quailty)/(Select makina_kapasite FROM m_product_machines mpm WHERE mpm.id=mp.operasyon_id))) AS FIRE_TIME,
                                                            45*$4 AS planli_durus,
                                                            0 AS plansiz_durus
                                                        FROM 
                                                            main_machines mm
                                                        INNER JOIN 
                                                            m_production mp 
                                                            ON mp.machine_id = mm.id 
                                                            AND mp.production_date BETWEEN $1 AND $2
                                                        INNER JOIN 
                                                            machine_uretim_hat muh 
                                                            ON muh.uretim_hat = 2
                                                            AND muh.id = mm.hat_id AND  muh.id=$3
                                                        WHERE 
                                                            mm.cihaz_type = 0
															
                                                        GROUP BY 
                                                           mm.machines_name
                                                            UNION ALL
                                                 
                                                     SELECT 
                                                             mm.machines_name,
                                                            0 AS MACHINA_COUNT,
                                                            0 AS RUN_TIME,
                                                            0 AS REEL_TIME,
                                                            0 AS RUN_REEL_TIME,
                                                            0 AS FIRE_TIME,
                                                            0 AS planli_durus,
                                                            SUM(md.duration_time) AS plansiz_durus
                                                        FROM 
                                                            main_machines mm
                                                        INNER JOIN 
                                                            m_durus md 
                                                            ON md.machine_id = mm.id 
                                                            AND md.started_date BETWEEN $1 AND $2
                                                        INNER JOIN 
                                                            machine_uretim_hat muh 
                                                            ON muh.uretim_hat = 2 
                                                            AND muh.id = mm.hat_id
															AND  muh.id=$3
                                                        WHERE 
                                                            mm.cihaz_type = 0
                                                        GROUP BY 
                                                             mm.machines_name)	 AS combined_data
                                                    GROUP BY 
                                                         machines_name
                                                    ORDER BY 
                                                        machines_name;`, [startDate, endDate, birim, gunCarp])

        res.json({
            status: 200,
            data: oeeHesap.rows
        });

    } catch (error) {
        console.error("Hata oluştu:", error);
        res.status(500).json({ status: 400, error: error.message });
    }
});

router.post('/postUretimSiparis', cors(), async (req, res) => {
    try {
        const { siparis_tarihi, siparis_kod, urun_kod, urun_aciklama, user_id,
            user_name, siparis_miktar, sevk_miktar, acik_siparis, is_deleted, is_active, created_date, updated_date, sevk_tarih, tur_name, tur_id, status, cari_kod, cari_name, oncelik } = req.body
        fs.appendFileSync('log.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('log.txt', `Uretim Siparis :  ${JSON.stringify(req.body)}\n`);
        fs.appendFileSync('log.txt', `istekApi /postUretimSiparis\n`);

        let today = new Date().toISOString()

        const result = await pool.query(`INSERT INTO public.m_uretim_siparis(
                                            siparis_tarihi, siparis_kod, urun_kod, urun_aciklama,  siparis_miktar, 
                                            sevk_miktar, acik_siparis, is_deleted, is_active, created_date, 
                                            updated_date, sevk_tarih, tur_name, tur_id, status, cari_kod, cari_name,oncelik)
                                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,$18) Returning *`,
            [
                siparis_tarihi,
                siparis_kod,
                urun_kod,
                urun_aciklama,
                siparis_miktar,
                sevk_miktar,
                acik_siparis,
                is_deleted,
                is_active,
                today,
                today,
                sevk_tarih,
                tur_name,
                tur_id,
                status,
                cari_kod,
                cari_name,
                oncelik
            ]);
        const data = result.rows;

        let degisiklik = `${data.siparis_kod} Sipariş numarası eklenmiştir.`
        let tur = 0 // update 1 
        const userInsert = await pool.query(`INSERT INTO public.m_uretim_user_log(
	user_id, user_name, siparis_id, degisiklik, created_date,tur)
	VALUES ($1, $2, $3, $4, $5,$6)`,
            [user_id, user_name, data[0].id, degisiklik, created_date, tur]);
        const userData = userInsert.rows;
        res.status(200).json({ status: 200, data: data });
        fs.appendFileSync('logResponse.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `istekApi /postUretimSiparis\n`);
        fs.appendFileSync('logResponse.txt', `Response sent at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `Data: ${JSON.stringify(data)}\n`);
        fs.appendFileSync('logResponse.txt', `**************************************************************\n`);
    } catch (error) {
        fs.appendFileSync('logError.txt', `Error occurred at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logError.txt', `Error: ${error}\n`);
        res.status(500).json({ error: error });

    }
})
router.post('/putUretimSiparis', cors(), async (req, res) => {
    try {
        const { id, siparis_tarihi, siparis_kod, urun_kod, urun_aciklama, user_id,
            user_name, siparis_miktar, sevk_miktar, acik_siparis, is_deleted, is_active, created_date, updated_date, sevk_tarih, tur_name, tur_id, status, cari_kod, cari_name, oncelik, is_print } = req.body
        fs.appendFileSync('log.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('log.txt', `Uretim Siparis :  ${JSON.stringify(req.body)}\n`);
        fs.appendFileSync('log.txt', `istekApi /putUretimSiparis\n`);

        const onceki = await pool.query(`SELECT * FROM m_uretim_siparis WHERE id = $1`, [id])
        let today = new Date().toISOString()

        const result = await pool.query(`UPDATE m_uretim_siparis
	SET siparis_tarihi=$1, siparis_kod=$2, urun_kod=$3, urun_aciklama=$4, siparis_miktar=$6, sevk_miktar=$7, acik_siparis=$8, is_deleted=$9, 
    is_active=$10, updated_date=$12, sevk_tarih=$13, tur_name=$14, tur_id=$15, status=$16, cari_kod=$17, cari_name=$18, oncelik=$11,is_print=$19,print_date =$20
	WHERE id=$5`,
            [
                siparis_tarihi,
                siparis_kod,
                urun_kod,
                urun_aciklama,
                id,
                siparis_miktar,
                sevk_miktar,
                acik_siparis,
                is_deleted,
                is_active,
                oncelik,
                today,
                sevk_tarih,
                tur_name,
                tur_id,
                status,
                cari_kod,
                cari_name,
                is_print,
                today
            ]);
        const data = result.rows;

        let degisiklik = `${data.siparis_kod} Sipariş numarası Güncellendi.${onceki.rows[0]}`
        let tur = 1 // insert 0 
        const userInsert = await pool.query(`INSERT INTO public.m_uretim_user_log(
	user_id, user_name, siparis_id, degisiklik, created_date,tur)
	VALUES ($1, $2, $3, $4, $5,$6)`,
            [user_id, user_name, id, degisiklik, created_date, tur]);
        const userData = userInsert.rows;
        res.status(200).json({ status: 200, data: data });
        fs.appendFileSync('logResponse.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `istekApi /putUretimSiparis\n`);
        fs.appendFileSync('logResponse.txt', `Response sent at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `Data: ${JSON.stringify(data)}\n`);
        fs.appendFileSync('logResponse.txt', `**************************************************************\n`);
    } catch (error) {

        fs.appendFileSync('logError.txt', `Error occurred at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logError.txt', `Error: ${error}\n`);
        res.status(500).json({ error: error });

    }
})
router.post('/postAciklamaUretim', cors(), async (req, res) => {
    try {

        const { user_id, user_name, siparis_id, aciklama } = req.body
        fs.appendFileSync('log.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('log.txt', `Uretim Siparis :  ${JSON.stringify(req.body)}\n`);
        fs.appendFileSync('log.txt', `istekApi /postAciklamaUretim\n`);

        const onceki = await pool.query(`INSERT INTO m_uretim_aciklama(
	user_id, user_name, siparis_id, aciklama)
	VALUES ($1, $2, $3, $4)`, [user_id, user_name, siparis_id, aciklama])
        const data = onceki.rows;

        res.status(200).json({ status: 200, data: data });
        fs.appendFileSync('logResponse.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `istekApi /postAciklamaUretim\n`);
        fs.appendFileSync('logResponse.txt', `Response sent at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `Data: ${JSON.stringify(data)}\n`);
        fs.appendFileSync('logResponse.txt', `**************************************************************\n`);
    } catch (error) {


        fs.appendFileSync('logError.txt', `Error occurred at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logError.txt', `Error: ${error}\n`);
        res.status(500).json({ error: error });

    }
})
router.post('/getUretimSiparisPrint', cors(), async (req, res) => {
    try {

        fs.appendFileSync('log.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('log.txt', `Uretim Siparis 2 :  ${JSON.stringify(req.body)}\n`);
        fs.appendFileSync('log.txt', `istekApi2 /getUretimSiparisPrint\n`);
        const { birim_id, baslangic, bitis, sirala } = req.body
        let orderBy = ""
        if (sirala == '') {

        } else {
            orderBy = 'ORDER BY'
        }
        let query = `SELECT * FROM(SELECT *
                                            FROM (
                                                SELECT mus.*
                                                    
                                                    
                                                FROM m_uretim_siparis mus
                                                WHERE mus.tur_id = ${birim_id} AND mus.is_print = true AND print_date between '${baslangic}' and '${bitis}'
                                                ORDER by  mus.status,
                                                        CASE 
                                                            WHEN mus.oncelik IS NULL THEN 1 
                                                            ELSE 0 
                                                        END,
                                                        mus.oncelik DESC
                                            ) as sorted_data
                                            ${orderBy} ${sirala}
                                            ) as limit_data `
        const onceki = await pool.query(query)
        const data = onceki.rows;

        res.status(200).json({ status: 200, data: data });
        fs.appendFileSync('logResponse.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `istekApi /getUretimSiparisPrint\n`);
        fs.appendFileSync('logResponse.txt', `Response sent at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `Data: ${JSON.stringify(data)}\n`);
        fs.appendFileSync('logResponse.txt', `**************************************************************\n`);
    } catch (error) {

        fs.appendFileSync('logError.txt', `Error occurred at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logError.txt', `Error: ${error}\n`);
        res.status(500).json({ error: error });

    }
})
router.post('/getYetkiList', cors(), async (req, res) => {
    try {

        fs.appendFileSync('log.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('log.txt', `Uretim Siparis 2 :  ${JSON.stringify(req.body)}\n`);
        fs.appendFileSync('log.txt', `istekApi2 /getYetkiList\n`);

        const { baslangic, bitis } = req.body

        let query = `SELECT id as type , yetki_yeri as name FROM gk_yetki_list`;

        const onceki = await pool.query(query);

        const data = onceki.rows;

        res.status(200).json({ status: 200, data: data });
        fs.appendFileSync('logResponse.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `istekApi /getYetkiList\n`);
        fs.appendFileSync('logResponse.txt', `Response sent at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `Data: ${JSON.stringify(data)}\n`);
        fs.appendFileSync('logResponse.txt', `**************************************************************\n`);
    } catch (error) {
        fs.appendFileSync('logError.txt', `Error occurred at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logError.txt', `Error: ${error}\n`);
        res.status(500).json({ error: error });

    }
})
router.post('/getSevkRaporAyBazli', cors(), async (req, res) => {
    try {

        fs.appendFileSync('log.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('log.txt', `Uretim Siparis 2 :  ${JSON.stringify(req.body)}\n`);
        fs.appendFileSync('log.txt', `istekApi2 /getSevkRapor\n`);

        const { baslangic, bitis } = req.body

        let query = `SELECT 
    DATE_TRUNC('month', sevk_tarih) AS ay,  
    SUM(miktar) AS toplam_miktar          
FROM 
    public.m_uretim_sevk_iptal
WHERE 
    is_deleted = false                     
GROUP BY 
    DATE_TRUNC('month', sevk_tarih)       
ORDER BY 
    ay `;

        const onceki = await pool.query(query);

        const data = onceki.rows;

        res.status(200).json({ status: 200, data: data });
        fs.appendFileSync('logResponse.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `istekApi /getSevkRapor\n`);
        fs.appendFileSync('logResponse.txt', `Response sent at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `Data: ${JSON.stringify(data)}\n`);
        fs.appendFileSync('logResponse.txt', `**************************************************************\n`);
    } catch (error) {
        fs.appendFileSync('logError.txt', `Error occurred at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logError.txt', `Error: ${error}\n`);
        res.status(500).json({ error: error });

    }
})
router.post('/getSevkRapor', cors(), async (req, res) => {
    try {

        fs.appendFileSync('log.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('log.txt', `Uretim Siparis 2 :  ${JSON.stringify(req.body)}\n`);
        fs.appendFileSync('log.txt', `istekApi2 /getSevkRapor\n`);

        const { baslangic, bitis } = req.body

        let query = `SELECT 
SUM(miktar) as miktar,urun_kod,
MAX(sevk_tarih) as sevk_tarihi,
	(SELECT sevk_tarih FROM m_uretim_siparis WHERE siparis_id = id) as siparis_sevk_tarihi,
	(SELECT siparis_kod FROM m_uretim_siparis WHERE siparis_id = id) as siparis_no,
	(SELECT acik_siparis FROM m_uretim_siparis WHERE siparis_id = id),
	(SELECT siparis_miktar FROM m_uretim_siparis WHERE siparis_id = id),
    (MAX(sevk_tarih) - (SELECT sevk_tarih FROM m_uretim_siparis WHERE siparis_id = id))::int AS tarih_farki_gun
from m_uretim_sevk_iptal WHERE sevk_tarih between $1 AND $2
GROUP BY siparis_id , urun_kod `;

        const onceki = await pool.query(query, [baslangic, bitis]);

        const data = onceki.rows;

        res.status(200).json({ status: 200, data: data });
        fs.appendFileSync('logResponse.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `istekApi /getSevkRapor\n`);
        fs.appendFileSync('logResponse.txt', `Response sent at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `Data: ${JSON.stringify(data)}\n`);
        fs.appendFileSync('logResponse.txt', `**************************************************************\n`);
    } catch (error) {

        fs.appendFileSync('logError.txt', `Error occurred at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logError.txt', `Error: ${error}\n`);
        res.status(500).json({ error: error });

    }
})
router.post('/getUretimSiparis2', cors(), async (req, res) => {
    try {

        fs.appendFileSync('log.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('log.txt', `Uretim Siparis 2 :  ${JSON.stringify(req.body)}\n`);
        fs.appendFileSync('log.txt', `istekApi2 /getUretimSiparis2\n`);

        const { birim_id, limit, ofset, sirala, search } = req.body
        let orderBy = ""
        if (sirala == '') {

        } else {
            orderBy = 'ORDER BY'
        }
        let query = `SELECT * FROM (
            SELECT mus.*,
                (SELECT json_agg(sevk) 
                    FROM (SELECT * 
                            FROM m_uretim_sevk_iptal 
                            WHERE siparis_id = mus.id) sevk) as sevk,
                (SELECT json_agg(acik) 
                    FROM (SELECT mua.* 
                            FROM m_uretim_aciklama mua 
                            WHERE mua.siparis_id = mus.id 
                            ORDER BY id DESC) acik) as aciklama,  
                (SELECT json_agg(detay) 
                    FROM (SELECT muts.*, 
                                (SELECT json_agg(detay_alt) 
                                FROM (SELECT muet.* 
                                        FROM m_uretim_eksik_takip muet 
                                        WHERE muet.siparis_id = mus.id 
                                        AND muts.id = muet.satir_id) detay_alt) 
                            detay_alt 
                        FROM m_uretim_takip_satir muts 
                        WHERE muts.siparis_id = mus.id) detay) as detay
            FROM m_uretim_siparis mus
            WHERE mus.tur_id = $1
                AND ($2 = '' OR mus.urun_kod LIKE '%' || $2 || '%' OR mus.urun_aciklama LIKE '%' || $2 || '%' OR mus.siparis_kod LIKE '%' || $2 || '%')
            ORDER BY mus.status,
                CASE 
                    WHEN mus.oncelik IS NULL THEN 1 
                    ELSE 0 
                END,
                mus.oncelik DESC
        ) as sorted_data
        ${orderBy} ${sirala}
        LIMIT $3 OFFSET $4`;

        const onceki = await pool.query(query, [birim_id, search, limit, ofset]);
        const totalQuery = await pool.query(`SELECT count(id) FROM m_uretim_siparis mus  WHERE mus.tur_id = $1`, [birim_id])
        const data = onceki.rows;

        res.status(200).json({ status: 200, data: data, total: totalQuery.rows[0].count });
        fs.appendFileSync('logResponse.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `istekApi /getUretimSiparis2\n`);
        fs.appendFileSync('logResponse.txt', `Response sent at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `Data: ${JSON.stringify(data)}\n`);
        fs.appendFileSync('logResponse.txt', `**************************************************************\n`);
    } catch (error) {

        fs.appendFileSync('logError.txt', `Error occurred at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logError.txt', `Error: ${error}\n`);
        res.status(500).json({ error: error });

    }
})
router.post('/getUretimSiparis', cors(), async (req, res) => {
    try {

        fs.appendFileSync('log.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('log.txt', `Uretim Siparis :  ${JSON.stringify(req.body)}\n`);
        fs.appendFileSync('log.txt', `istekApi /getUretimSiparis\n`);
        const birim_id = req.body.birim_id
        const onceki = await pool.query(`SELECT mus.*,
		(SELECT json_agg(sevk) FROM(SELECT * FROM m_uretim_sevk_iptal WHERE siparis_id = mus.id) sevk)as sevk,
        (SELECT json_agg(acik) FROM (SELECT mua.* FROM m_uretim_aciklama mua WHERE mua.siparis_id = mus.id order by id desc)acik) as aciklama,
        (SELECT json_agg(detay) FROM( SELECT muts.*,
									 (select json_agg(detay_alt) FROM  (SELECT muet.* FROM m_uretim_eksik_takip muet WHERE muet.siparis_id = mus.id and muts.id = muet.satir_id) detay_alt) detay_alt
									 FROM m_uretim_takip_satir muts WHERE muts.siparis_id = mus.id) detay) as detay 
		
		FROM m_uretim_siparis mus  WHERE mus.tur_id = $1
        ORDER BY mus.status , mus.acik_siparis desc,
        CASE 
        WHEN mus.oncelik IS NULL THEN 1 
        ELSE 0 
        END,
        mus.oncelik DESC`, [birim_id])
        const data = onceki.rows;

        res.status(200).json({ status: 200, data: data });
        fs.appendFileSync('logResponse.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `istekApi /getUretimSiparis\n`);
        fs.appendFileSync('logResponse.txt', `Response sent at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `Data: ${JSON.stringify(data)}\n`);
        fs.appendFileSync('logResponse.txt', `**************************************************************\n`);
    } catch (error) {


        fs.appendFileSync('logError.txt', `Error occurred at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logError.txt', `Error: ${error}\n`);
        res.status(500).json({ error: error });

    }
})
router.post('/putUretimSiparisTakip', cors(), async (req, res) => {
    try {

        fs.appendFileSync('log.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('log.txt', `Uretim Siparis :  ${JSON.stringify(req.body)}\n`);
        fs.appendFileSync('log.txt', `istekApi /putUretimSiparisTakip\n`);
        const { siparis_id, talep_no, type, is_deleted, is_active, status, created_date, temin_tarihi, satir_id, uretim_miktari } = req.body
        let today = new Date()
        let data, id
        const satirIDQuery = await pool.query(`SELECT * FROM m_uretim_takip_satir WHERE siparis_id = ${siparis_id}`)

        let satirID

        if (satirIDQuery.rowCount > 0) {
            satirID = satirIDQuery.rows[0].id
        } else {
            const inserSqlSatir = await pool.query(`INSERT INTO public.m_uretim_takip_satir(
 siparis_id)
	VALUES ($1) RETURNING *`, [siparis_id])
            satirID = inserSqlSatir.rows[0].id
        }

        const talepTypeVarmi = await pool.query(`SELECT * FROM m_uretim_eksik_takip WHERE siparis_id = $1 AND type = $2 AND satir_id = $3`, [siparis_id, type, satirID])
        if (talepTypeVarmi.rowCount > 0) {

            id = talepTypeVarmi.rows[0].id
            if (id) {

                const onceki = await pool.query(`UPDATE m_uretim_eksik_takip
        SET siparis_id=$2, talep_no=$3, type=$4, is_deleted=$5, is_active=$6, status=$7, created_date=$8, updated_date=$9, temin_tarihi=$10,satir_id = $11,uretim_miktari=$12
        WHERE id = $1`, [id, siparis_id, talep_no, type, is_deleted, is_active, status, created_date, today, temin_tarihi, satirID, uretim_miktari])
                data = onceki.rows;

            } else {
                const onceki = await pool.query(`INSERT INTO m_uretim_eksik_takip(
        siparis_id, talep_no, type, is_deleted, is_active, status, created_date, updated_date, temin_tarihi,satir_id,uretim_miktari)
        VALUES ( $1, $2, $3, $4, $5, $6, $7, $8, $9,$10,$11)`, [siparis_id, talep_no, type, is_deleted, is_active, status, created_date, today, temin_tarihi, satirID, uretim_miktari])
                data = onceki.rows;
            }
        } else {
            const onceki = await pool.query(`INSERT INTO m_uretim_eksik_takip(
    siparis_id, talep_no, type, is_deleted, is_active, status, created_date, updated_date, temin_tarihi,satir_id,uretim_miktari)
    VALUES ( $1, $2, $3, $4, $5, $6, $7, $8, $9,$10,$11)`, [siparis_id, talep_no, type, is_deleted, is_active, status, created_date, today, temin_tarihi, satirID, uretim_miktari])
            data = onceki.rows;
        }


        res.status(200).json({ status: 200, data: data });
        fs.appendFileSync('logResponse.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `istekApi /putUretimSiparisTakip\n`);
        fs.appendFileSync('logResponse.txt', `Response sent at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `Data: ${JSON.stringify(data)}\n`);
        fs.appendFileSync('logResponse.txt', `**************************************************************\n`);
    } catch (error) {


        fs.appendFileSync('logError.txt', `Error occurred at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logError.txt', `Error: ${error}\n`);
        res.status(500).json({ error: error });
    }
})
router.post('/getCariSiparis', cors(), async (req, res) => {
    try {

        fs.appendFileSync('log.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('log.txt', `Uretim Siparis :  ${JSON.stringify(req.body)}\n`);
        fs.appendFileSync('log.txt', `istekApi /getCariSiparis\n`);

        const onceki = await pool.query(`SELECT DISTINCT musteri
FROM p_siparisler
ORDER BY musteri DESC; `)
        const data = onceki.rows;

        res.status(200).json({ status: 200, data: data });
        fs.appendFileSync('logResponse.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `istekApi /getCariSiparis\n`);
        fs.appendFileSync('logResponse.txt', `Response sent at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `Data: ${JSON.stringify(data)}\n`);
        fs.appendFileSync('logResponse.txt', `**************************************************************\n`);
    } catch (error) {


        fs.appendFileSync('logError.txt', `Error occurred at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logError.txt', `Error: ${error}\n`);
        res.status(500).json({ error: error });

    }
})
router.post('/postSevkEt', cors(), async (req, res) => {
    try {
        const { id, urun_kod, sevk_tarih, miktar, created_date, updated_date, is_deleted, sevk_miktar, siparis_miktar, irsaliye_no } = req.body
        fs.appendFileSync('log.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('log.txt', `Uretim Siparis Sevk:  ${JSON.stringify(req.body)}\n`);
        fs.appendFileSync('log.txt', `istekApi /postSevkEt\n`);

        const onceki = await pool.query(`INSERT INTO m_uretim_sevk_iptal(
	siparis_id, urun_kod, sevk_tarih, miktar, created_date, updated_date, is_deleted,irsaliye_no)
	VALUES ($1, $2, $3, $4, $5, $6, $7,$8) RETURNING * `, [id, urun_kod, sevk_tarih, parseInt(miktar), created_date, updated_date, is_deleted, irsaliye_no])
        const data = onceki.rows;
        let sevkEdilen = parseInt(sevk_miktar) + parseInt(miktar)
        let acikSiparis = parseInt(siparis_miktar) - sevkEdilen
        let status = 0
        if (acikSiparis > 0) {
            status = 1
        } else {
            status = 3
        }
        const updateSiparis = await pool.query(`UPDATE m_uretim_siparis SET sevk_miktar = $1 , acik_siparis = $2 , status = $3 WHERE id = $4`, [sevkEdilen, acikSiparis, status, id])

        res.status(200).json({ status: 200, data: data });
        fs.appendFileSync('logResponse.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `istekApi /postSevkEt\n`);
        fs.appendFileSync('logResponse.txt', `Response sent at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `Data: ${JSON.stringify(data)}\n`);
        fs.appendFileSync('logResponse.txt', `**************************************************************\n`);
    } catch (error) {


        fs.appendFileSync('logError.txt', `Error occurred at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logError.txt', `Error: ${error}\n`);
        res.status(500).json({ error: error });

    }
})
router.post('/getSingleWorkOrder', cors(), async (req, res) => {
    try {
        const { machine_id, product_id } = req.body
        fs.appendFileSync('log.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('log.txt', `istekIcerik :  ${JSON.stringify(req.body)}\n`);
        fs.appendFileSync('log.txt', `istekApi /getSingleWorkOrder\n`);
        const result = await pool.query(`SELECT * FROM m_work_order WHERE machine_id = $1 AND product_id = $2`, [machine_id, product_id]);
        const data = result.rows;

        res.status(200).json({ status: 200, data: data });
        fs.appendFileSync('logResponse.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `istekApi /getSingleWorkOrder\n`);
        fs.appendFileSync('logResponse.txt', `Response sent at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `Data: ${JSON.stringify(data)}\n`);
        fs.appendFileSync('logResponse.txt', `**************************************************************\n`);
    } catch (error) {


        fs.appendFileSync('logError.txt', `Error occurred at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logError.txt', `Error: ${error}\n`);
        res.status(500).json({ error: error });

    }
})

router.post('/selectProductSureGetir', cors(), async (req, res) => {
    try {
        const { machine_id, product_id, part_type } = req.body
        fs.appendFileSync('log.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('log.txt', `istekIcerik :  ${JSON.stringify(req.body)}\n`);
        fs.appendFileSync('log.txt', `istekApi /selectProductSureGetir\n`);
        const result = await pool.query(`SELECT * FROM m_product_machines WHERE machine_id = $1 AND product_id = $2 AND part_type = $3`, [machine_id, product_id, part_type]);
        const data = result.rows;

        res.status(200).json({ status: 200, data: data });
        fs.appendFileSync('logResponse.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `istekApi /selectProductSureGetir\n`);
        fs.appendFileSync('logResponse.txt', `Response sent at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `Data: ${JSON.stringify(data)}\n`);
        fs.appendFileSync('logResponse.txt', `**************************************************************\n`);
    } catch (error) {


        fs.appendFileSync('logError.txt', `Error occurred at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logError.txt', `Error: ${error}\n`);
        res.status(500).json({ error: error });

    }
})
router.post('/updateMachineDizilimHide', cors(), async (req, res) => {
    try {
        const { machine_id, sira_id } = req.body
        fs.appendFileSync('log.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('log.txt', `istekIcerik :  ${JSON.stringify(req.body)}\n`);
        fs.appendFileSync('log.txt', `istekApi /updateMachineDizilimHide\n`);




        const updateEskiMakina = await pool.query(`UPDATE machine_dizilim SET is_hide = true WHERE id = $1`, [sira_id])

        res.status(200).json({ status: 200, data: updateEskiMakina.rows });
        fs.appendFileSync('logResponse.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `istekApi /updateMachineDizilim\n`);
        fs.appendFileSync('logResponse.txt', `Response sent at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `Data: ${JSON.stringify(updateEskiMakina)}\n`);
        fs.appendFileSync('logResponse.txt', `**************************************************************\n`);
    } catch (error) {


        fs.appendFileSync('logError.txt', `Error occurred at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logError.txt', `Error: ${error}\n`);
        res.status(500).json({ error: error });

    }
})
router.post('/updateMachineDizilim', cors(), async (req, res) => {
    try {
        const { machine_id, sira_id } = req.body
        fs.appendFileSync('log.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('log.txt', `istekIcerik :  ${JSON.stringify(req.body)}\n`);
        fs.appendFileSync('log.txt', `istekApi /updateMachineDizilim\n`);

        const result = await pool.query(`SELECT * FROM machine_dizilim WHERE machine_id = $1 `, [machine_id]);
        let id
        if (result.rowCount > 0) {
            id = result.rows[0].id

            const updateEskiMakina = await pool.query(`UPDATE machine_dizilim SET machine_id  = 0 WHERE id = $1`, [id])
        }


        const updateEskiMakina = await pool.query(`UPDATE machine_dizilim SET machine_id  = $2 WHERE id = $1`, [sira_id, machine_id])

        res.status(200).json({ status: 200, data: updateEskiMakina.rows });
        fs.appendFileSync('logResponse.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `istekApi /updateMachineDizilim\n`);
        fs.appendFileSync('logResponse.txt', `Response sent at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `Data: ${JSON.stringify(updateEskiMakina)}\n`);
        fs.appendFileSync('logResponse.txt', `**************************************************************\n`);
    } catch (error) {


        fs.appendFileSync('logError.txt', `Error occurred at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logError.txt', `Error: ${error}\n`);
        res.status(500).json({ error: error });

    }
})
router.post('/getHatName', cors(), async (req, res) => {
    try {
        const { hat_id } = req.body
        fs.appendFileSync('log.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('log.txt', `istekIcerik :  ${JSON.stringify(req.body)}\n`);
        fs.appendFileSync('log.txt', `istekApi /getHatName\n`);
        const result = await pool.query(`SELECT * FROM machine_uretim_hat WHERE uretim_hat = $1`, [hat_id]);
        const data = result.rows;

        res.status(200).json({ status: 200, data: data });
        fs.appendFileSync('logResponse.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `istekApi /getHatName\n`);
        fs.appendFileSync('logResponse.txt', `Response sent at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `Data: ${JSON.stringify(data)}\n`);
        fs.appendFileSync('logResponse.txt', `**************************************************************\n`);
    } catch (error) {


        fs.appendFileSync('logError.txt', `Error occurred at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logError.txt', `Error: ${error}\n`);
        res.status(500).json({ error: error });

    }
})
router.post('/getMachineHat', cors(), async (req, res) => {
    try {
        const { birim_id } = req.body
        fs.appendFileSync('log.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('log.txt', `istekIcerik :  ${JSON.stringify(req.body)}\n`);
        fs.appendFileSync('log.txt', `istekApi /getMachineHat\n`);
        const result = await pool.query(`SELECT mm.id,mm.machines_name,mm.seri_no,mm.birim_id,mm.durum,mm.hat_id ,machines_kod , (SELECT json_agg(operasyon) 
        FROM (select *from optik_machine_operasyon omo WHERE mm.hat_id = omo.hat_id ) operasyon)  
as operasyon FROM main_machines mm WHERE (birim_id = $1 AND cihaz_type = 0 ) or (birim_id = 2 and cihaz_type = 4)`, [birim_id]);
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
            machines_kod: null,
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
            calisma_suresi: 450,
            tiger_isemri: null,
            opertorArray: [{
                operator_id: null,
                operator_name: null,
                operator_hedef: null,
                operator_gerceklesen: null,
                operator_gecen: null,
                operator_rework: null,
                operator_red: null,
                user_alan: true,

            }]
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
                items.tiger_isemri = null,

                items.calisma_suresi = 450
            items.opertorArray = [{
                operator_id: null,
                operator_name: null,
                operator_hedef: 0,
                operator_gerceklesen: 0,
                operator_rework: 0,
                operator_gecen: 0,

                operator_red: 0,
                user_alan: true,

            }];
        })
        res.status(200).json({ status: 200, data: datagiden, makina: data });
        fs.appendFileSync('logResponse.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `istekApi /getMachineHat\n`);
        fs.appendFileSync('logResponse.txt', `Response sent at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `Data: ${JSON.stringify(data)}\n`);
        fs.appendFileSync('logResponse.txt', `**************************************************************\n`);
    } catch (error) {


        fs.appendFileSync('logError.txt', `Error occurred at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logError.txt', `Error: ${error}\n`);
        res.status(500).json({ error: error });

    }
})
router.post('/getSingleHatMachines', cors(), async (req, res) => {
    try {
        const { birim_id } = req.body
        fs.appendFileSync('log.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('log.txt', `istekIcerik :  ${JSON.stringify(req.body)}\n`);
        fs.appendFileSync('log.txt', `istekApi /getSingleHatMachines\n`);
        const result = await pool.query(`SELECT*  FROM main_machines mm where birim_id = $1 AND cihaz_type = 0 order BY machines_kod`, [birim_id]);
        const data = result.rows;

        res.status(200).json({ status: 200, makina: data });
        fs.appendFileSync('logResponse.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `istekApi /getSingleHatMachines\n`);
        fs.appendFileSync('logResponse.txt', `Response sent at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `Data: ${JSON.stringify(data)}\n`);
        fs.appendFileSync('logResponse.txt', `**************************************************************\n`);
    } catch (error) {


        fs.appendFileSync('logError.txt', `Error occurred at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logError.txt', `Error: ${error}\n`);
        res.status(500).json({ error: error });

    }
})
router.post('/getMachineOptikPark', cors(), async (req, res) => {
    const { product_id, machine_id, created_date, update_date, end_date, status, planned_amount, realized_amount, birim_id } = req.body
    try {
        let birim
        let bugun = new Date();
        let dun = new Date(bugun);
        dun.setDate(bugun.getDate() - 1);
        let startDate = dun.toISOString().slice(0, 10);
        let finsihDate = bugun.toISOString().slice(0, 10);
        if (birim_id !== undefined && birim_id !== "" && birim_id !== 1) {
            birim = birim_id;
        } else {
            birim = 1;
        }
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
            WHERE mm.birim_id = $3
            ORDER BY mm.hat_id
        )  machine
         ON machine.id = mdizi.machine_id WHERE mdizi.birim_id =$3 ORDER BY mdizi.id `, [startDate, finsihDate, birim]);
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
router.post('/uretimGunlukUretimGiris', cors(), async (req, res) => {
    try {

        const data = req.body
        fs.appendFileSync('log.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('log.txt', `istekIcerik :  ${JSON.stringify(req.body)}\n`);
        fs.appendFileSync('log.txt', `istekApi /optikUretimGunlukUretimGiris\n`);
        let today = new Date();
        let production_dates = `${data.production_date.year}-${data.production_date.month}-${data.production_date.day}`;

        const started_date = new Date().toISOString();

        fs.appendFileSync('log.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('log.txt', `istekIcerik :  ${req.body}\n`);
        fs.appendFileSync('log.txt', `istekApi optikUretimGunlukUretimGiris\n`);

        data.data.forEach(async element => {
            const { product_id, id, realized_amount, production_date, kalite_sunulan, operator_production, calisma_suresi, tiger_isemri, kalite_red, operator, operator_name, vardiya, planned_amount, uretimTur, work_id, part_type, operation_time, rework, makina_kapasite, operator_planed, operator_realized } = element


            let work = work_id

            const operasyonSuresiKontro = await pool.query(`SELECT * FROM m_product_machines WHERE machine_id= $1 AND product_id = $2 AND part_type=$3`, [id, product_id, part_type])
            let operasyonID
            if (operasyonSuresiKontro.rowCount < 1) {

                const yeniUurunMakianQuery = await pool.query(`INSERT INTO m_product_machines (machine_id, product_id, part_type, operation_time,makina_kapasite) VALUES ($1,$2, $3,$4,$5) RETURNING id`, [id, product_id, part_type, operation_time, makina_kapasite])
                operasyonID = yeniUurunMakianQuery.rows[0].id
            } else {
                operasyonID = operasyonSuresiKontro.rows[0].id
            }


            if (!work_id) {

                const result = await pool.query(`INSERT INTO m_work_order(product_id, machine_id, created_date, update_date, status, planned_amount,realized_amount,operasyon_tur,operator_planed, operator_realized,tiger_isemri)
                VALUES ($1, $2, $3, $4, $5, $6,$7,$8,$9,$10,$11) RETURNING id`, [product_id, id, production_dates, production_dates, 1, parseInt(planned_amount), realized_amount ? parseInt(realized_amount) : 0, part_type, parseInt(operator_planed), parseInt(operator_realized), tiger_isemri]);
                work = result.rows[0].id;
            } else {


                const yeniUrunQuery = await pool.query(`SELECT * FROM m_work_order WHERE id = $1 AND product_id = $2 AND status = 1`, [work, product_id])
                if (yeniUrunQuery.rowCount > 0) {
                    const updateWorkResult = await pool.query(`
        UPDATE m_work_order 
        SET realized_amount = realized_amount + $1 ,operator_realized = operator_realized + $3 
        WHERE id = $2;
      `, [realized_amount ? parseInt(realized_amount) : 0, work, operator_realized]);
                } else {
                    const updateWorkResult = await pool.query(`
                    UPDATE m_work_order 
                    SET status = 2
                    WHERE id = $1;
                  `, [work]);
                    const result = await pool.query(`INSERT INTO m_work_order(product_id, machine_id, created_date, update_date, status, planned_amount,realized_amount,operasyon_tur,operator_planed, operator_realized,tiger_isemri)
                  VALUES ($1, $2, $3, $4, $5, $6,$7,$8,$9,$10,$11) RETURNING id`, [product_id, id, production_dates, production_dates, 1, parseInt(planned_amount), realized_amount ? parseInt(realized_amount) : 0, part_type, parseInt(operator_planed), parseInt(operator_realized), tiger_isemri]);
                    work = result.rows[0].id;


                }


            }


            // production work order insert edilecek
            const productionResult = await pool.query(`
      INSERT INTO m_production (
        product_id, machine_id, production, created_date, production_date, finish_date, status, quality_production, red_quailty, operator_id, vardiya_no,work_id,rework,operator_production,operasyon_id,operator_name,operasyon_time,calisma_suresi,uretim_turu
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,$12,$13,$14,$15,$16,$17,$18,$19)
      RETURNING id;
    `, [product_id, id, realized_amount ? parseInt(realized_amount) : 0, production_dates, production_dates, today, 1, kalite_sunulan, kalite_red, operator, vardiya, work, rework, operator_realized, operasyonID, operator_name, operation_time, calisma_suresi, uretimTur]);


            const started_date = new Date().toISOString();
            const finish_date = new Date().toISOString();
            if (element.uygunsuz) {
                element.uygunsuz.forEach(async uygunsuz => {
                    const { uygunsuz_id,
                        machine_id,
                        product_id,

                        miktar,
                        name } = uygunsuz
                    const uygunsuzlukGiris = await pool.query(`INSERT INTO m_uygunsuzluk (uygunsuz_id, machine_id, product_id, work_id, started_date, finish_date, miktar) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [uygunsuz_id,
                        machine_id,
                        product_id, work,
                        started_date,
                        finish_date, miktar])

                })
            }
            if (element.duruslar) {
                element.duruslar.forEach(async durus => {
                    const { durus_id,
                        machine_id,
                        product_id,
                        duration_time,
                        name } = durus
                    const durusGiris = await pool.query(`INSERT INTO m_durus (durus_id, machine_id, product_id, work_id, started_date, finish_date, duration_time) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [durus_id,
                        machine_id,
                        product_id,
                        work, started_date,
                        finish_date, duration_time])

                })
            }
        });

        const kokpitInserIslemi = await uretimGirisKokpit(production_dates)


        res.status(200).json({ status: 200, data: data });
        fs.appendFileSync('logResponse.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `istekApi /optikUretimGunlukUretimGiris\n`);
        fs.appendFileSync('logResponse.txt', `Response sent at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `Data: ${JSON.stringify(data)}\n`);
        fs.appendFileSync('logResponse.txt', `**************************************************************\n`);
    } catch (error) {


        fs.appendFileSync('logError.txt', `Error occurred at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logError.txt', `Error: ${error}\n`);
        res.status(500).json({ error: error });

    }
})

async function uretimGirisKokpit(production_dates) {
    console.log(production_dates)
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
        mp.production_date BETWEEN '${production_dates}' AND '${production_dates}'
    GROUP BY 
        mp.machine_id, mp.product_id, mpp.urun_kod, mm.machines_kod, wo.operasyon_tur, mm.hat_id,wo.tiger_isemri,mpp.urun_aciklama
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
    let tarih = production_dates

    const mssqlPool = await poolPromise; // MSSQL bağlantısı
    const poolRequestDelete = mssqlPool.request();
    const dataSil = `DELETE FROM AHO_OPTIKURETIM WHERE TARIH =@tarih`
    poolRequestDelete.input('tarih', tarih);
    const dataSilMethot = await poolRequestDelete.query(dataSil);
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
    return dataSilMethot;
}

router.post('/uretimGunlukUretimGirisKaplama', cors(), async (req, res) => {
    try {

        const data = req.body
        fs.appendFileSync('log.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('log.txt', `istekIcerik :  ${JSON.stringify(req.body)}\n`);
        fs.appendFileSync('log.txt', `istekApi /uretimGunlukUretimGirisKaplama\n`);
        let today = new Date();
        let production_dates = `${data.production_date.year}-${data.production_date.month}-${data.production_date.day}`;

        const started_date = new Date().toISOString();


        let hatKaplama = false
        data.data.forEach(async element => {
            const { product_id, id, realized_amount, production_date, opertorArray, calisma_suresi, uretimTur, tiger_isemri, kalite_sunulan, operator_production, hat_id, kalite_red, operator, operator_name, vardiya, planned_amount, work_id, part_type, operation_time, rework, makina_kapasite, operator_planed, operator_realized } = element

            let work = work_id

            const operasyonSuresiKontro = await pool.query(`SELECT * FROM m_product_machines WHERE machine_id= $1 AND product_id = $2 AND part_type=$3`, [id, product_id, part_type])
            let operasyonID
            if (operasyonSuresiKontro.rowCount < 1) {

                const yeniUurunMakianQuery = await pool.query(`INSERT INTO m_product_machines (machine_id, product_id, part_type, operation_time,makina_kapasite) VALUES ($1,$2, $3,$4,$5) RETURNING id`, [id, product_id, part_type, operation_time, makina_kapasite])
                operasyonID = yeniUurunMakianQuery.rows[0].id
            } else {
                operasyonID = operasyonSuresiKontro.rows[0].id
            }


            if (!work_id) {
                let yeni_operator_planed = 0;
                opertorArray.forEach(element => {
                    yeni_operator_planed += element.operator_hedef;
                });

                // Değişkenlerin geçerli sayılar içerdiğinden emin olun
                const plannedAmountInt = isNaN(parseInt(planned_amount)) ? parseInt((calisma_suresi / operation_time) * makina_kapasite) : parseInt(planned_amount);
                const realizedAmountInt = isNaN(parseInt(realized_amount)) ? yeni_operator_planed : parseInt(realized_amount);
                const operatorPlanedInt = parseInt(yeni_operator_planed);

                // NaN kontrolü yapın
                if (isNaN(plannedAmountInt) || isNaN(realizedAmountInt) || isNaN(operatorPlanedInt)) {
                    throw new Error("Geçersiz sayı değeri: planned_amount, realized_amount veya yeni_operator_planed geçersiz.");
                }

                const result = await pool.query(
                    `INSERT INTO m_work_order(
                        product_id, machine_id, created_date, update_date, status,
                        planned_amount, realized_amount, operasyon_tur, operator_planed, operator_realized, tiger_isemri
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
                    [product_id, id, production_dates, production_dates, 1, plannedAmountInt,
                        realizedAmountInt, part_type, operatorPlanedInt, realizedAmountInt, tiger_isemri]
                );

                work = result.rows[0].id;
            } else {


                const yeniUrunQuery = await pool.query(`SELECT * FROM m_work_order WHERE id = $1 AND product_id = $2 AND status = 1`, [work, product_id])
                if (yeniUrunQuery.rowCount > 0) {
                    const updateWorkResult = await pool.query(`
                                                  UPDATE m_work_order 
                                                SET realized_amount = realized_amount + $1 ,operator_realized = operator_realized + $3 
                                                 WHERE id = $2;
                                            `, [realized_amount, work, operator_realized]);
                } else {
                    const updateWorkResult = await pool.query(`
                                   UPDATE m_work_order 
                                     SET status = 2
                                    WHERE id = $1; `, [work]);


                    const result = await pool.query(`INSERT INTO m_work_order(product_id, machine_id, created_date, update_date, status, planned_amount,realized_amount,operasyon_tur,operator_planed, operator_realized,tiger_isemri)
                                    VALUES ($1, $2, $3, $4, $5, $6,$7,$8,$9,$10,$11) RETURNING id`, [product_id, id, production_dates, production_dates, 1, parseInt(planned_amount), parseInt(realized_amount), part_type, parseInt(operator_planed), parseInt(operator_realized), tiger_isemri]);
                    work = result.rows[0].id;
                }
            }

            opertorArray.forEach(async production => {
                const productionResult = await pool.query(`
                            INSERT INTO m_production (product_id, machine_id, production, created_date, production_date, finish_date, status, quality_production, 
                                red_quailty, operator_id, vardiya_no,work_id,rework,operator_production,operasyon_id,operator_name,operasyon_time,calisma_suresi,uretim_turu)
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,$12,$13,$14,$15,$16,$17,$18,$19)
                            RETURNING id; `,
                    [product_id, id, production.operator_gerceklesen, production_dates, production_dates, today, 1, production.operator_gerceklesen, production.operator_red, production.operator_id, vardiya, work, production.operator_rework,
                        production.operator_gerceklesen, operasyonID, production.operator_name, operation_time, calisma_suresi, uretimTur]);


            });
            const started_date = new Date().toISOString();
            const finish_date = new Date().toISOString();
            if (element.uygunsuz) {
                element.uygunsuz.forEach(async uygunsuz => {
                    const { uygunsuz_id,
                        machine_id,
                        product_id,
                        miktar,
                        name } = uygunsuz
                    const uygunsuzlukGiris = await pool.query(`INSERT INTO m_uygunsuzluk (uygunsuz_id, machine_id, product_id, work_id, started_date, finish_date, miktar) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [uygunsuz_id,
                        machine_id,
                        product_id, work,
                        started_date,
                        finish_date, miktar])

                })
            }
            if (element.duruslar) {
                element.duruslar.forEach(async durus => {
                    const { durus_id,
                        machine_id,
                        product_id,
                        duration_time,
                        name } = durus
                    const durusGiris = await pool.query(`INSERT INTO m_durus (durus_id, machine_id, product_id, work_id, started_date, finish_date, duration_time) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [durus_id,
                        machine_id,
                        product_id,
                        work, started_date,
                        finish_date, duration_time])

                })
            }
        });




        res.status(200).json({ status: 200, data: data });
        fs.appendFileSync('logResponse.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `istekApi /optikUretimGunlukUretimGiris\n`);
        fs.appendFileSync('logResponse.txt', `Response sent at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `Data: ${JSON.stringify(data)}\n`);
        fs.appendFileSync('logResponse.txt', `**************************************************************\n`);
    } catch (error) {


        fs.appendFileSync('logError.txt', `Error occurred at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logError.txt', `Error: ${error}\n`);
        res.status(500).json({ error: error });

    }
})

router.post("/optikMachineHatGet", cors(), async (req, res) => {
    try {

        const { vardiya, production_dates, hat_id } = req.body

        fs.appendFileSync('log.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('log.txt', `istekIcerik :  ${JSON.stringify(req.body)}\n`);
        fs.appendFileSync('log.txt', `istekApi /optikMachineHatGet\n`);
        const query = await pool.query(`SELECT mm.id,
        (SELECT json_agg(duruslar) FROM 
            (select md.*,mps.name from m_durus md 
                INNER JOIN m_durus_sebep mps 
                        ON mps.id = md.durus_id WHERE md.machine_id=mm.id AND pp.id =md.product_id 
                            AND mp.work_id = md.work_id )duruslar)
            as duruslar,
        (SELECT json_agg(uygunsuz) FROM 
            (select md.*,mps.name from m_uygunsuzluk md
                INNER JOIN m_uygunsuzluk_sebep mps 
                        ON mps.id = md.uygunsuz_id WHERE md.machine_id=mm.id AND pp.id =md.product_id 
                            AND mp.work_id = md.work_id )uygunsuz) 
            as uygunsuz,
        (SELECT json_agg(operasyon) 
                            FROM (select *from optik_machine_operasyon omo WHERE mm.hat_id = omo.hat_id ) operasyon) 
            as operasyon,
		SUM(mp.production)as realized_amount,
        SUM(mp.quality_production) AS kalite_sunulan,
        SUM(mp.red_quailty) AS red_kalite,
        (SUM(mp.quality_production)-SUM(mp.red_quailty)) as kalite_gecen,
        SUM(wo.realized_amount) as toplamUretilen,
        mm.birim_id,
        mm.birim_name,
        mm.durum,
        mm.machines_name,
        mp.operator_id as operator,
        mm.qr,
        mm.seri_no,
        wo.operasyon_tur as part_type,
        wo.planned_amount,
        pm.operation_time,
        mp.work_id AS work_id,
        mp.vardiya_no as vardiya,
        pp.urun_kod,
        pp.urun_aciklama,
        pp.id AS product_id
    FROM 
        main_machines mm 
    LEFT JOIN 
        m_work_order wo ON wo.machine_id = mm.id  AND wo.created_date = '${production_dates}' 
    LEFT JOIN 
        m_production mp ON wo.id = mp.work_id AND mp.production_date = '${production_dates}' AND vardiya_no = ${vardiya} and wo.status = 1
    LEFT JOIN 
        m_product_production pp ON wo.product_id = pp.id and wo.status = 1
    LEFT JOIN 
        m_product_machines pm ON pm.product_id = pp.id AND pm.machine_id = mm.id  AND wo.operasyon_tur = pm.part_type
    WHERE 
        mm.birim_id = 1
    GROUP BY 
        mm.id,
        mp.operator_id,
        mp.vardiya_no,
        mp.production,
        mm.birim_id,
        mm.birim_name,
        mm.durum,
        mm.machines_name,
        mm.qr,
        mm.seri_no,
        pm.operation_time,
        wo.operasyon_tur,
        mp.work_id,
        pp.id,
        wo.planned_amount,
        wo.realized_amount,
        pp.urun_kod,
        pp.urun_aciklama`)
        const data = query.rows

        res.status(200).json({ status: 200, data: data })
        fs.appendFileSync('logResponse.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `istekApi /optikMachineHatGet\n`);
        fs.appendFileSync('logResponse.txt', `Response sent at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `Data: ${JSON.stringify(data)}\n`);
        fs.appendFileSync('logResponse.txt', `**************************************************************\n`);
    } catch (error) {
        res.status(500).json({
            status: 500,
            data: error
        })
        fs.appendFileSync('logError.txt', `Error occurred at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logError.txt', `Error: ${error}\n`);
        res.status(500).json({ error: error });

    }

})
router.post("/optikMachineGet", cors(), async (req, res) => {
    try {

        const { vardiya, production_dates } = req.body


        fs.appendFileSync('log.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('log.txt', `istekIcerik :  ${JSON.stringify(req.body)}\n`);
        fs.appendFileSync('log.txt', `istekApi /optikMachineGet\n`);
        const query = await pool.query(`SELECT mm.id,
        (SELECT json_agg(duruslar) FROM 
            (select md.*,mps.name from m_durus md 
                INNER JOIN m_durus_sebep mps 
                        ON mps.id = md.durus_id WHERE md.machine_id=mm.id AND pp.id =md.product_id 
                            AND mp.work_id = md.work_id )duruslar)
            as duruslar,
        (SELECT json_agg(uygunsuz) FROM 
            (select md.*,mps.name from m_uygunsuzluk md
                INNER JOIN m_uygunsuzluk_sebep mps 
                        ON mps.id = md.uygunsuz_id WHERE md.machine_id=mm.id AND pp.id =md.product_id 
                            AND mp.work_id = md.work_id )uygunsuz) 
            as uygunsuz,
        (SELECT json_agg(operasyon) 
                            FROM (select *from optik_machine_operasyon omo WHERE mm.hat_id = omo.hat_id ) operasyon) 
            as operasyon,
		SUM(mp.production)as realized_amount,
        SUM(mp.quality_production) AS kalite_sunulan,
        SUM(mp.red_quailty) AS red_kalite,
        (SUM(mp.quality_production)-SUM(mp.red_quailty)) as kalite_gecen,
        SUM(wo.realized_amount) as toplamUretilen,
        mm.birim_id,
        mm.birim_name,
        mm.durum,
        mm.machines_name,
        mp.operator_id as operator,
        mm.qr,
        mm.seri_no,
        wo.operasyon_tur as part_type,
        wo.planned_amount,
        pm.operation_time,
        mp.work_id AS work_id,
        mp.vardiya_no as vardiya,
        pp.urun_kod,
        pp.urun_aciklama,
        pp.id AS product_id
    FROM 
        main_machines mm 
    LEFT JOIN 
        m_work_order wo ON wo.machine_id = mm.id  AND wo.created_date = '${production_dates}' 
    LEFT JOIN 
        m_production mp ON wo.id = mp.work_id AND mp.production_date = '${production_dates}' AND vardiya_no = ${vardiya} and wo.status = 1
    LEFT JOIN 
        m_product_production pp ON wo.product_id = pp.id and wo.status = 1
    LEFT JOIN 
        m_product_machines pm ON pm.product_id = pp.id AND pm.machine_id = mm.id  AND wo.operasyon_tur = pm.part_type
    WHERE 
        mm.birim_id = 1
    GROUP BY 
        mm.id,
        mp.operator_id,
        mp.vardiya_no,
        mp.production,
        mm.birim_id,
        mm.birim_name,
        mm.durum,
        mm.machines_name,
        mm.qr,
        mm.seri_no,
        pm.operation_time,
        wo.operasyon_tur,
        mp.work_id,
        pp.id,
        wo.planned_amount,
        wo.realized_amount,
        pp.urun_kod,
        pp.urun_aciklama`)
        const data = query.rows

        res.status(200).json({ status: 200, data: data })
        fs.appendFileSync('logResponse.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `istekApi /optikMachineGet\n`);
        fs.appendFileSync('logResponse.txt', `Response sent at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `Data: ${JSON.stringify(data)}\n`);
        fs.appendFileSync('logResponse.txt', `**************************************************************\n`);
    } catch (error) {
        res.status(500).json({
            status: 500,
            data: error
        })
        fs.appendFileSync('logError.txt', `Error occurred at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logError.txt', `Error: ${error}\n`);
        res.status(500).json({ error: error });

    }

})
router.post("/raporGunlukCikan", cors(), async (req, res) => {
    try {
        const { startDate, endDate } = req.body;


        fs.appendFileSync('log.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('log.txt', `istekIcerik :  ${JSON.stringify(req.body)}\n`);
        fs.appendFileSync('log.txt', `istekApi /raporGunlukCikan\n`);
        const query = await pool.query(`
        SELECT muh.name as hat,
           SUM(mp.production) AS uretim,
           SUM(mwo.planned_amount) AS planlanan,
           SUM(mp.red_quailty) AS red
    FROM machine_uretim_hat muh
    LEFT JOIN main_machines mm ON muh.id = mm.hat_id
    LEFT JOIN m_production mp ON mm.id = mp.machine_id  AND mp.production_date BETWEEN '${startDate}' AND '${endDate}'
    LEFT JOIN m_work_order mwo ON mp.work_id = mwo.id AND mwo.created_date BETWEEN '${startDate}' AND '${endDate}' WHERE  mm.birim_id = 1 AND (mm.hat_id = 6 OR mm.hat_id = 7)
    GROUP BY muh.name;
           
               
        `);

        const queryData = query.rows

        res.status(200).json({ status: 200, data: queryData });
        fs.appendFileSync('logResponse.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `istekApi /raporGunlukCikan\n`);
        fs.appendFileSync('logResponse.txt', `Response sent at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `Data: ${JSON.stringify(queryData)}\n`);
        fs.appendFileSync('logResponse.txt', `**************************************************************\n`);
    } catch (error) {
        fs.appendFileSync('logError.txt', `Error occurred at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logError.txt', `Error: ${error}\n`);
        res.status(500).json({ error: error });

    }
});
router.post("/raporHatRapor", cors(), async (req, res) => {
    try {
        const { startDate, endDate } = req.body;


        fs.appendFileSync('log.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('log.txt', `istekIcerik :  ${JSON.stringify(req.body)}\n`);
        fs.appendFileSync('log.txt', `istekApi /raporHatRapor\n`);
        const query = await pool.query(`	
        SELECT muh.name,
               SUM(mp.production) AS toplamUretim,
               SUM(mwo.planned_amount) AS toplamPlanlanan,
               SUM(mp.red_quailty) AS toplamRed,
               SUM(mp.rework) AS toplam_rework
               
        FROM machine_uretim_hat muh
        LEFT JOIN main_machines mm ON muh.id = mm.hat_id 
        LEFT JOIN m_production mp ON mm.id = mp.machine_id AND mp.production_date BETWEEN '${startDate}' and '${endDate}'
        LEFT JOIN m_work_order mwo ON mp.work_id = mwo.id  AND mwo.created_date BETWEEN '${startDate}' and '${endDate}' WHERE muh.uretim_hat =2
        GROUP BY muh.name, muh.id ORDER BY muh.id`)

        const queryData = query.rows

        res.status(200).json({ status: 200, data: queryData });
        fs.appendFileSync('logResponse.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `istekApi /raporHatRapor\n`);
        fs.appendFileSync('logResponse.txt', `Response sent at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `Data: ${JSON.stringify(queryData)}\n`);
        fs.appendFileSync('logResponse.txt', `**************************************************************\n`);

    } catch (error) {

        fs.appendFileSync('logError.txt', `Error occurred at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logError.txt', `Error: ${error}\n`);
        res.status(500).json({ error: error });

    }
});
router.post("/raporPersonelRapor", cors(), async (req, res) => {
    try {
        const { startDate, endDate } = req.body;
        fs.appendFileSync('log.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('log.txt', `istekIcerik :  ${JSON.stringify(req.body)}\n`);
        fs.appendFileSync('log.txt', `istekApi /raporPersonelRapor\n`);

        const query = await pool.query(`	
        SELECT datas.operator_name as user_name, SUM(toplamuretim) as toplamuretim,SUM(toplamred) as toplamred,SUM(diger_kayip) as diger_kayip,sum(toplamplanlanan) as toplamplanlanan,sum(toplamrework) as toplamrework,
        SUM(toplam_kayip)toplam_kayip,datas.operator_id
        FROM (SELECT mwo.id,muh.name, sum(mp.operator_production) as toplamuretim,mp.operator_name,
        ((SELECT  
            SUM(duration_time)toplamDurus FROM m_durus md 
            INNER JOIN m_durus_sebep sebep ON sebep.id = md.durus_id AND  sebep.kaynak=false
            WHERE mwo.id= md.work_id )/mp.operasyon_time) as toplam_kayip,
			  ((SELECT  
            SUM(duration_time)toplamDurus FROM m_durus md 
            INNER JOIN m_durus_sebep sebep ON sebep.id = md.durus_id AND  sebep.kaynak=true
            WHERE mwo.id= md.work_id )/mp.operasyon_time) as diger_kayip,
                sum(mp.red_quailty) as toplamred,
              sum(mp.rework) as toplamrework,
              sum(mwo.operator_planed)as toplamplanlanan,
        mp.operator_id 
        FROM m_production mp 
        INNER JOIN m_work_order mwo ON mp.work_id = mwo.id 
        INNER JOIN main_machines mm ON mm.id = mp.machine_id 
        INNER JOIN machine_uretim_hat muh on muh.id = mm.hat_id AND muh.uretim_hat = 2  WHERE mp.production_date BETWEEN '${startDate}' and '${endDate}' AND mwo.created_date BETWEEN '${startDate}' and '${endDate}'
        GROUP BY mp.operator_id, muh.id,mp.id,mwo.id 
        ORDER BY muh.id) as datas  GROUP BY datas.operator_id ,datas.operator_name
       `)
        const queryData = query.rows
        //burada http://10.0.0.35/3212/getusersOptik  post methodu ile istek atacağım ve gelen veriyi içindeki user_id ile queryData[x].operator_id ile eşit olan varsa gelen veririn user_name bilgisini queryData içerisine yazacağım 
        // Make a POST request to get users data

        res.status(200).json({ status: 200, data: queryData });
        fs.appendFileSync('logResponse.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `istekApi /raporPersonelRapor\n`);
        fs.appendFileSync('logResponse.txt', `Response sent at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `Data: ${JSON.stringify(queryData)}\n`);
        fs.appendFileSync('logResponse.txt', `**************************************************************\n`);
    } catch (error) {

        fs.appendFileSync('logError.txt', `Error occurred at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logError.txt', `Error: ${error}\n`);
        res.status(500).json({ error: error });

    }
});

router.post("/raporMakinaRapor", cors(), async (req, res) => {
    try {
        const { startDate, endDate } = req.body;
        fs.appendFileSync('log.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('log.txt', `istekIcerik :  ${JSON.stringify(req.body)}\n`);
        fs.appendFileSync('log.txt', `istekApi /raporMakinaRapor\n`);
        const query = await pool.query(` 
       
        SELECT mm.machines_name,muh.name, sum(mp.production) as toplamuretim, sum(mp.red_quailty) as toplamred,sum(planned_amount)as toplamplanlanan, mm.id 
	FROM m_production mp 
		INNER JOIN m_work_order mwo ON mp.work_id = mwo.id 
		INNER JOIN main_machines mm ON mm.id = mp.machine_id 
		INNER JOIN machine_uretim_hat muh on muh.id = mm.hat_id AND muh.uretim_hat = 2   WHERE mp.production_date BETWEEN '${startDate}' and '${endDate}' AND mwo.created_date BETWEEN '${startDate}' and '${endDate}'
GROUP BY mm.id, muh.id	order by muh.id
      
       `)
        const queryData = query.rows


        res.status(200).json({ status: 200, data: queryData });
        fs.appendFileSync('logResponse.txt', `Request received at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `istekApi /raporMakinaRapor\n`);
        fs.appendFileSync('logResponse.txt', `Response sent at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logResponse.txt', `Data: ${JSON.stringify(queryData)}\n`);
        fs.appendFileSync('logResponse.txt', `**************************************************************\n`);
    } catch (error) {
        console.error("Hata:", error);
        res.status(500).json({ status: 500, error: "Sunucu Hatası" });
        fs.appendFileSync('logError.txt', `Error occurred at ${new Date().toISOString()}:\n`);
        fs.appendFileSync('logError.txt', `Error: ${error}\n`);
        res.status(500).json({ error: error });

    }
});

module.exports = router;
