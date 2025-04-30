

const pool = require('../db');
const path = require('path');
const transliteration = require('transliteration');
const { sqls, poolPromises } = require('../portal_Tiger_db');
const multer = require('multer');
const express = require('express');
const router = express.Router();
const fs = require('fs');
const xlsx = require('xlsx');
const cors = require('cors');
router.use(cors());
const indexSearch = `SELECT (SELECT aylik_index as index FROM maliyet_enflansyon_index 
WHERE (yil, ay) = (
    SELECT yil, ay 
    FROM maliyet_enflansyon_index 
    ORDER BY yil DESC, ay DESC 
    LIMIT 1
))/aylik_index as index FROM maliyet_enflansyon_index 
WHERE yil = $1 AND ay=$2`


exports.depoCekMaliyet = async (req, res) => {
    const { data } = req.body;
    try {
        const cariYilResult = await pool.query(`SELECT * FROM portal_tiger_aktif_cari`);
        const cari_yil = cariYilResult.rows[0].yil;

        const mssqlPool = await poolPromises; // MSSQL bağlantısı
        const tigerCariOku = mssqlPool.request();

        //         const tigerSql = `
        //         SELECT  ITM.CODE AS kodu  FROM LG_224_ITEMS ITM
        //    `;
        const tigerSql = `
          SELECT ITM.CODE AS kodu, 
            (SELECT TOP 1 linee.DATE_ 
            FROM dbo.LG_225_01_STLINE linee  
            WHERE ITM.LOGICALREF = linee.STOCKREF 
            AND (linee.TRCODE = 12 OR linee.TRCODE = 13)  
            AND linee.PLNAMOUNT = 0
            ORDER BY linee.DATE_ DESC) AS SON_ALIM_TARIHI, 
            ITM.NAME AS urun_aciklama, DP.NAME AS depo, 
            ROUND(SUM(ST.ONHAND), 1) AS miktar, UNI.NAME AS BİRİM
            FROM dbo.LV_${cari_yil}_01_STINVTOT AS ST WITH (NOLOCK)
            INNER JOIN dbo.LG_${cari_yil}_ITEMS AS ITM WITH (NOLOCK) ON ST.STOCKREF = ITM.LOGICALREF
            INNER JOIN dbo.L_CAPIWHOUSE AS DP WITH (NOLOCK) ON ST.INVENNO = DP.NR
            INNER JOIN dbo.LG_${cari_yil}_UNITSETF AS UNI WITH (NOLOCK) ON ITM.UNITSETREF = UNI.LOGICALREF
            WHERE ITM.ACTIVE = 0 AND DP.FIRMNR = ${cari_yil} AND ITM.CODE NOT LIKE 'S%' AND ST.ONHAND > 0
            GROUP BY ITM.CODE, ITM.NAME, DP.NAME, ST.INVENNO, UNI.NAME , ITM.LOGICALREF 
            ORDER BY ITM.CODE
            `;

        let depoAdetResult;
        try {
            depoAdetResult = await tigerCariOku.query(tigerSql);
        } catch (error) {
            console.error("Error executing SQL query for depoAdetResult:", error);
            return res.status(400).json({ error: "Error fetching depo data" });
        }

        if (depoAdetResult.rowsAffected > 0) {
            let tigerDepo = depoAdetResult.recordsets[0];

            try {
                await pool.query(`DELETE FROM maliyet_urun_depo`);
                // await pool.query(`DELETE FROM maliyet_urun_birim_fiyat`);
                // await pool.query(`DELETE FROM maliyet_bom`);
                // await pool.query(`DELETE FROM maliyet_satin_alma_siparis`);
            } catch (error) {
                console.error("Error clearing old data from maliyet_urun_depo and maliyet_urun_birim_fiyat:", error);
                return res.status(400).json({ error: "Error clearing old data" });
            }

            const today = new Date();
            for (let item of tigerDepo) {
                let lastPurchaseDate = 0;
                try {
                    if (item.SON_ALIM_TARIHI) {
                        let lastPurchaseDates = new Date(item.SON_ALIM_TARIHI); // SQL tarihini Date objesine çevir
                        let gunFarki = Math.floor((today - lastPurchaseDates) / (1000 * 60 * 60 * 24));
                        lastPurchaseDate = gunFarki;
                    } else {
                        const eskiVeriVarmiQuery = `SELECT * FROM maliyet_urun_depo WHERE urun_kodu ='${item.kodu}' `;
                        let eskiVarmiRequest;
                        try {
                            eskiVarmiRequest = await pool.query(eskiVeriVarmiQuery);
                        } catch (error) {
                            console.error("Error checking for existing data in maliyet_urun_depo:", error);
                            return res.status(400).json({ error: "Error checking for existing data" });
                        }

                        if (eskiVarmiRequest.rowCount > 0) {
                            lastPurchaseDate = eskiVarmiRequest.rows[0].son_hareket;
                        } else {
                            lastPurchaseDate = await sonHareketBul(225, item.kodu);

                            if (lastPurchaseDate == 0) {
                                let eskiKart = await tigerCariOku.query(`SELECT * FROM ESKI_KART_220 WHERE [YENİ KOD] IS NOT NULL AND [YENİ KOD] ='${item.kodu}'`);
                                let eskiKartData = eskiKart.recordsets[0];
                                lastPurchaseDate = await sonHareketBul(225, eskiKartData[0].KOD);
                            }
                        }
                    }

                    const insertNewDepoQuery = `INSERT INTO maliyet_urun_depo (urun_kodu, urun_aciklama, depo_miktar, depo, son_hareket) VALUES ($1, $2, $3, $4, $5)`;
                    try {
                        await pool.query(insertNewDepoQuery, [item.kodu, item.urun_aciklama, item.miktar, item.depo, lastPurchaseDate]);
                    } catch (error) {
                        console.error("Error inserting new depo data:", error);
                    }
                    const eskiVeriBirimFiyatQuery = `SELECT * FROM maliyet_urun_birim_fiyat WHERE urun_kodu = '${item.kodu}' `;
                    let eskiVeriBirimFiyatRequest;
                    try {
                        eskiVeriBirimFiyatRequest = await pool.query(eskiVeriBirimFiyatQuery);
                    } catch (error) {
                        console.error("Error checking for existing birim fiyat data:", error);
                    }
                    if (eskiVeriBirimFiyatRequest.rowCount == 0) {
                        const urunTekilInsert = `INSERT INTO maliyet_urun_birim_fiyat (urun_kodu) VALUES($1)`;
                        try {
                            await pool.query(urunTekilInsert, [item.kodu]);
                        } catch (error) {
                            console.error("Error inserting new birim fiyat:", error);
                        }
                        await sasCekMaliyet(cari_yil, item.kodu);
                    }
                    if (!/(100\.%|800\.%|200\.%|300\.|400\.|500\.|600|700|53\*\*-)/.test(item.kodu)) {
                        const bomVar = await pool.query(`SELECT * FROM maliyet_bom WHERE ana_urun ='${item.kodu}'`);
                        if (bomVar.rowCount == 0) {
                            veri = await bomCek(item.kodu, cari_yil);
                            const bomVarMi = await pool.query(`select bom.*,birim.birim_fiyat 
                                 FROM maliyet_bom bom INNER JOIN maliyet_urun_birim_fiyat birim ON bom.kod = birim.urun_kodu WHERE ana_urun ='${item.kodu}'`)
                            if (bomVarMi.rowCount > 0) {
                                for (let data of bomVarMi.rows) {
                                    let filterBom = bomVarMi.rows.filter((i) => {
                                        return i.ust_kod == data.kod
                                    })
                                    if (filterBom.length > 0) {
                                        for (let data2 of filterBom) {
                                            data.bom_fiyat += data2.birim_fiyat ? data2.birim_fiyat : data2.bom_fiyat
                                        }
                                        data.bom_fiyat = data.bom_fiyat ? data.bom_fiyat : 0
                                        const updateDepo = await pool.query(
                                            `UPDATE maliyet_urun_birim_fiyat SET bom_fiyat=${data.bom_fiyat} WHERE urun_kodu='${data.kod}'`)
                                    }
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error("Error processing each item in tigerDepo:", error);
                }
            }

            let siparisUrunler = await pool.query(`SELECT urun_kodu as kodu,urun_aciklama FROM maliyet_satis_urun`)
            if (siparisUrunler.rowCount > 0) {
                for (let item of siparisUrunler.rows) {
                    const eskiVeriBirimFiyatQuery = `SELECT * FROM maliyet_urun_birim_fiyat WHERE urun_kodu = '${item.kodu}' `;
                    let eskiVeriBirimFiyatRequest;
                    try {
                        eskiVeriBirimFiyatRequest = await pool.query(eskiVeriBirimFiyatQuery);
                    } catch (error) {
                        console.error("Error checking for existing birim fiyat data:", error);
                    }

                    if (eskiVeriBirimFiyatRequest.rowCount == 0) {
                        const urunTekilInsert = `INSERT INTO maliyet_urun_birim_fiyat (urun_kodu) VALUES($1)`;
                        try {
                            await pool.query(urunTekilInsert, [item.kodu]);
                        } catch (error) {
                            console.error("Error inserting new birim fiyat:", error);
                        }
                        await sasCekMaliyet(cari_yil, item.kodu);
                    }
                    if (!/(100\.%|800\.%|200\.%|300\.|400\.|500\.|600|700|53\*\*-)/.test(item.kodu)) {
                        const bomVar = await pool.query(`SELECT * FROM maliyet_bom WHERE ana_urun ='${item.kodu}'`);

                        if (bomVar.rowCount == 0) {

                            veri = await bomCek(item.kodu, cari_yil);

                        }
                    }
                }
            }
        }

        res.status(200).json({ status: 200 });
    } catch (error) {
        console.error("Error in depoCekMaliyet function:", error);
        res.status(400).json({ error: error.message });
    }
};

exports.headerGenelGetir = async (req, res) => {
    try {
        const { sirala, search, haricTutulacakDepolar } = req.body;

        // Geçerli kolonları belirleyelim
        const allowedColumns = ['urun_kodu', 'urun_aciklama', 'toplam_miktar', 'birim_fiyat', 'fiyat', 'son_hareket'];
        const siralamaKriterleri = sirala
            ? sirala.split(', ')
                .map(k => k.split(' '))
                .filter(([kolon, yon]) => allowedColumns.includes(kolon) && ['ASC', 'DESC'].includes(yon))
                .map(([kolon, yon]) => `${kolon} ${yon}`)
            : ['fiyat DESC'];

        // Search parametresi ekleme
        let searchQuery = '';
        let searchParam = [];

        if (search) {
            searchQuery = `AND (depo.urun_kodu ILIKE CAST($1 AS TEXT) OR depo.urun_aciklama ILIKE CAST($1 AS TEXT))`;
            searchParam = [`%${search}%`];
        }

        // Hariç tutulacak depo filtresi ekleme
        let depoFilter = '';
        let depoParams = [];
        let paramIndex = search ? 2 : 1; // Eğer search varsa, depo parametreleri 2. parametreden başlar

        if (haricTutulacakDepolar && haricTutulacakDepolar.length > 0) {
            const depoPlaceholders = haricTutulacakDepolar.map((_, i) => `$${paramIndex + i}`).join(', ');
            depoFilter = `AND depo.depo NOT IN (${depoPlaceholders})`;
            depoParams = haricTutulacakDepolar;
        }


        const dataSql = `SELECT SUM(birim.birim_fiyat*depo.depo_miktar) as toplam FROM maliyet_urun_depo depo
INNER JOIN maliyet_urun_birim_fiyat birim ON birim.urun_kodu = depo.urun_kodu  WHERE depo.depo_miktar>0 ${searchQuery} ${depoFilter}`

        let result, digerResult;
        if (searchParam.length === 0 && depoParams.length === 0) {
            result = await pool.query(dataSql);

        } else {
            result = await pool.query(dataSql, [...searchParam, ...depoParams]);


        }


        res.status(200).json({ status: 200, data: result.rows });

    } catch (error) {
        console.error("Error in depoCekMaliyet function:", error);
        res.status(400).json({ error: error.message });
    }
}
exports.headerBomGetir = async (req, res) => {
    try {
        const { sirala, search, haricTutulacakDepolar } = req.body;

        // Geçerli kolonları belirleyelim
        const allowedColumns = ['urun_kodu', 'urun_aciklama', 'toplam_miktar', 'birim_fiyat', 'fiyat', 'son_hareket'];
        const siralamaKriterleri = sirala
            ? sirala.split(', ')
                .map(k => k.split(' '))
                .filter(([kolon, yon]) => allowedColumns.includes(kolon) && ['ASC', 'DESC'].includes(yon))
                .map(([kolon, yon]) => `${kolon} ${yon}`)
            : ['fiyat DESC'];

        // Search parametresi ekleme
        let searchQuery = '';
        let searchParam = [];

        if (search) {
            searchQuery = `AND (depo.urun_kodu ILIKE CAST($1 AS TEXT) OR depo.urun_aciklama ILIKE CAST($1 AS TEXT))`;
            searchParam = [`%${search}%`];
        }

        // Hariç tutulacak depo filtresi ekleme
        let depoFilter = '';
        let depoParams = [];
        let paramIndex = search ? 2 : 1; // Eğer search varsa, depo parametreleri 2. parametreden başlar

        if (haricTutulacakDepolar && haricTutulacakDepolar.length > 0) {
            const depoPlaceholders = haricTutulacakDepolar.map((_, i) => `$${paramIndex + i}`).join(', ');
            depoFilter = `AND depo.depo NOT IN (${depoPlaceholders})`;
            depoParams = haricTutulacakDepolar;
        }


        const dataSql = `SELECT SUM(toplam_miktar*birim_fiyat) as toplam
        FROM (
            SELECT 
                SUM(depo.depo_miktar) AS toplam_miktar,
                depo.urun_kodu,
                CASE 
                    WHEN EXISTS (SELECT 1 FROM maliyet_bom bom WHERE bom.kod = depo.urun_kodu) 
                    THEN ROUND(CAST((
                        SELECT fiyat.birim_fiyat 
                        FROM maliyet_urun_birim_fiyat fiyat 
                        WHERE fiyat.urun_kodu = depo.urun_kodu
                    ) AS NUMERIC), 2)
                    ELSE NULL
                END AS birim_fiyat
            FROM maliyet_urun_depo depo
            WHERE depo.urun_kodu NOT LIKE 'S%'  ${searchQuery} ${depoFilter}
            GROUP BY depo.urun_kodu
        ) depo `

        let result, digerResult;
        if (searchParam.length === 0 && depoParams.length === 0) {
            result = await pool.query(dataSql);

        } else {
            result = await pool.query(dataSql, [...searchParam, ...depoParams]);


        }



        res.status(200).json({ status: 200, data: result.rows });

    } catch (error) {
        console.error("Error in depoCekMaliyet function:", error);
        res.status(400).json({ error: error.message });
    }
}
exports.headerDigerGetir = async (req, res) => {
    try {
        const { sirala, search, haricTutulacakDepolar } = req.body;
        // Geçerli kolonları belirleyelim
        const allowedColumns = ['urun_kodu', 'urun_aciklama', 'toplam_miktar', 'birim_fiyat', 'fiyat', 'son_hareket'];
        const siralamaKriterleri = sirala
            ? sirala.split(', ')
                .map(k => k.split(' '))
                .filter(([kolon, yon]) => allowedColumns.includes(kolon) && ['ASC', 'DESC'].includes(yon))
                .map(([kolon, yon]) => `${kolon} ${yon}`)
            : ['fiyat DESC'];

        // Search parametresi ekleme
        let searchQuery = '';
        let searchParam = [];

        if (search) {
            searchQuery = `AND (depo.urun_kodu ILIKE CAST($1 AS TEXT) OR depo.urun_aciklama ILIKE CAST($1 AS TEXT))`;
            searchParam = [`%${search}%`];
        }

        // Hariç tutulacak depo filtresi ekleme
        let depoFilter = '';
        let depoParams = [];
        let paramIndex = search ? 2 : 1; // Eğer search varsa, depo parametreleri 2. parametreden başlar

        if (haricTutulacakDepolar && haricTutulacakDepolar.length > 0) {
            const depoPlaceholders = haricTutulacakDepolar.map((_, i) => `$${paramIndex + i}`).join(', ');
            depoFilter = `AND depo.depo NOT IN (${depoPlaceholders})`;
            depoParams = haricTutulacakDepolar;
        }


        const dataSql = `SELECT SUM(sum) as toplam FROM(
            SELECT                
                depo.urun_kodu,
				SUM(depo.depo_miktar*birim.birim_fiyat),
                EXISTS (SELECT 1 FROM maliyet_bom bom WHERE bom.kod = depo.urun_kodu)      
            FROM maliyet_urun_depo depo
			INNER JOIN maliyet_urun_birim_fiyat birim ON depo.urun_kodu = birim.urun_kodu
            WHERE depo.urun_kodu NOT LIKE 'S%' ${searchQuery} ${depoFilter}
            GROUP BY depo.urun_kodu 
     ) depo WHERE exists=false `

        let result;
        if (searchParam.length === 0 && depoParams.length === 0) {
            result = await pool.query(dataSql);

        } else {
            result = await pool.query(dataSql, [...searchParam, ...depoParams]);


        }


        res.status(200).json({ status: 200, data: result.rows });


    } catch (error) {
        console.error("Error in depoCekMaliyet function:", error);
        res.status(400).json({ error: error.message });
    }
}
exports.getGenelStokVeriLimits = async (req, res) => {
    try {
        const { sirala, search, haricTutulacakDepolar, limit, offset } = req.body;
        // Geçerli kolonları belirleyelim
        const allowedColumns = ['urun_kodu', 'urun_aciklama', 'toplam_miktar', 'birim_fiyat', 'toplam_fiyat', 'bom_fiyat', 'islem_suresi', 'son_hareket'];
        const siralamaKriterleri = sirala
            ? sirala.split(', ')
                .map(k => k.split(' '))
                .filter(([kolon, yon]) => allowedColumns.includes(kolon) && ['ASC', 'DESC'].includes(yon))
                .map(([kolon, yon]) => `${kolon} ${yon}`)
            : ['toplam_fiyat DESC'];

        // Search parametresi ekleme
        let searchQuery = '';
        let searchParam = [];

        if (search) {
            searchQuery = `AND (depo.urun_kodu ILIKE CAST($1 AS TEXT) OR depo.urun_aciklama ILIKE CAST($1 AS TEXT))`;
            searchParam = [`%${search}%`];
        }

        // Hariç tutulacak depo filtresi ekleme
        let depoFilter = '';
        let depoParams = [];
        let paramIndex = search ? 2 : 1; // Eğer search varsa, depo parametreleri 2. parametreden başlar

        if (haricTutulacakDepolar && haricTutulacakDepolar.length > 0) {
            const depoPlaceholders = haricTutulacakDepolar.map((_, i) => `$${paramIndex + i}`).join(', ');
            depoFilter = `AND depo.depo NOT IN (${depoPlaceholders})`;
            depoParams = haricTutulacakDepolar;
        }


        const dataSql = `
         SELECT CASE
              WHEN EXISTS (SELECT 1 FROM maliyet_bom WHERE urun_kodu = ana_urun) THEN 1 ELSE 0 
          END AS bom_var,
          SUM(ROUND(CAST(depo.toplam_miktar * depo.birim_fiyat AS NUMERIC), 2)) AS toplam_fiyat, 
          depo.birim_fiyat, 
          depo.toplam_miktar, 
          depo.urun_kodu, 
          depo.urun_aciklama,
           depo.son_hareket,
COALESCE(depo.bom_fiyat, 0) AS bom_fiyat ,depo.islem_suresi,
              depo.islem_miktar
      FROM (
          SELECT 
              SUM(depo.depo_miktar) AS toplam_miktar,
              depo.urun_kodu,
              depo.urun_aciklama,
              depo.son_hareket,										
              ROUND(CAST(COALESCE(fiyat.birim_fiyat, 0) AS NUMERIC), 2) AS birim_fiyat,
              fiyat.bom_fiyat,
              fiyat.islem_suresi,
              fiyat.islem_miktar
          FROM maliyet_urun_depo depo
          LEFT JOIN maliyet_urun_birim_fiyat fiyat 
              ON fiyat.urun_kodu = depo.urun_kodu
          WHERE depo.urun_kodu NOT LIKE 'S%' ${searchQuery} ${depoFilter}
          GROUP BY depo.urun_kodu, fiyat.birim_fiyat, depo.son_hareket, depo.urun_aciklama,fiyat.bom_fiyat,
              fiyat.islem_suresi,
              fiyat.islem_miktar
      ) depo
      GROUP BY depo.urun_kodu, depo.son_hareket, depo.urun_aciklama, depo.birim_fiyat, depo.toplam_miktar,  depo.bom_fiyat,
              depo.islem_suresi,
              depo.islem_miktar
      HAVING SUM(depo.toplam_miktar * depo.birim_fiyat) > 0  
     ORDER BY ${siralamaKriterleri.join(', ')} LIMIT ${limit} OFFSET ${offset}

         `
        let result;
        if (searchParam.length === 0 && depoParams.length === 0) {
            result = await pool.query(dataSql);

        } else {
            result = await pool.query(dataSql, [...searchParam, ...depoParams]);


        }


        res.status(200).json({ status: 200, data: result.rows });


    } catch (error) {
        console.error("Error in depoCekMaliyet function:", error);
        res.status(400).json({ error: error.message });
    }
}
const getBirimFiyatRecursive = async (urunKodu, anaUrun, ustKod = null, visited = new Set()) => {
    const key = `${urunKodu}_${anaUrun || 'null'}_${ustKod || 'null'}`;
    if (visited.has(key)) return { maliyet: 0, agac: {} };

    visited.add(key);

    // Önce birim fiyatı çek
    const fiyatQuery = await pool.query(`
        SELECT birim_fiyat, bom_fiyat 
        FROM maliyet_urun_birim_fiyat 
        WHERE urun_kodu = $1
    `, [urunKodu]);

    const satir = fiyatQuery.rows[0];
    let mevcutFiyat = satir?.birim_fiyat;
    let bomFiyat = satir?.bom_fiyat;

    // Eğer bu kodun alt parçası yoksa, doğrudan fiyatı dön
    const altParcaQuery = await pool.query(`
        SELECT kod, miktar, ust_kod, ana_urun 
        FROM maliyet_bom 
        WHERE ust_kod = $1 AND ana_urun = $2
    `, [urunKodu, anaUrun]);

    if ((mevcutFiyat ?? null) !== null && altParcaQuery.rowCount === 0) {
        return { maliyet: parseFloat(mevcutFiyat), agac: { [urunKodu]: mevcutFiyat } };
    }

    // Alt parçaları al ve rekürsif maliyet hesapla
    let toplamMaliyet = 0;
    const agac = { [urunKodu]: {} };

    for (const { kod, miktar, ust_kod, ana_urun: altAnaUrun } of altParcaQuery.rows) {
        const miktarDegeri = miktar || 1;
        const { maliyet: altMaliyet, agac: altAgac } = await getBirimFiyatRecursive(kod, altAnaUrun, ust_kod, visited);
        toplamMaliyet += altMaliyet * miktarDegeri;
        agac[urunKodu][kod] = {
            miktar: miktarDegeri,
            maliyet: altMaliyet,
            alt: altAgac[kod] || {},
        };
    }

    // Bu kodun maliyetini veritabanına yaz (bom_fiyat)
    await pool.query(`
        INSERT INTO maliyet_urun_birim_fiyat (urun_kodu, bom_fiyat)
        VALUES ($1, $2)
        ON CONFLICT (urun_kodu) DO UPDATE SET bom_fiyat = EXCLUDED.bom_fiyat
    `, [urunKodu, toplamMaliyet]);

    return { maliyet: toplamMaliyet, agac };
};


exports.bomGenelToplam = async (req, res) => {
    try {

        const { urun_kodu, haricTutulacakDepolar, search } = req.body
        let depoFilter = '';
        let depoParams = [];
        let paramIndex = urun_kodu ? 2 : 1
        if (haricTutulacakDepolar && haricTutulacakDepolar.length > 0) {
            const depoPlaceholders = haricTutulacakDepolar.map((_, i) => `$${paramIndex + i}`).join(', ');
            depoFilter = `AND depo.depo IN (${depoPlaceholders})`;
            depoParams = haricTutulacakDepolar;
        }

        const anaUrunBomQuery = `
SELECT SUM(toplam_maliyet) as toplam_maliyet FROM( SELECT 
  SUM(depo.depo_miktar) AS toplam_miktar,
  depo.urun_kodu,
  depo.urun_aciklama,
  fiyat.birim_fiyat,
  fiyat.bom_fiyat,
  bom.seviye,
  bom.ust_kod,
  bom.miktar,
  SUM(depo.depo_miktar * 
      COALESCE(fiyat.birim_fiyat, fiyat.bom_fiyat, 0)
     ) AS toplam_maliyet
FROM maliyet_urun_depo depo 
INNER JOIN maliyet_urun_birim_fiyat fiyat ON fiyat.urun_kodu = depo.urun_kodu
INNER JOIN maliyet_bom bom ON bom.kod = depo.urun_kodu
WHERE bom.ana_urun=$1 ${depoFilter}
GROUP BY 
  depo.urun_kodu,
  depo.urun_aciklama,
  fiyat.birim_fiyat,
  fiyat.bom_fiyat,
  bom.seviye,
  bom.ust_kod,
  bom.miktar
) toplam
`;


        let result;
        if (depoParams.length === 0) {
            result = await pool.query(anaUrunBomQuery, [urun_kodu]);

        } else {
            result = await pool.query(anaUrunBomQuery, [urun_kodu, ...depoParams]);


        }

        res.status(200).json({ status: 200, data: result.rows });
    } catch (error) {
        console.error("Error in depoCekMaliyet function:", error);
        res.status(400).json({ error: error.message });
    }
}
function buildBOMTree(rows, rootKod) {
    const items = {};

    // 1. Ürünleri oluştur
    rows.forEach(row => {
        if (!items[row.alt_urun_kodu]) {
            items[row.alt_urun_kodu] = {
                kod: row.alt_urun_kodu,
                urun_aciklama: row.urun_aciklama,
                miktar: row.alt_urun_miktar,
                seviye: row.seviye,

                depo_miktar: row.depo_miktar || 0,
                birim_fiyat: row.birim_fiyat,
                bom_fiyat: row.bom_fiyat,
                children: []
            };
        }
    });

    // 2. Alt ürünleri üst ürünlere bağla
    rows.forEach(row => {
        if (!row.ust_urun_kodu || row.ust_urun_kodu === row.alt_urun_kodu) return;

        if (!items[row.ust_urun_kodu]) {
            items[row.ust_urun_kodu] = {
                kod: row.ust_urun_kodu,
                miktar: 1,
                children: []
            };
        }

        items[row.ust_urun_kodu].children.push(items[row.alt_urun_kodu]);
    });

    // 3. Root item'ı bul (ana ürünün kendisi olan satır)
    const rootData = rows.find(row => row.alt_urun_kodu === rootKod && row.ust_urun_kodu === null);

    // 4. Ana ürünün alt bileşenlerini bul
    const rootChildren = rows
        .filter(row => row.ust_urun_kodu === rootKod && row.alt_urun_kodu !== rootKod)
        .map(row => items[row.alt_urun_kodu]);

    if (!rootData && rootChildren.length === 0) return null;

    const root = {
        kod: rootKod,
        miktar: rootData?.alt_urun_miktar ?? 1,
        urun_aciklama: rootData?.urun_aciklama ?? "",
        depo_miktar: rootData?.depo_miktar ?? 0,
        birim_fiyat: rootData?.birim_fiyat ?? null,
        bom_fiyat: rootData?.bom_fiyat ?? null,
        seviye: rootData?.seviye,

        children: rootChildren
    };

    return root;
}

function calculateCost(node) {
    if (!node.children || node.children.length === 0) {
        const price = node.birim_fiyat ?? node.bom_fiyat ?? 0;
        const miktar = node.depo_miktar ?? 0;
        return node.miktar * price;

    }

    let cost = 0;
    for (const child of node.children) {
        cost += calculateCost(child);
    }

    return node.miktar * cost;
}
exports.bomMaliyet = async (req, res) => {
    try {
        const { urun_kodu, haricTutulacakDepolar } = req.body;
        let depoFilter = '';
        let depoParams = [];
        let paramIndex = urun_kodu ? 2 : 1;

        if (haricTutulacakDepolar && haricTutulacakDepolar.length > 0) {
            const depoPlaceholders = haricTutulacakDepolar.map((_, i) => `$${paramIndex + i}`).join(', ');
            depoFilter = `AND depo.depo IN (${depoPlaceholders})`;
            depoParams = haricTutulacakDepolar;
        }

        const anaUrunBomQuery = `
        SELECT 
          bom.kod AS alt_urun_kodu,
          bom.ust_kod AS ust_urun_kodu,
          bom.miktar AS alt_urun_miktar,
          fiyat.birim_fiyat,
          bom.seviye,
          depo.urun_aciklama,
          SUM(depo.depo_miktar) AS depo_miktar,
          fiyat.bom_fiyat
        FROM maliyet_bom bom
        LEFT JOIN maliyet_urun_birim_fiyat fiyat ON fiyat.urun_kodu = bom.kod
        LEFT JOIN maliyet_urun_depo depo ON depo.urun_kodu = bom.kod ${depoFilter}
        WHERE bom.ana_urun = $1
        GROUP BY bom.kod, bom.ust_kod,bom.seviye, bom.miktar, fiyat.birim_fiyat, fiyat.bom_fiyat,depo.urun_aciklama
      `;

        const anaUrunQuery = `
        SELECT 
          depo.urun_aciklama,
          depo.urun_kodu,
          SUM(depo.depo_miktar) AS depo_miktar,
          fiyat.birim_fiyat,
          fiyat.bom_fiyat
        FROM maliyet_urun_depo depo 
        INNER JOIN maliyet_urun_birim_fiyat fiyat ON fiyat.urun_kodu = depo.urun_kodu 
        WHERE depo.urun_kodu = $1 ${depoFilter}
        GROUP BY depo.urun_aciklama, depo.urun_kodu, fiyat.birim_fiyat, fiyat.bom_fiyat
      `;

        let result, anaUrunGetir;

        if (depoParams.length === 0) {
            result = await pool.query(anaUrunBomQuery, [urun_kodu]);
            anaUrunGetir = await pool.query(anaUrunQuery, [urun_kodu]);

            if (anaUrunGetir.rows.length > 0) {
                result.rows.push({
                    alt_urun_kodu: anaUrunGetir.rows[0].urun_kodu,
                    ust_urun_kodu: null,
                    urun_aciklama: anaUrunGetir.rows[0].urun_aciklama,
                    alt_urun_miktar: 1,
                    seviye: 0,
                    birim_fiyat: anaUrunGetir.rows[0].birim_fiyat,
                    depo_miktar: anaUrunGetir.rows[0].depo_miktar,
                    bom_fiyat: anaUrunGetir.rows[0].bom_fiyat
                });
            }

        } else {
            result = await pool.query(anaUrunBomQuery, [urun_kodu, ...depoParams]);
            anaUrunGetir = await pool.query(anaUrunQuery, [urun_kodu, ...depoParams]);

            if (anaUrunGetir.rows.length > 0) {
                result.rows.push({
                    alt_urun_kodu: anaUrunGetir.rows[0].urun_kodu,
                    ust_urun_kodu: null,
                    urun_aciklama: anaUrunGetir.rows[0].urun_aciklama,
                    seviye: 0,

                    alt_urun_miktar: 1,
                    birim_fiyat: anaUrunGetir.rows[0].birim_fiyat,
                    depo_miktar: anaUrunGetir.rows[0].depo_miktar,
                    bom_fiyat: anaUrunGetir.rows[0].bom_fiyat
                });
            }
        }

        const root = buildBOMTree(result.rows, urun_kodu);

        if (!root) {
            return res.status(404).json({
                status: 404,
                message: `BOM ağacı kökü (${urun_kodu}) bulunamadı veya hiç alt bileşeni yok.`
            });
        }

        const totalCost = calculateCost(root);
        root.bom_fiyat = totalCost

        res.status(200).json({ status: 200, data: totalCost, root });
    } catch (error) {
        console.error("Error in depoCekMaliyet function:", error);
        res.status(400).json({ error: error.message });
    }
};
exports.sasCekDeneme = async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM maliyet_urun_birim_fiyat WHERE birim_fiyat is null`)
        // for (let data of result.rows) {
        //     await sasCekMaliyet(225, data.urun_kodu);
        //     // await bomCek(data.urun_kodu, 224);

        // }

        // 2. Sadece birim fiyatı olmayan ana ürünleri çek}
            const bomuOlanUrunler = await pool.query(`
            SELECT DISTINCT ana_urun 
            FROM maliyet_bom

          `);

        for (let { ana_urun } of bomuOlanUrunler.rows) {

            const { maliyet, agac } = await getBirimFiyatRecursive(ana_urun, ana_urun);
            function flattenBOM(data, parentKey = '', path = '') {
                let rows = [];

                // for (const key in data) {
                //   const value = data[key];
                //   const miktar = value.miktar ?? '';
                //   const maliyet = value.maliyet ?? '';
                //   const newPath = path ? `${path} > ${key}` : key;

                //   rows.push({
                //     'Üst Ürün Kodu': parentKey,
                //     'Ürün Kodu': key,
                //     'Miktar': miktar,
                //     'Maliyet': maliyet,
                //     'Yol (Hiyerarşi)': newPath
                //   });

                //   const alt = value.alt;
                //   if (alt && typeof alt === 'object') {
                //     rows = rows.concat(flattenBOM(alt, key, newPath));
                //   }
                // }

                return rows;
              }

            //   // Excel dosyasına yaz
            //   const rows = flattenBOM(agac);
            //   const worksheet = xlsx.utils.json_to_sheet(rows);
            //   const workbook = xlsx.utils.book_new();
            //   xlsx.utils.book_append_sheet(workbook, worksheet, 'BOM');

            //   xlsx.writeFile(workbook, 'bom_hiyerarsi.xlsx');

            //   console.log('Excel dosyası oluşturuldu: bom_hiyerarsi.xlsx');
        }

        res.status(200).json({ status: 200, message: "BOM maliyetleri hesaplandı" });
    } catch (error) {
        console.error("Error in depoCekMaliyet function:", error);
        res.status(400).json({ error: error.message });
    }
}
exports.bomMaliyetCalistir = async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM maliyet_urun_birim_fiyat`)
        for (let data of result.rows) {
            // await sasCekMaliyet(225, data.urun_kodu);
            // await bomCek(data.urun_kodu, 224);
            const ortalamaBirimFiyatHesapla = await pool.query(`UPDATE maliyet_urun_birim_fiyat
                SET birim_fiyat = (
                    SELECT CASE
                        WHEN SUM(sas_miktar) = 0 OR SUM(sas_miktar) IS NULL THEN 0
                        ELSE SUM(carpan) / SUM(sas_miktar)
                    END
                    FROM (
                        SELECT sas_miktar * birim_fiyat AS carpan, sas_miktar
                        FROM maliyet_satin_alma_siparis
                        WHERE urun_kod = '${data.urun_kodu}'
                    ) AS toplam
                )
                WHERE urun_kodu ='${data.urun_kodu}'`)
        }
        const bomuOlanUrunler = await pool.query(`
            SELECT DISTINCT ana_urun 
            FROM maliyet_bom 
            
          `);

        for (let { ana_urun } of bomuOlanUrunler.rows) {
            await pool.query(`
                WITH hesaplama AS (
          SELECT 
            ana_urun, 
            SUM(fiyat.birim_fiyat * miktar) AS toplam_maliyet
          FROM 
            public.maliyet_bom bom
          JOIN 
            maliyet_urun_birim_fiyat fiyat 
          ON 
            bom.kod = fiyat.urun_kodu
          WHERE 
            bom.kod NOT IN (
              SELECT DISTINCT ust_kod 
              FROM public.maliyet_bom 
              WHERE ust_kod IS NOT NULL
            )
            AND ana_urun = $1
          GROUP BY ana_urun
        )
        UPDATE maliyet_urun_birim_fiyat 
        SET bom_fiyat = hesaplama.toplam_maliyet
        FROM hesaplama
        WHERE maliyet_urun_birim_fiyat.urun_kodu = hesaplama.ana_urun
             `, [ana_urun]);
        }
        // 2. Sadece birim fiyatı olmayan ana ürünleri çek}
        //     const bomuOlanUrunler = await pool.query(`
        //     SELECT DISTINCT ana_urun 
        //     FROM maliyet_bom

        //   `);

        // for (let { ana_urun } of bomuOlanUrunler.rows) {

        //     const { maliyet, agac } = await getBirimFiyatRecursive(ana_urun, ana_urun);
        //     function flattenBOM(data, parentKey = '', path = '') {
        //         let rows = [];

        //         // for (const key in data) {
        //         //   const value = data[key];
        //         //   const miktar = value.miktar ?? '';
        //         //   const maliyet = value.maliyet ?? '';
        //         //   const newPath = path ? `${path} > ${key}` : key;

        //         //   rows.push({
        //         //     'Üst Ürün Kodu': parentKey,
        //         //     'Ürün Kodu': key,
        //         //     'Miktar': miktar,
        //         //     'Maliyet': maliyet,
        //         //     'Yol (Hiyerarşi)': newPath
        //         //   });

        //         //   const alt = value.alt;
        //         //   if (alt && typeof alt === 'object') {
        //         //     rows = rows.concat(flattenBOM(alt, key, newPath));
        //         //   }
        //         // }

        //         return rows;
        //       }

        //     //   // Excel dosyasına yaz
        //     //   const rows = flattenBOM(agac);
        //     //   const worksheet = xlsx.utils.json_to_sheet(rows);
        //     //   const workbook = xlsx.utils.book_new();
        //     //   xlsx.utils.book_append_sheet(workbook, worksheet, 'BOM');

        //     //   xlsx.writeFile(workbook, 'bom_hiyerarsi.xlsx');

        //     //   console.log('Excel dosyası oluşturuldu: bom_hiyerarsi.xlsx');
        // }

        res.status(200).json({ status: 200, message: "BOM maliyetleri hesaplandı" });
    } catch (error) {
        console.error("Error in depoCekMaliyet function:", error);
        res.status(400).json({ error: error.message });
    }
}
async function sonHareketBul(cari_yil, urun_kodu) {
    try {
        const mssqlPool = await poolPromises; // MSSQL bağlantısı
        const tigerCariOku = mssqlPool.request();
        const today = new Date(); // Bugünün tarihi
        if (cari_yil) {
            const hareketQuery = await tigerCariOku.query(
                `
           SELECT TOP 1 linee.DATE_ 
         FROM dbo.LG_${cari_yil}_01_STLINE linee  
         WHERE (SELECT LOGICALREF FROM LG_${cari_yil}_ITEMS WHERE CODE ='${urun_kodu}') = linee.STOCKREF 
         AND (linee.TRCODE = 12 OR linee.TRCODE=13)  AND linee.PLNAMOUNT =0
         ORDER BY linee.DATE_ DESC `
            )
            if (hareketQuery.rowsAffected > 0) {
                let hareketResult = hareketQuery.recordsets[0]


                for (let element of hareketResult) {

                    if (element.DATE_) {

                        let lastPurchaseDate = new Date(element.DATE_); // SQL tarihini Date objesine çevir
                        let gunFarki = Math.floor((today - lastPurchaseDate) / (1000 * 60 * 60 * 24)); // Gün farkını hesapla

                        return gunFarki;
                    }


                }
            } else {
                let cariKodlar = [225, 224, 223, 220, 219]
                let kacinci = cariKodlar.findIndex(s => s == cari_yil);
                if (kacinci > -1) {


                    let sonrakiCariKod = cariKodlar[kacinci + 1];
                    if (sonrakiCariKod) {

                        return await sonHareketBul(sonrakiCariKod, urun_kodu);
                    }
                }
            }
        }


    } catch (error) {
        console.error(error)
    }

}
async function sasCekMaliyet(cari_yil, urun_kodu) {
    try {
        const mssqlPool = await poolPromises; // MSSQL connection
        const tigerCariOku = mssqlPool.request();
      
        const siparisCek = await tigerCariOku.query(
            `  SELECT CONVERT(nvarchar, ORF.DATE_, 104) AS tarih,    ORF.DOCODE AS [siparis_kodu], 
								PR.CODE AS [proje_kod],    ITM.CODE AS KOD,    ITM.NAME AS MALZEME,    SUM(ORL.AMOUNT) AS siparis_adet, 
								SUM(ORL.SHIPPEDAMOUNT) AS [karsilanan_siparis],
                                SUM(ORL.AMOUNT - ORL.SHIPPEDAMOUNT) AS [acik_siparis],  
								 (ORL.PRICE*(unt.CONVFACT1/unt.CONVFACT2)) AS birim_fiyat,   
                                    ORL.TRRATE AS 'KUR',
									ORL.USREF,
									ORL.UOMREF,
									ITM.LOGICALREF
                                    FROM
                                    LG_${cari_yil}_01_ORFLINE AS ORL
                                    INNER JOIN LG_${cari_yil}_01_ORFICHE AS ORF ON ORL.ORDFICHEREF = ORF.LOGICALREF
                                    INNER JOIN LG_${cari_yil}_ITEMS AS ITM ON ORL.STOCKREF = ITM.LOGICALREF
                                    INNER JOIN LG_${cari_yil}_ITMUNITA AS unt ON unt.ITEMREF = ITM.LOGICALREF AND unt.UNITLINEREF = ORL.UOMREF
                                    INNER JOIN LG_${cari_yil}_PROJECT AS PR ON ORL.PROJECTREF = PR.LOGICALREF
                                    FULL OUTER JOIN LG_${cari_yil}_PAYPLANS AS PY ON ORL.PAYDEFREF = PY.LOGICALREF
                            WHERE
                                (ORL.LINETYPE = 0)     AND (ORL.TRCODE = 2)     AND ORF.CANCELLED = 0     AND ORL.CLOSED = 0     AND ORF.STATUS = 4    
								AND ITM.CODE LIKE '${urun_kodu}%'	AND ORL.PRICE>0  AND (
                                                                                            CHARINDEX('-', ORF.DOCODE) = 0
                                                                                            OR LEN(ORF.DOCODE) - CHARINDEX('-', ORF.DOCODE) <= 3
                                                                                        )
                            GROUP BY
                                ORF.DOCODE,
                                CONVERT(nvarchar, ORF.DATE_, 104),
                                PR.CODE,    ITM.CODE,  ITM.LOGICALREF,  ITM.NAME,  	ORL.USREF,
									ORL.UOMREF,unt.CONVFACT1,unt.CONVFACT2 ,  PY.CODE,    ORL.PRICE,    ORL.TRCURR,    ORF.TRCURR,    ORL.TRRATE,    ORF.GROSSTOTAL,    ORF.TOTALVAT,    ORF.NETTOTAL

                            UNION ALL

                            SELECT
                                CONVERT(nvarchar, ORF.DATE_, 104) AS tarih,     ORF.DOCODE AS [siparis_kodu],     PR.CODE AS [proje_kod],     ITM.CODE AS KOD,  
								ITM.DEFINITION_ AS MALZEME,     SUM(ORL.AMOUNT) AS [SİPARİŞ ADETİ],     SUM(ORL.SHIPPEDAMOUNT) AS [karsilanan_siparis],  
								SUM(ORL.AMOUNT - ORL.SHIPPEDAMOUNT) AS [acik_siparis],  
								ORL.PRICE AS birim_fiyat, 
                                 
                                ORL.TRRATE AS 'KUR',
									ORL.USREF,
									ORL.UOMREF,
									ITM.LOGICALREF
                            FROM
                                LG_${cari_yil}_01_ORFLINE AS ORL
                                INNER JOIN LG_${cari_yil}_01_ORFICHE AS ORF ON ORL.ORDFICHEREF = ORF.LOGICALREF
                                INNER JOIN LG_${cari_yil}_SRVCARD AS ITM ON ORL.STOCKREF = ITM.LOGICALREF
                                INNER JOIN LG_${cari_yil}_PROJECT AS PR ON ORL.PROJECTREF = PR.LOGICALREF
                                FULL OUTER JOIN LG_${cari_yil}_PAYPLANS AS PY ON ORL.PAYDEFREF = PY.LOGICALREF
                            WHERE
                                (ORL.LINETYPE = 4)     AND (ORL.TRCODE = 2)     AND ORF.CANCELLED = 0     AND ORL.CLOSED = 0   
								AND ORF.STATUS = 4     AND ITM.CODE LIKE '${urun_kodu}%'	AND ORL.PRICE>0  AND (
                                                                                                                    CHARINDEX('-', ORF.DOCODE) = 0
                                                                                                                    OR LEN(ORF.DOCODE) - CHARINDEX('-', ORF.DOCODE) <= 3
                                                                                                                )
                                GROUP BY
                                ORF.DOCODE,    CONVERT(nvarchar, ORF.DATE_, 104),  	ORL.USREF,
									ORL.UOMREF,ITM.LOGICALREF,  PR.CODE,    ITM.CODE,    ITM.DEFINITION_,     PY.CODE,    ORL.PRICE,    ORL.TRCURR,    ORF.TRCURR,    ORL.TRRATE,    ORF.GROSSTOTAL,    ORF.TOTALVAT,    ORF.NETTOTAL
                            ORDER BY tarih
`
        )

        if (siparisCek.recordset && siparisCek.rowsAffected > 0) {

            let satinAlmaSiparis = siparisCek.recordsets[0];
            for (let data of satinAlmaSiparis) {
                const parts = data.tarih.split(".");
                const month = parseInt(parts[1], 10);
                const year = parseInt(parts[2], 10);
                const indexCarpanResult = await pool.query(indexSearch, [year, month]);

                const siparisSayisi = await pool.query(`SELECT * FROM  maliyet_satin_alma_siparis WHERE urun_kod =$1`, [urun_kodu]);
                const siparisVarmi = await pool.query(`SELECT * FROM  maliyet_satin_alma_siparis WHERE urun_kod =$1 AND sas_kod = $2`, [urun_kodu, data.siparis_kodu]);

                if (siparisSayisi.rowCount <= 5 && siparisVarmi.rowCount == 0) {

                    let indexs = indexCarpanResult.rows[0] ? indexCarpanResult.rows[0].index : 1;

                    const insertSuccess = await insertOrUpdate(`INSERT INTO maliyet_satin_alma_siparis(
                        urun_kod, urun_aciklama, sas_tarih, sas_kod, sas_miktar, birim_fiyat) 
                        VALUES($1,$2,$3,$4,$5,$6)`, [urun_kodu, data.MALZEME, data.tarih, data.siparis_kodu, data.siparis_adet, (data.birim_fiyat * indexs)]
                    );

                    if (insertSuccess) {
                        await insertOrUpdate(`UPDATE maliyet_urun_birim_fiyat SET birim_fiyat = (
                            SELECT CASE
                                WHEN SUM(sas_miktar) = 0 OR SUM(sas_miktar) IS NULL THEN 0
                                ELSE SUM(carpan) / SUM(sas_miktar)
                            END
                            FROM (
                                SELECT sas_miktar * birim_fiyat AS carpan, sas_miktar
                                FROM maliyet_satin_alma_siparis
                                WHERE urun_kod = '${urun_kodu}'
                            ) AS toplam
                        )
                        WHERE urun_kodu ='${urun_kodu}'`);
                    }
                }
            }
        }

        let siparisSayisi = await pool.query(`SELECT COUNT(urun_kod) as say FROM  maliyet_satin_alma_siparis WHERE urun_kod =$1`, [urun_kodu]);
        let cariKodlar = [225, 224, 223, 220, 219, '018', '017'];
        let kacinci = cariKodlar.findIndex(s => s == cari_yil);

        if (kacinci > -1 && kacinci < cariKodlar.length - 1) {
            let sonrakiCariKod = cariKodlar[kacinci + 1];
            
            if (kacinci <= 3) {
                // İlk 4 cari kod için (225,224,223,220)
                if (siparisSayisi.rows[0].say <= 5) {
                    sasCekMaliyet(sonrakiCariKod, urun_kodu);
                }
            } else {
                // Son 3 cari kod için (219,'018','017')
                if (siparisSayisi.rows[0].say == 0) {
                    sasCekMaliyet(sonrakiCariKod, urun_kodu);
                }
            }
        }

    } catch (error) {
        console.error(error);
    }
}
async function insertOrUpdate(query, params) {
    try {
        const result = await pool.query(query, params);
        return result.rowCount > 0;
    } catch (error) {
        console.error("Error in insertOrUpdate:", error);
        return false;
    }
}
async function bomCek(code, cari_yil) {
    const mssqlPool = await poolPromises; // MSSQL connection
    const tigerCariOku = mssqlPool.request();
    const visitedCodes = new Set();
    const cariKodlar = [224, 225, 223, 220, 219];
    const fetchBomData = async (kod, yil, seviye) => {
        const key = `${code}-${kod}-${yil}`;
        if (visitedCodes.has(key)) return;
        visitedCodes.add(key);

        const bomQuery = await tigerCariOku.query(`
            SELECT     line.OPERATIONREF,
 item.CODE as ana_urun,
    item.NAME as ana_urun_aciklama,item.LOGICALREF,bom.LOGICALREF,line.AMOUNT, 
 (SELECT NAME FROM LG_${yil}_ITEMS WHERE LOGICALREF = line.ITEMREF) AS NAME,
    (SELECT CODE FROM LG_${yil}_ITEMS WHERE LOGICALREF = line.ITEMREF) AS CODE
FROM LG_${yil}_ITEMS item 
INNER JOIN LG_${yil}_BOMASTER bom ON bom.MAINPRODREF=item.LOGICALREF and bom.ACTIVE = 0
INNER JOIN LG_${yil}_BOMLINE line ON line.BOMMASTERREF = bom.LOGICALREF
WHERE item.CODE ='${kod}'
          
        `);
        let operasyonID = []
        if (bomQuery.rowsAffected > 0 && bomQuery.recordset.length > 0) {
            for (let op of bomQuery.recordset) {
                if (operasyonID.length == 0) {
                    operasyonID.push(op.OPERATIONREF)
                } else {
                    let ara = operasyonID.filter(s => {
                        return s == op.OPERATIONREF
                    })
                    if (ara.length == 0) {
                        operasyonID.push(op.OPERATIONREF)
                    }
                }
            }
            // const operasyonRef = bomQuery.recordset[0].OPERATIONREF;
            // Operasyon bilgileri
            const opIDsString = operasyonID.join(',');

            const timeQuery = await tigerCariOku.query(`
                    

SELECT 
    worksta.NAME AS istasyonname, 
    worksta.CODE AS istasyonkod,
 (
        COALESCE(SUM(opq.HEADTIME), 0) +
        COALESCE(SUM(opq.WAITBATCHTIME / NULLIF(opq.WAITBATCHQTY, 0)), 0) +
        COALESCE(SUM(opq.FIXEDSETUPTIME), 0) +
        COALESCE(SUM(opq.RUNTIME / NULLIF(opq.BATCHQUANTITY, 0)), 0)
    ) AS islemzaman   FROM 
    LG_${yil}_OPRTREQ opq 
INNER JOIN 
    LG_${yil}_WORKSTAT worksta 
    ON worksta.LOGICALREF = opq.WSREF 
WHERE 
    opq.OPERATIONREF IN (${opIDsString})
GROUP BY 
    worksta.NAME,     worksta.CODE
                `);

            if (timeQuery.rowsAffected > 0 && timeQuery.recordset.length > 0) {
                const op = timeQuery.recordset[0];
                await insertOrUpdate(`
    INSERT INTO maliyet_urun_birim_fiyat (urun_kodu, istasyon, islem_suresi)
    VALUES ($1, $2, $3)
    ON CONFLICT (urun_kodu) DO UPDATE
    SET islem_suresi = EXCLUDED.islem_suresi,
        islem_miktar = EXCLUDED.islem_miktar,
        istasyon = EXCLUDED.istasyon
`, [kod, op.istasyonname, op.islemzaman]);
            }
            // BOM ürünleri
            for (let element of bomQuery.recordset) {

                if (kod != element.CODE) {
                    let varMi = await pool.query(`SELECT * FROM maliyet_bom bom WHERE ana_urun = $1 AND ust_kod = $2 AND kod = $3`, [code, kod, element.CODE])
                    if (varMi.rowCount == 0) {
                        await insertOrUpdate(`
                            INSERT INTO maliyet_bom (ust_kod, ust_malzeme, kod, malzeme, miktar, ana_urun,seviye)
                            VALUES ($1, $2, $3, $4, $5, $6,$7)
                        `, [kod, element.ana_urun_aciklama, element.CODE, element.NAME, element.AMOUNT, code, seviye]);
                        const eskiVeriBirimFiyatQuery = `SELECT * FROM maliyet_urun_birim_fiyat WHERE urun_kodu = '${element.CODE}' `;
                        let eskiVeriBirimFiyatRequest;
                        try {
                            eskiVeriBirimFiyatRequest = await pool.query(eskiVeriBirimFiyatQuery);
                        } catch (error) {
                            console.error("Error checking for existing birim fiyat data:", error);
                        }
                        if (eskiVeriBirimFiyatRequest.rowCount == 0) {
                            const urunTekilInsert = `INSERT INTO maliyet_urun_birim_fiyat (urun_kodu) VALUES($1)`;
                            try {
                                await pool.query(urunTekilInsert, [element.CODE]);
                            } catch (error) {
                                console.error("Error inserting new birim fiyat:", error);
                            }
                            await sasCekMaliyet(225, element.CODE);
                        }
                        // Alt BOM’ları kontrol et (bazı kodları dışla)
                        if (!/(100\.%|800\.%|200\.%|300\.|400\.|500\.|600|700|53\*\*-)/.test(element.CODE)) {
                            await fetchBomData(element.CODE, cari_yil, seviye + 1);  // <-- SEVİYE + 1
                        }
                    }

                }
            }
        } else {
            // BOM yoksa, bir sonraki yıl kodunu dene
            const currentIndex = cariKodlar.indexOf(yil);
            if (currentIndex !== -1 && currentIndex + 1 < cariKodlar.length) {
                await fetchBomData(kod, cariKodlar[currentIndex + 1], seviye);  // <-- SEVİYE sabit
            }
        }


    };
    await fetchBomData(code, cari_yil, 0);


    // 2. Hesaplanan birim_fiyat'ı bom_fiyat olarak ata



}



// async function bomCek(code, cari_yil) {
//     const mssqlPool = await poolPromises; // MSSQL connection
//     const tigerCariOku = mssqlPool.request();
//     let cari_yil2 = cari_yil;

//     const visitedCodes = new Set();

//     const fetchBomData = async (kod) => {
//         const key = `${kod}-${cari_yil2}`;
//         if (visitedCodes.has(key)) return [];
//         visitedCodes.add(key);

//         const msqlBomListQuery = await tigerCariOku.query(`
//             SELECT line.OPERATIONREF, item.CODE as ana_urun, item.NAME as ana_urun_aciklama, line.AMOUNT,
//                    (SELECT NAME FROM LG_${cari_yil2}_ITEMS WHERE LOGICALREF = line.ITEMREF) AS NAME,
//                    (SELECT CODE FROM LG_${cari_yil2}_ITEMS WHERE LOGICALREF = line.ITEMREF) AS CODE
//             FROM LG_${cari_yil2}_BOMASTER bom
//             INNER JOIN LG_${cari_yil2}_ITEMS item ON item.CODE = '${kod}' AND bom.MAINPRODREF = item.LOGICALREF
//             INNER JOIN LG_${cari_yil2}_BOMLINE line ON line.BOMMASTERREF = bom.LOGICALREF
//             WHERE bom.ACTIVE = 0 AND bom.BOMTYPE = 1
//         `);

//         if (msqlBomListQuery.rowsAffected > 0) {
//             let operasyonRef = msqlBomListQuery.recordset[0].OPERATIONREF;
//             const msqlBomListTimeQuery = await tigerCariOku.query(`
//                 SELECT worksta.NAME as istasyonname, worksta.CODE as istasyonkod,
//                 opq.FIXEDSETUPTIME as hazirlik, opq.RUNTIME as islemzaman, opq.BATCHQUANTITY as islem_miktari,
//                 opq.WAITBATCHTIME as makinazamani, opq.WAITBATCHQTY as makinapartimiktari, opq.HEADTIME as oponcesibekleme
//                 FROM LG_${cari_yil2}_OPRTREQ opq
//                 INNER JOIN LG_${cari_yil2}_WORKSTAT worksta ON worksta.LOGICALREF=opq.WSREF
//                 WHERE ${operasyonRef}= opq.OPERATIONREF
//             `);

//             if (msqlBomListTimeQuery.rowsAffected > 0) {
//                 await insertOrUpdate(`UPDATE maliyet_urun_birim_fiyat SET istasyon=$2, islem_suresi=$3, islem_miktar=$4 WHERE urun_kodu = $1`,
//                     [kod, msqlBomListTimeQuery.recordset[0].istasyonname, msqlBomListTimeQuery.recordset[0].islemzaman, msqlBomListTimeQuery.recordset[0].islem_miktari]);

//                 return msqlBomListQuery.recordset;
//             } else {
//                 return [];
//             }
//         } else {
//             return [];
//         }
//     };

//     const processBomLevel = async (bomList, level) => {
//         const result = [];
//         for (const element of bomList) {
//             element.level = level;
//             if (element.CODE && element.CODE !== element.ana_urun) {
//                 const eskiVeriBirimFiyatQuery = `SELECT * FROM maliyet_urun_birim_fiyat WHERE urun_kodu = '${element.CODE}' `;
//                 const eskiVeriBirimFiyatRequest = await pool.query(eskiVeriBirimFiyatQuery);

//                 if (eskiVeriBirimFiyatRequest.rowCount == 0) {
//                     const urunTekilInsert = `INSERT INTO maliyet_urun_birim_fiyat (urun_kodu) VALUES($1)`;
//                     await insertOrUpdate(urunTekilInsert, [element.CODE]);
//                     await sasCekMaliyet(225, element.CODE);
//                 } else {
//                     if (eskiVeriBirimFiyatRequest.rows[0].birim_fiyat == 0 || !eskiVeriBirimFiyatRequest.rows[0].birim_fiyat) {
//                         await sasCekMaliyet(225, element.CODE);
//                     }
//                 }
//                 const subComponentData = await fetchBomData(element.CODE);
//                 const processedSubComponents = await processBomLevel(subComponentData, level + 1);
//                 result.push(...processedSubComponents);
//             }
//         }
//         result.push(...bomList);
//         return result;
//     };

//     const initialBomList = await fetchBomData(code);
//     const bomlist = await processBomLevel(initialBomList, 0);

//     if (!bomlist || bomlist.length === 0) {
//         const cariKodlar = [225, 224, 223, 220, 219];
//         const currentIndex = cariKodlar.findIndex(y => y == cari_yil);

//         if (currentIndex !== -1 && currentIndex + 1 < cariKodlar.length) {
//             return await bomCek(code, cariKodlar[currentIndex + 1]);
//         } else {
//             return;
//         }
//     }

//     await pool.query(`DELETE FROM maliyet_bom WHERE ana_urun = '${code}' `);

//     for (const element of bomlist) {
//         const veriVarMi = await pool.query(
//             `SELECT * FROM maliyet_bom WHERE ana_urun = $1 AND kod  = $2`,
//             [code, element.CODE]
//         );

//         if (veriVarMi.rowCount === 0) {
//             await insertOrUpdate(` INSERT INTO maliyet_bom (ust_kod, ust_malzeme, kod, malzeme, miktar, seviye, ana_urun)
//                 VALUES ('${element.ana_urun}', '${element.ana_urun_aciklama}', '${element.CODE}', '${element.NAME}', ${element.AMOUNT}, ${element.level}, '${code}')`);
//         }
//     }
// }