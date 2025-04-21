

const pool = require('../db');
const path = require('path');
const transliteration = require('transliteration');
const { sqls, poolPromises } = require('../portal_Tiger_db');
const multer = require('multer');
const express = require('express');
const router = express.Router();

const cors = require('cors');
router.use(cors());
exports.maliyetIndexInsert = (req, res) => {
    const { data } = req.body;
    try {
        data.forEach(async element => {
            console.log(element)
            await pool.query(insertMaliyetIndex, [element.yil, element.ay, element.index])
        });
        res.status(200).json({ status: 200 })
    } catch (error) {
        res.status(400).json(error)
    }
};
const insertMaliyetIndex = `INSERT INTO maliyet_enflansyon_index (yil, ay, aylik_index) VALUES ($1,$2,$3)`

const sonIndexQuery = `SELECT aylik_index as index FROM maliyet_enflansyon_index 
WHERE (yil, ay) = (
    SELECT yil, ay 
    FROM maliyet_enflansyon_index 
    ORDER BY yil DESC, ay DESC 
    LIMIT 1
);`
const indexSearch = `SELECT (SELECT aylik_index as index FROM maliyet_enflansyon_index 
WHERE (yil, ay) = (
    SELECT yil, ay 
    FROM maliyet_enflansyon_index 
    ORDER BY yil DESC, ay DESC 
    LIMIT 1
))/aylik_index as index FROM maliyet_enflansyon_index 
WHERE yil = $1 AND ay=$2`


const urunKontrolVarmiQuery = `SELECT urun_kodu FROM maliyet_urun_birim_fiyat WHERE urun_kodu = $1`
const urunTekilInsert = `INSERT INTO maliyet_urun_birim_fiyat (urun_kodu) VALUES($1)`
const depoInsertTigerQuery = `INSERT INTO maliyet_urun_depo(urun_kodu, urun_aciklama, depo_miktar,depo,son_hareket) VALUES ($1, $2, $3,$4,$5)`
const depoUpdateTigerQuery = `UPDATE maliyet_urun_depo SET son_hareket =$2 WHERE urun_kodu = $1`
exports.depoCek = async (req, res) => {
    const { data } = req.body;
    try {
        const resultPortal = await pool.query(`SELECT * FROM portal_tiger_aktif_cari`)
        const cari_yil = resultPortal.rows[0].yil

        const mssqlPool = await poolPromises; // MSSQL bağlantısı
        const tigerCariOku = mssqlPool.request();

        const selectTigerDepoQuery = `
        SELECT ITM.CODE AS KODU, (SELECT TOP 1 linee.DATE_ 
     FROM dbo.LG_225_01_STLINE linee  
     WHERE ITM.LOGICALREF = linee.STOCKREF 
     AND (linee.TRCODE = 12 OR linee.TRCODE = 13)  AND linee.PLNAMOUNT =0
     ORDER BY linee.DATE_ DESC) AS SON_ALIM_TARIHI, ITM.NAME AS MALZEME, DP.NAME AS DEPO, 
               ROUND(SUM(ST.ONHAND), 1) AS miktar, UNI.NAME AS BİRİM
        FROM dbo.LV_${cari_yil}_01_STINVTOT AS ST WITH (NOLOCK)
        INNER JOIN dbo.LG_${cari_yil}_ITEMS AS ITM WITH (NOLOCK) ON ST.STOCKREF = ITM.LOGICALREF
        INNER JOIN dbo.L_CAPIWHOUSE AS DP WITH (NOLOCK) ON ST.INVENNO = DP.NR
        INNER JOIN dbo.LG_${cari_yil}_UNITSETF AS UNI WITH (NOLOCK) ON ITM.UNITSETREF = UNI.LOGICALREF
        WHERE ITM.ACTIVE = 0 AND DP.FIRMNR = ${cari_yil} AND ITM.CODE NOT LIKE 'S %'
        GROUP BY ITM.CODE, ITM.NAME, DP.NAME, ST.INVENNO, UNI.NAME ,ITM.LOGICALREF;
    `;
        const depoAdetResult = await tigerCariOku.query(selectTigerDepoQuery);
        let depo = depoAdetResult.recordsets[0]
        const deleteDepo = await pool.query(`DELETE FROM maliyet_urun_depo`)
        const today = new Date(); // Bugünün tarihi

        for (const element of depo) {
            if (element.SON_ALIM_TARIHI) {
                let lastPurchaseDate = new Date(element.SON_ALIM_TARIHI); // SQL tarihini Date objesine çevir
                let gunFarki = Math.floor((today - lastPurchaseDate) / (1000 * 60 * 60 * 24)); // Gün farkını hesapla

                await pool.query(depoInsertTigerQuery, [element.KODU, element.MALZEME, element.miktar, element.DEPO, gunFarki]);
            } else {


                await pool.query(depoInsertTigerQuery, [element.KODU, element.MALZEME, element.miktar, element.DEPO, null]); // Eğer tarih yoksa NULL olarak kaydet
                await sonHareketBul(225, element.KODU)
            }
            const urunVarMi = await pool.query(urunKontrolVarmiQuery, [element.KODU]);
            if (urunVarMi.rowCount == 0) {
                await pool.query(urunTekilInsert, [element.KODU]);
                await sasCekMaliyet(cari_yil, element.KODU);
            }
            if (!/(100\.%|800\.%|200\.%|300\.|400\.|500\.|600|700|53\*\*-)/.test(element.KODU)) {
                const bomVar = await pool.query(`SELECT * FROM maliyet_bom WHERE ana_urun ='${element.KODU}'`)
                if (bomVar.rowCount == 0) {
                    veri = await bomCek(element.KODU, cari_yil)
                }
            }

        }
        res.status(200).json({
            status: 200
        })
    } catch (error) {
        res.status(400).json(error)
    }
    //  finally {
    //     // Bağlantıyı kapat
    //     if (mssqlPool) {
    //         await mssqlPool.close();
    //        
    //     }
    // }
};
// exports.maliyetGuncelle = async (req, res) => {
//     try {
//         const resultPortal = await pool.query(`SELECT * FROM portal_tiger_aktif_cari`)
//         const cari_yil = resultPortal.rows[0].yil
//         const result = await pool.query(`SELECT * FROM maliyet_urun_birim_fiyat`)
//        

//         for (let data of result.rows) {
//             await sasCekMaliyet(cari_yil, data.urun_kodu)
//         }
//         res.status(200).json({ status: 200, data: result })
//     } catch (error) {
//         res.status(400).json({ data: error })
//     }
// };

exports.maliyetGuncelle = async (req, res) => {
    try {
        const resultPortal = await pool.query(`SELECT * FROM portal_tiger_aktif_cari`)
        const cari_yil = resultPortal.rows[0].yil
        const result = await pool.query(`SELECT * FROM maliyet_urun_birim_fiyat`)


        for (let data of result.rows) {
            // await sasCekMaliyet(cari_yil, data.urun_kodu)
            // const mssqlPool = await poolPromises; // MSSQL bağlantısı
            if (!/(100\.%|800\.%|200\.%|300\.|400\.|500\.|600|700|53\*\*-)/.test(data.urun_kodu)) {
                const bomVar = await pool.query(`SELECT * FROM maliyet_bom WHERE ana_urun ='${data.urun_kodu}'`)
                if (bomVar.rowCount == 0) {
                    veri = await bomCek(data.urun_kodu, cari_yil)
                }
            }

            //  const ortalamaBirimFiyatHesapla = await pool.query(`UPDATE maliyet_urun_birim_fiyat
            //     SET birim_fiyat = (
            //         SELECT CASE
            //             WHEN SUM(sas_miktar) = 0 OR SUM(sas_miktar) IS NULL THEN 0
            //             ELSE SUM(carpan) / SUM(sas_miktar)
            //         END
            //         FROM (
            //             SELECT sas_miktar * birim_fiyat AS carpan, sas_miktar
            //             FROM maliyet_satin_alma_siparis
            //             WHERE urun_kod = '${data.urun_kodu}'
            //         ) AS toplam
            //     )
            //     WHERE urun_kodu ='${data.urun_kodu}'`)
            // const bomVarMi = await pool.query(`SELECT * FROM maliyet_urun_birim_fiyat mubf INNER JOIN maliyet_bom mb ON mb.ust_kod = mubf.urun_kodu AND mubf.urun_kodu='${data.urun_kodu}'`)
            // if (bomVarMi.rowCount > 0) {
            //     const updateDepo = await pool.query(`UPDATE maliyet_urun_birim_fiyat SET birim_fiyat=(SELECT SUM(birim_fiyat *miktar )FROM maliyet_bom bom 
            //     INNER JOIN maliyet_urun_birim_fiyat depo
            //     ON depo.urun_kodu= bom.kod AND bom.ust_kod = '${data.urun_kodu}' AND kod!='${data.urun_kodu}') WHERE urun_kodu='${data.urun_kodu}'`)

            // }
        }
        const fazlaBomSil = await pool.query(`DELETE FROM public.maliyet_bom
WHERE ctid IN (
    SELECT ctid FROM (
        SELECT ctid, 
               ROW_NUMBER() OVER (PARTITION BY ust_kod, kod, ana_urun ORDER BY ctid) AS row_num
        FROM public.maliyet_bom
    ) t
    WHERE row_num > 1
);`)
        res.status(200).json({ status: 200, data: result })
    } catch (error) {
        res.status(400).json({ data: error })
        console.log(error)
    }
};

exports.depoOzel = async (req, res) => {
    try {
        const result = await pool.query(`SELECT depo.depo,ROUND(CAST(SUM(fiyat.birim_fiyat*depo.depo_miktar) AS numeric),2) as toplam_fiyat FROM maliyet_urun_depo depo
        INNER JOIN maliyet_urun_birim_fiyat fiyat ON fiyat.urun_kodu= depo.urun_kodu    WHERE depo.urun_kodu NOT LIKE 'S%'  
        GROUP BY depo.depo ORDER BY toplam_fiyat DESC
        `)

        res.status(200).json({ status: 200, data: result.rows })
    } catch (error) {
        res.status(400).json(error)
    }

}
exports.depoSecilenMaliyet = async (req, res) => {
    try {
        const { depo } = req.body
        const result = await pool.query(`SELECT 
    depo.son_hareket,
    ROUND(CAST(fiyat.birim_fiyat * depo.depo_miktar as numeric), 2) AS toplam_fiyat,
    depo.urun_kodu,
    depo.urun_aciklama,
    depo.depo_miktar,
    ROUND(CAST(fiyat.birim_fiyat as numeric), 2) as birim_fiyat
FROM public.maliyet_urun_depo depo
INNER JOIN public.maliyet_urun_birim_fiyat fiyat 
    ON fiyat.urun_kodu = depo.urun_kodu 
WHERE depo.depo = '${depo}' AND  depo.urun_kodu NOT LIKE 'S%' 
AND fiyat.birim_fiyat IS NOT NULL
ORDER BY toplam_fiyat DESC `)

        res.status(200).json({ status: 200, data: result.rows })
    } catch (error) {
        res.status(400).json(error)
    }

}
exports.depolarMaliyet = async (req, res) => {
    try {

        const depoResult = await pool.query(`SELECT DISTINCT depo FROM maliyet_urun_depo order by depo `)

        res.status(200).json({ status: 200, data: depoResult.rows })

    } catch (error) {
        res.status(400).json({ status: 400, data: error })
    }
}
exports.depoHareketAnaliziUrunTur = async (req, res) => {
    try {
        const { search } = req.body
        const depoResult = `SELECT  SUM(depo.depo_miktar * fiyat.birim_fiyat) as toplam_maliyet,    ROUND(CAST(SUM(depo.depo_miktar * fiyat.birim_fiyat) AS numeric),2) AS toplam_fiyat,
           	depo.urun_kodu , depo.son_hareket,depo.urun_aciklama,SUM(depo.depo_miktar) as miktar,fiyat.birim_fiyat
        FROM maliyet_urun_depo depo
        INNER JOIN maliyet_urun_birim_fiyat fiyat 
		ON fiyat.urun_kodu = depo.urun_kodu AND fiyat.birim_fiyat is not null WHERE son_hareket is not null AND depo.urun_kodu like '${search}'
		GROUP BY depo.urun_kodu, depo.son_hareket,urun_aciklama,fiyat.birim_fiyat ORDER BY toplam_maliyet DESC`;

        let result = await pool.query(depoResult);


        // Belirtilen gruplara göre boş bir maliyet listesi oluştur
        const ayGruplari = [1, 2, 3, 4, 5, 6, 9, 12, 18, 24, 36, 48, 60, 72, 84, 96, 108, 130, 150, 180];
        const maliyetGruplari = ayGruplari.map(ay => ({ ay, toplam_fiyat: 0 }));

        // Son hareketleri belirlenen gruplara göre dağıt
        result.rows.forEach(row => {
            const hareketGun = row.son_hareket ?? 0;
            const maliyet = row.toplam_maliyet ?? 0; // ✅ Doğru alan adı kullanıldı!

            let ay = Math.ceil(hareketGun / 30);

            // **Ay değerini en uygun gruba yerleştirme**
            let uygunGrupIndex = ayGruplari.findIndex(grupAy => ay <= grupAy);
            if (uygunGrupIndex === -1) {
                uygunGrupIndex = ayGruplari.length - 1; // En büyük gruba koy
            }

            maliyetGruplari[uygunGrupIndex].toplam_fiyat += maliyet;
        });

        res.status(200).json({ status: 200, data: maliyetGruplari, tablo: result.rows });

    } catch (error) {
        console.error("Hata:", error);
        res.status(400).json({ status: 400, data: error });
    }
};


exports.bomListesiGetir = async (req, res) => {
    try {
        const { ana_urun } = req.body
        const depoResult = `SELECT 
   SUM(birim_fiyat * miktar) AS toplam_fiyat,
   SUM(birim_fiyat * depo_miktar) AS toplam_maliyet,
   MIN(CASE WHEN miktar > 0.01 THEN depo_miktar / miktar END) AS min_oran,
   (SELECT kod FROM (
       SELECT bom.kod, bom.malzeme, depo_miktar / miktar AS oran
       FROM maliyet_bom bom
       INNER JOIN maliyet_urun_depo depo 
           ON depo.urun_kodu = bom.kod
       WHERE bom.ana_urun = $1 AND kod != ust_kod AND miktar > 0.01
       GROUP BY bom.kod, bom.malzeme, bom.miktar, depo.depo_miktar
       ORDER BY oran ASC
       LIMIT 1
   ) AS min_urun) AS min_urun_kod,
   (SELECT malzeme FROM (
       SELECT bom.kod, bom.malzeme, depo_miktar / miktar AS oran
       FROM maliyet_bom bom
       INNER JOIN maliyet_urun_depo depo 
           ON depo.urun_kodu = bom.kod
       WHERE bom.ana_urun =$1 AND kod != ust_kod AND miktar > 0.01
       GROUP BY bom.kod, bom.malzeme, bom.miktar, depo.depo_miktar
       ORDER BY oran ASC
       LIMIT 1
   ) AS min_urun) AS min_urun_malzeme,
   json_agg(stok)
FROM (
    SELECT 
          bom.ust_kod, bom.kod, bom.malzeme, bom.miktar, bom.ana_urun, depo.son_hareket,
          SUM(depo.depo_miktar) AS depo_miktar,
          ROUND(CAST(fiyat.birim_fiyat AS NUMERIC), 2) AS birim_fiyat,
          CASE 
              WHEN EXISTS (
                  SELECT 1 
                  FROM maliyet_bom bom_alt 
                  WHERE bom_alt.ust_kod = bom.kod
              ) THEN 1 
              ELSE 0 
          END AS bom_var
    FROM maliyet_bom bom
    INNER JOIN maliyet_urun_depo depo 
        ON depo.urun_kodu = bom.kod
    INNER JOIN maliyet_urun_birim_fiyat fiyat 
        ON fiyat.urun_kodu = bom.kod
    WHERE bom.ana_urun = $1 AND kod != ust_kod
    GROUP BY bom.ust_kod, bom.kod, bom.malzeme, bom.miktar, bom.ana_urun, depo.son_hareket, fiyat.birim_fiyat 
) stok

`;
        let ihlalDepo = `AND depo NOT IN ('Ankara Ofis Deposu','AR-GE Sivas Deposu','Aselsan Hurda-Fire Yansıtma','Aselsan İade Deposu','Bakım Onarım Deposu','Bilgi İşlem Deposu','Dış Ürün Deposu','ELD Deposu','Genel Kullanım Deposu','İdari İşler Deposu','Kalite Güvence Deposu','Satış Deposu','Test Sistemleri Deposu','Uygunsuzluk Deposu')`
        const anaUrunBomQuery = `
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM maliyet_bom 
            WHERE ust_kod = bom.kod 
            AND bom.kod NOT LIKE 'S%' 
            
        ) THEN NULL
        ELSE ROUND(CAST(fiyat.birim_fiyat AS numeric), 2) * bom.miktar
    END AS urun_maliyet,
    bom.ust_kod, 
    bom.kod, 
    bom.malzeme, 
    bom.miktar, 
    bom.seviye,
    CASE 
        WHEN EXISTS (SELECT 1 FROM maliyet_bom WHERE ust_kod = bom.kod) THEN NULL
        ELSE ROUND(CAST(fiyat.birim_fiyat AS numeric), 2) 
    END AS birim_fiyat,
    COALESCE((SELECT SUM(depo_miktar) FROM maliyet_urun_depo WHERE urun_kodu = bom.kod ${ihlalDepo} ), 0) +
    COALESCE((SELECT SUM(depo_miktar) FROM maliyet_urun_depo WHERE urun_kodu = bom.ana_urun ${ihlalDepo}), 0) * bom.miktar AS depo_miktar 
FROM maliyet_bom bom
INNER JOIN maliyet_urun_birim_fiyat fiyat ON fiyat.urun_kodu = bom.kod
WHERE bom.ana_urun = $1  
AND bom.kod != bom.ust_kod  
AND fiyat.birim_fiyat > 0 
AND fiyat.birim_fiyat IS NOT NULL
AND bom.seviye = (SELECT MIN(seviye) FROM maliyet_bom bom2 WHERE bom2.ana_urun = $1 AND bom2.kod != bom2.ust_kod )
`;

        let resultEski = await pool.query(depoResult, [ana_urun]);
        let urunMaliyetYuzde = resultEski.rows[0].toplam_fiyat * 0.1
        const anaUrunBomResult = await pool.query(anaUrunBomQuery, [ana_urun]);
        const bomListesi = anaUrunBomResult.rows;


        // Alt ürünlerin depo miktarlarını güncelleyen fonksiyon
        const calculateDepoMiktar = (bomListesi) => {
            for (const item of bomListesi) {
                if (item.children && item.children.length > 0) {
                    item.depo_miktar += item.children.reduce((acc, child) => acc + child.depo_miktar, 0);
                }
            }
        };

        const calculateStandardDeviation = (values) => {
            if (values.length === 0) return 0;
            const mean = values.reduce((acc, val) => acc + val, 0) / values.length;
            const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
            return Math.sqrt(variance);
        };


        // En uygun ürünü (standart sapmanın üstündeki ve en düşük depo_miktarına sahip) bulma
        const findOptimalProductAboveStdDev = (bomListesi, stdDev) => {
            const flattenBOM = (list) => {
                return list.reduce((acc, item) => {
                    acc.push(item);
                    if (item.children && item.children.length > 0) {
                        acc = acc.concat(flattenBOM(item.children));
                    }
                    return acc;
                }, []);
            };

            const allProducts = flattenBOM(bomListesi);
            const productsAboveStdDev = allProducts.filter(item => item.urun_maliyet > stdDev);

            if (productsAboveStdDev.length === 0) return null;

            return productsAboveStdDev.reduce((optimal, current) => {
                return (!optimal || current.depo_miktar < optimal.depo_miktar) ? current : optimal;
            }, null);
        };


        // Alt ürünleri al ve her birine children ekle
        const getChildBOM = async (ust_kod) => {
            const childBomQuery = `
                SELECT 
                     CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM maliyet_bom 
            WHERE ust_kod = bom.kod 
            AND bom.kod NOT LIKE 'S%' 
            
        ) THEN NULL
        ELSE ROUND(CAST(fiyat.birim_fiyat AS numeric), 2) * bom.miktar
    END AS urun_maliyet,
                    bom.ust_kod, 
                    bom.kod, 
                    bom.malzeme, 
                    bom.miktar,
                    CASE 
                        WHEN EXISTS (SELECT 1 FROM maliyet_bom WHERE ust_kod = bom.kod AND bom.kod NOT LIKE 'S%') THEN NULL
                        ELSE ROUND(CAST(fiyat.birim_fiyat AS numeric), 2) 
                    END AS birim_fiyat,
                    COALESCE((SELECT SUM(depo_miktar) FROM maliyet_urun_depo WHERE urun_kodu = bom.kod ${ihlalDepo}), 0) as  depo_miktar
                FROM maliyet_bom bom
                INNER JOIN maliyet_urun_birim_fiyat fiyat ON fiyat.urun_kodu = bom.kod
                WHERE bom.ust_kod = $1 
                AND bom.kod != bom.ust_kod  
                AND fiyat.birim_fiyat > 0 
                AND fiyat.birim_fiyat IS NOT NULL 
                AND bom.kod NOT LIKE 'S%' 
                
                GROUP BY bom.ust_kod, bom.kod, bom.malzeme, bom.miktar, fiyat.birim_fiyat
            `;
            const result = await pool.query(childBomQuery, [ust_kod]);
            for (const child of result.rows) {
                child.children = await getChildBOM(child.kod);
            }
            return result.rows;
        };

        // Alt ürünleri ekleyerek ana BOM listesine children ekliyoruz
        for (const item of bomListesi) {
            item.children = await getChildBOM(item.kod);
        }

        // Depo miktarlarını güncelle
        calculateDepoMiktar(bomListesi);
        const getAllUrunMaliyetValues = (bomListesi) => {
            let urunMaliyetValues = [];
            bomListesi.forEach(item => {
                if (item.urun_maliyet) {
                    urunMaliyetValues.push(item.urun_maliyet);
                }
                if (item.children && item.children.length > 0) {
                    item.children.forEach(child => {
                        if (child.urun_maliyet) {
                            urunMaliyetValues.push(child.urun_maliyet);
                        }
                    });
                }
            });
            return urunMaliyetValues;
        };
        // Ürünlerin standart sapmasını hesapla
        const urunMaliyetValues = getAllUrunMaliyetValues(bomListesi);
        const stdDev = calculateStandardDeviation(urunMaliyetValues);

        // Standart sapmanın üzerindeki ürünleri ve en düşük depo miktarına sahip olan ürünü bul
        const optimalProductAboveStdDev = findOptimalProductAboveStdDev(bomListesi, stdDev);


        res.status(200).json({ status: 200, data: resultEski.rows, bom: bomListesi, bomListesi: optimalProductAboveStdDev, standardDeviation: stdDev });

    } catch (error) {
        console.error("Hata:", error);
        res.status(400).json({ status: 400, data: error });
    }
};
exports.depoHareketAnalizi = async (req, res) => {
    try {
        const depoResult = `SELECT 
            SUM(depo.depo_miktar * fiyat.birim_fiyat) AS toplam_maliyet,
            depo.son_hareket
        FROM maliyet_urun_depo depo
        INNER JOIN maliyet_urun_birim_fiyat fiyat ON fiyat.urun_kodu = depo.urun_kodu AND fiyat.birim_fiyat is not null 
        WHERE depo.son_hareket is not null GROUP BY depo.son_hareket`;

        let result = await pool.query(depoResult);


        // Belirtilen gruplara göre boş bir maliyet listesi oluştur
        const ayGruplari = [1, 2, 3, 4, 5, 6, 9, 12, 18, 24, 36, 48, 60, 72, 84, 96, 108, 130, 150, 180];
        const maliyetGruplari = ayGruplari.map(ay => ({ ay, toplam_fiyat: 0 }));

        // Son hareketleri belirlenen gruplara göre dağıt
        result.rows.forEach(row => {
            const hareketGun = row.son_hareket ?? 0;
            const maliyet = row.toplam_maliyet ?? 0; // ✅ Doğru alan adı kullanıldı!

            let ay = Math.ceil(hareketGun / 30);

            // **Ay değerini en uygun gruba yerleştirme**
            let uygunGrupIndex = ayGruplari.findIndex(grupAy => ay <= grupAy);
            if (uygunGrupIndex === -1) {
                uygunGrupIndex = ayGruplari.length - 1; // En büyük gruba koy
            }

            maliyetGruplari[uygunGrupIndex].toplam_fiyat += maliyet;
        });

        res.status(200).json({ status: 200, data: maliyetGruplari });

    } catch (error) {
        console.error("Hata:", error);
        res.status(400).json({ status: 400, data: error });
    }
};
exports.depoToplamMaliyet = async (req, res) => {
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
        const depoResult = `SELECT 
         SUM(ROUND(CAST(fiyat.birim_fiyat * depo.depo_miktar as numeric), 2)) AS depoToplam FROM public.maliyet_urun_depo depo 
    LEFT JOIN public.maliyet_urun_birim_fiyat fiyat 
        ON fiyat.urun_kodu = depo.urun_kodu
    WHERE depo.urun_kodu NOT LIKE 'S%'  ${searchQuery} ${depoFilter}
    AND depo.depo_miktar > 0 
    ORDER BY depoToplam DESC;
    `
        let result;
        if (searchParam.length === 0 && depoParams.length === 0) {
            result = await pool.query(depoResult);
        } else {
            result = await pool.query(depoResult, [...searchParam, ...depoParams]);
        }



        res.status(200).json({ status: 200, depoToplam: result.rows })

    } catch (error) {
        res.status(400).json({ status: 400, data: error })
        console.log(error);
    }
}
exports.depoBOMmaliyet = async (req, res) => {
    try {
        const { sirala, search, haricTutulacakDepolar } = req.body;


        // Geçerli kolonları belirleyelim
        const allowedColumns = ['urun_kodu', 'urun_aciklama', 'toplam_miktar', 'birim_fiyat', 'depo_miktar', 'son_hareket'];
        const siralamaKriterleri = sirala
            ? sirala.split(', ')
                .map(k => k.split(' '))
                .filter(([kolon, yon]) => allowedColumns.includes(kolon) && ['ASC', 'DESC'].includes(yon))
                .map(([kolon, yon]) => `${kolon} ${yon}`)
            : ['depo_miktar DESC '];

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
        const bomKullanilan = `SELECT SUM(ROUND(CAST(toplam_miktar*birim_fiyat AS numeric),2))
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

        let result, satisUygun, hamMadde, yariMamul;
        const satisUygunQuery = `
         SELECT ROUND(cast(SUM(birim_fiyat*miktar) as numeric),2) satis_urun,
            json_agg(depo) as satis_data FROM
            (SELECT * FROM ((SELECT  CASE WHEN  (SELECT COUNT(DISTINCT bom.kod)
FROM maliyet_bom bom

WHERE depo.urun_kodu = bom.ana_urun AND depo.urun_kodu = bom.ust_kod AND depo.urun_kodu != bom.kod) >1
            THEN 1 ELSE 0 
        END AS bom_var,sum(depo.depo_miktar)*(SELECT fiyat.birim_fiyat FROM maliyet_urun_birim_fiyat fiyat WHERE fiyat.urun_kodu = depo.urun_kodu )  as depo_miktar,SUM(depo.depo_miktar) miktar, depo.urun_kodu,depo.urun_aciklama,depo.son_hareket,(SELECT fiyat.birim_fiyat FROM maliyet_urun_birim_fiyat fiyat WHERE fiyat.urun_kodu = depo.urun_kodu ) as birim_fiyat
FROM maliyet_urun_depo depo
INNER  JOIN maliyet_satis_urun urun on urun.urun_kodu = depo.urun_kodu WHERE depo.urun_kodu NOT LIKE 'S%' ${searchQuery} ${depoFilter}
GROUP BY  depo.urun_kodu,depo.urun_aciklama,depo.son_hareket ORDER BY ${siralamaKriterleri.join(', ')})) stok WHERE birim_fiyat is not null and bom_var = 1 )
depo     `


        if (searchParam.length === 0 && depoParams.length === 0) {
            result = await pool.query(bomKullanilan);
            satisUygun = await pool.query(satisUygunQuery)

        } else {

            result = await pool.query(bomKullanilan, [...searchParam, ...depoParams]);
            satisUygun = await pool.query(satisUygunQuery, [...searchParam, ...depoParams]);

        }


        res.status(200).json({
            status: 200, bom_kullan: result.rows, satis_uygun: satisUygun.rows[0]
        })

    } catch (error) {
        res.status(400).json({ status: 400, data: error })
        console.log(error);
    }
}
exports.depoBOMHammaddemaliyet = async (req, res) => {
    try {
        const { sirala, search, haricTutulacakDepolar } = req.body;


        // Geçerli kolonları belirleyelim
        const allowedColumns = ['urun_kodu', 'urun_aciklama', 'toplam_miktar', 'birim_fiyat', 'depo_miktar', 'son_hareket'];
        const siralamaKriterleri = sirala
            ? sirala.split(', ')
                .map(k => k.split(' '))
                .filter(([kolon, yon]) => allowedColumns.includes(kolon) && ['ASC', 'DESC'].includes(yon))
                .map(([kolon, yon]) => `${kolon} ${yon}`)
            : ['depo_miktar DESC'];

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


        let result, satisUygun, hamMadde, yariMamul;

        const hamMaddeQuery = `SELECT 
    SUM(stok.depo_miktar) AS toplam_fiyat, 
    json_agg(stok) AS stok_json  
FROM (
    SELECT 
        CASE WHEN EXISTS (SELECT DISTINCT bom.kod
FROM maliyet_bom bom
LEFT JOIN maliyet_satis_urun sip ON bom.ust_kod  LIKE CONCAT('%', sip.urun_kodu, '%')
WHERE sip.urun_kodu IS NULL AND depo.urun_kodu = bom.kod) 
            THEN 1 ELSE 0 
        END AS bom_var,
        SUM(ROUND(CAST(depo.miktar * depo.birim_fiyat AS NUMERIC), 2)) AS depo_miktar, 
        depo.birim_fiyat, depo.miktar, depo.urun_kodu, depo.urun_aciklama, depo.son_hareket
    FROM (
        SELECT 
            SUM(depo.depo_miktar) AS miktar,
            depo.urun_kodu,
            depo.urun_aciklama,
            depo.son_hareket,										
            ROUND(CAST(COALESCE(fiyat.birim_fiyat, 0) AS NUMERIC), 2) AS birim_fiyat
        FROM maliyet_urun_depo depo
        LEFT JOIN maliyet_urun_birim_fiyat fiyat 
            ON fiyat.urun_kodu = depo.urun_kodu
        WHERE depo.urun_kodu NOT LIKE 'S%' AND (depo.urun_kodu SIMILAR TO '[0-9A-Za-z]{3}\.[0-9A-Za-z]{3}\.[0-9A-Za-z]{3}' OR depo.urun_kodu LIKE '%.B')  ${searchQuery} ${depoFilter}
        GROUP BY depo.urun_kodu, fiyat.birim_fiyat, depo.son_hareket, depo.urun_aciklama
    ) depo
	
    GROUP BY depo.urun_kodu, depo.son_hareket, depo.urun_aciklama, depo.birim_fiyat, depo.miktar
    HAVING COALESCE(SUM(depo.miktar * depo.birim_fiyat), 0) > 0
	ORDER BY ${siralamaKriterleri.join(', ')}
) stok
WHERE bom_var = 1 `

        if (searchParam.length === 0 && depoParams.length === 0) {

            hamMadde = await pool.query(hamMaddeQuery)

        } else {


            hamMadde = await pool.query(hamMaddeQuery, [...searchParam, ...depoParams]);

        }


        res.status(200).json({
            status: 200
            , hamMadde: hamMadde.rows[0]
        })

    } catch (error) {
        res.status(400).json({ status: 400, data: error })
        console.log(error);
    }
}
exports.bomYariMamulMaliyetGet = async (req, res) => {
    try {
        const { sirala, search, haricTutulacakDepolar } = req.body;

        // Geçerli kolonları belirleyelim
        const allowedColumns = ['urun_kodu', 'urun_aciklama', 'miktar', 'birim_fiyat', 'depo_miktar', 'son_hareket'];
        const siralamaKriterleri = sirala
            ? sirala.split(', ')
                .map(k => k.split(' '))
                .filter(([kolon, yon]) => allowedColumns.includes(kolon) && ['ASC', 'DESC'].includes(yon))
                .map(([kolon, yon]) => `${kolon} ${yon}`)
            : ['depo_miktar DESC'];

        // Search parametresi ekleme
        let searchQuery = '';
        let searchParam = [];
        console.log(req.body)
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


        let result, satisUygun, hamMadde, yariMamul;

        yariMamulQuery = `SELECT SUM(miktar*birim_fiyat) as bom_urun, json_agg(depoBOM) as data FROM(
SELECT depo.urun_kodu,depo.urun_aciklama,depo.son_hareket,fiyat.birim_fiyat,SUM(depo.depo_miktar) miktar,(fiyat.birim_fiyat*SUM(depo.depo_miktar)) as depo_miktar, CASE WHEN EXISTS (

            (SELECT * FROM ((SELECT  CASE WHEN  (SELECT COUNT(DISTINCT bom.kod)
FROM maliyet_bom bom

WHERE depo.urun_kodu = bom.ana_urun AND depo.urun_kodu = bom.ust_kod AND depo.urun_kodu != bom.kod) >1
            THEN 1 ELSE 0 
        END AS bom_var, depo.urun_kodu
FROM maliyet_urun_depo depo
INNER  JOIN maliyet_satis_urun urun on urun.urun_kodu = depo.urun_kodu
							 WHERE depo.urun_kodu NOT LIKE 'S%' 
GROUP BY  depo.urun_kodu,depo.urun_aciklama,depo.son_hareket)) stok WHERE bom_var = 1 AND urun_kodu=depo.urun_kodu )
    
) THEN 1 ELSE 0 END as siparis_var,
CASE WHEN  (SELECT COUNT(bom.kod)
FROM maliyet_bom bom

WHERE depo.urun_kodu = bom.kod) >0
            THEN 1 ELSE 0 
			END AS bom_var
FROM maliyet_urun_depo depo
INNER JOIN maliyet_urun_birim_fiyat fiyat ON depo.urun_kodu = fiyat.urun_kodu AND fiyat.birim_fiyat is not null
 WHERE depo.depo_miktar>0 AND depo.urun_kodu NOT LIKE 'S%'   AND (depo.urun_kodu NOT SIMILAR TO '[0-9A-Za-z]{3}\.[0-9A-Za-z]{3}\.[0-9A-Za-z]{3}' AND depo.urun_kodu not LIKE '%.B')  ${searchQuery} ${depoFilter}
GROUP BY depo.urun_kodu,depo.urun_aciklama,depo.son_hareket,fiyat.birim_fiyat  ORDER BY ${siralamaKriterleri.join(', ')}) depoBOM WHERE siparis_var = 0 AND bom_var = 1   
        `

        if (searchParam.length === 0 && depoParams.length === 0) {

            yariMamul = await pool.query(yariMamulQuery);

        } else {


            yariMamul = await pool.query(yariMamulQuery, [...searchParam, ...depoParams]);

        }


        res.status(200).json({
            status: 200
            , yari_mamul: yariMamul.rows[0].bom_urun, yariMamulData: yariMamul.rows[0].data
        })

    } catch (error) {
        res.status(400).json({ status: 400, data: error })
        console.log(error);
    }
}

exports.depoBOMSarfmaliyet = async (req, res) => {
    try {
        const { haricTutulacakDepolar, search } = req.body;
        let paramIndex = search ? 2 : 1;
        let depoFilter = '';
        let depoParams = [];

        if (haricTutulacakDepolar && haricTutulacakDepolar.length > 0) {
            const depoPlaceholders = haricTutulacakDepolar.map((_, i) => `$${paramIndex + i}`).join(', ');
            depoFilter = `AND depo.depo NOT IN (${depoPlaceholders})`;
            depoParams = haricTutulacakDepolar;
        }
        const bomKullanilan = ` SELECT 
    SUM(stok.fiyat) AS toplam_fiyat,  -- Toplam fiyat hesaplama
    json_agg(stok) AS stok_json  
FROM (
    SELECT 
        CASE WHEN EXISTS (SELECT 1 FROM maliyet_bom bom WHERE depo.urun_kodu = bom.kod) 
            THEN 1 ELSE 0 
        END AS bom_var,
        SUM(ROUND(CAST(depo.toplam_miktar * depo.birim_fiyat AS NUMERIC), 2)) AS fiyat, 
        depo.birim_fiyat, depo.toplam_miktar, depo.urun_kodu, depo.urun_aciklama, depo.son_hareket
    FROM (
        SELECT 
            SUM(depo.depo_miktar) AS toplam_miktar,
            depo.urun_kodu,
            depo.urun_aciklama,
            depo.son_hareket,										
            ROUND(CAST(COALESCE(fiyat.birim_fiyat, 0) AS NUMERIC), 2) AS birim_fiyat
        FROM maliyet_urun_depo depo
        LEFT JOIN maliyet_urun_birim_fiyat fiyat 
            ON fiyat.urun_kodu = depo.urun_kodu
        WHERE depo.urun_kodu NOT LIKE 'S%' AND depo.urun_kodu SIMILAR TO '[0-9A-Za-z]{3}\.[0-9A-Za-z]{3}\.[0-9A-Za-z]{3}'
        GROUP BY depo.urun_kodu, fiyat.birim_fiyat, depo.son_hareket, depo.urun_aciklama
    ) depo
	
    GROUP BY depo.urun_kodu, depo.son_hareket, depo.urun_aciklama, depo.birim_fiyat, depo.toplam_miktar
    HAVING COALESCE(SUM(depo.toplam_miktar * depo.birim_fiyat), 0) > 0
	order by fiyat desc
) stok
WHERE bom_var = 1 

 `
        let result = await pool.query(bomKullanilan);
        res.status(200).json({ status: 200, bom_kullan: result.rows })

    } catch (error) {
        res.status(400).json({ status: 400, data: error })
        console.log(error);
    }
}
exports.stokGetir = async (req, res) => {
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

        const queryString = `
      SELECT CASE
              WHEN EXISTS (SELECT 1 FROM maliyet_bom WHERE urun_kodu = ana_urun) THEN 1 ELSE 0 
          END AS bom_var,
          SUM(ROUND(CAST(depo.toplam_miktar * depo.birim_fiyat AS NUMERIC), 2)) AS fiyat, 
          depo.birim_fiyat, depo.toplam_miktar, depo.urun_kodu, depo.urun_aciklama, depo.son_hareket
      FROM (
          SELECT 
              SUM(depo.depo_miktar) AS toplam_miktar,
              depo.urun_kodu,
              depo.urun_aciklama,
              depo.son_hareket,										
              ROUND(CAST(COALESCE(fiyat.birim_fiyat, 0) AS NUMERIC), 2) AS birim_fiyat
          FROM maliyet_urun_depo depo
          LEFT JOIN maliyet_urun_birim_fiyat fiyat 
              ON fiyat.urun_kodu = depo.urun_kodu
          WHERE depo.urun_kodu NOT LIKE 'S%' ${searchQuery} ${depoFilter}
          GROUP BY depo.urun_kodu, fiyat.birim_fiyat, depo.son_hareket, depo.urun_aciklama
      ) depo
      GROUP BY depo.urun_kodu, depo.son_hareket, depo.urun_aciklama, depo.birim_fiyat, depo.toplam_miktar
      HAVING SUM(depo.toplam_miktar * depo.birim_fiyat) > 0  
      ORDER BY ${siralamaKriterleri.join(', ')};`;
        const digerUrunlerQuery = `SELECT 
    urun_grubu,
    CASE
        WHEN urun_grubu = 'MEKANİK SARF/APARAT' THEN 1
        WHEN urun_grubu = 'OPTİK SARF/APARAT' THEN 2
        WHEN urun_grubu = 'ELEKTRONİK SARF' THEN 3
        WHEN urun_grubu = 'bakim' THEN 4
        WHEN urun_grubu = 'ÜRETİM SARF/APARAT' THEN 5
        WHEN urun_grubu = 'İDARİ/KIRTASİYE' THEN 6
		WHEN urun_grubu = 'BUNLAR DIŞINDAKİLER (REVİZYON DIŞI/AR-GE/UYGUNSUZ/ÜRETİM DIŞI)' THEN 7
        ELSE NULL
    END AS tur,
	json_agg(gruplar) ,
   SUM( round(cast(depo_miktar as numeric),2)) AS toplam_miktar
FROM (
    SELECT 
        depo.urun_kodu,
        depo.urun_aciklama,
        depo.son_hareket,
        depo.depo_miktar as miktar,
        fiyat.birim_fiyat,
        (depo.depo_miktar*fiyat.birim_fiyat) as depo_miktar,
        CASE
            WHEN depo.urun_kodu LIKE '100.1%' THEN 'MEKANİK SARF/APARAT'
            WHEN depo.urun_kodu LIKE '100.2%' THEN 'OPTİK SARF/APARAT'
            WHEN depo.urun_kodu LIKE '100.3%' THEN 'ELEKTRONİK SARF'
            WHEN depo.urun_kodu LIKE '800.1%' OR depo.urun_kodu LIKE '800.3%' OR depo.urun_kodu LIKE '800.4%' OR depo.urun_kodu LIKE '800.5%' THEN 'bakim'
            WHEN depo.urun_kodu LIKE '100.4%' OR depo.urun_kodu LIKE '100.5%' OR depo.urun_kodu LIKE '100.6%' OR depo.urun_kodu LIKE '100.7%' OR depo.urun_kodu LIKE '800.1%' THEN 'ÜRETİM SARF/APARAT'
            WHEN depo.urun_kodu LIKE '800.2%' THEN 'İDARİ/KIRTASİYE'
            ELSE 'BUNLAR DIŞINDAKİLER (REVİZYON DIŞI/AR-GE/UYGUNSUZ/ÜRETİM DIŞI)'
        END AS urun_grubu
    FROM public.maliyet_urun_depo depo
	LEFT JOIN public.maliyet_urun_birim_fiyat fiyat 
        ON fiyat.urun_kodu = depo.urun_kodu AND fiyat.birim_fiyat is not null
    WHERE depo.urun_kodu NOT LIKE 'S%'  ${searchQuery} ${depoFilter}
      AND depo.depo_miktar > 0 AND fiyat.birim_fiyat is not null
      AND NOT EXISTS (
          SELECT 1
          FROM maliyet_bom bom
          WHERE bom.kod = depo.urun_kodu
      )
   ORDER BY depo_miktar DESC
) AS gruplar
GROUP BY urun_grubu, tur;`
        // Eğer parametre yoksa, direkt sorguyu çalıştır
        let result, digerResult;
        if (searchParam.length === 0 && depoParams.length === 0) {
            result = await pool.query(queryString);
            digerResult = await pool.query(digerUrunlerQuery)
        } else {
            result = await pool.query(queryString, [...searchParam, ...depoParams]);
            digerResult = await pool.query(digerUrunlerQuery, [...searchParam, ...depoParams])

        }

        res.status(200).json({ status: 200, data: result.rows, diger: digerResult.rows });

    } catch (error) {
        res.status(400).json({ status: 400, data: error });
        console.log(error);
    }
};


exports.sonHareketBulApp = async (req, res) => {
    const resultPortal = await pool.query(`SELECT * FROM portal_tiger_aktif_cari`)
    const cari_yil = resultPortal.rows[0].yil
    const result = await pool.query(`SELECT * FROM maliyet_urun_depo WHERE son_hareket is null`)

    for (let data of result.rows) {
        await sonHareketBul(225, data.urun_kodu)

    }
    res.status(200).json({ status: 200, data: result })
}
exports.eskiKartlar = async (req, res) => {
    const resultPortal = await pool.query(`SELECT * FROM portal_tiger_aktif_cari`)
    const cari_yil = resultPortal.rows[0].yil
    const result = await pool.query(`SELECT * FROM maliyet_urun_birim_fiyat WHERE birim_fiyat = 0`)

    for (let data of result.rows) {
        const mssqlPool = await poolPromises; // MSSQL bağlantısı
        const tigerCariOku = mssqlPool.request();
        const selectTigerDepoQuery = `
   SELECT * FROM ESKI_KART_220 WHERE [YENİ KOD] IS NOT NULL AND [YENİ KOD] ='${data.urun_kodu}'`;
        const depoAdetResult = await tigerCariOku.query(selectTigerDepoQuery);
        let depo = depoAdetResult.recordsets[0]

        if (depo.length > 0) {
            const eskiKodSiparisVarMi = await pool.query(`SELECT * FROM maliyet_satin_alma_siparis WHERE urun_kod='${depo[0].KOD}'`)
            if (eskiKodSiparisVarMi.rowCount > 0) {
                const ortalamaBirimFiyatHesapla = await pool.query(`UPDATE maliyet_urun_birim_fiyat
                SET birim_fiyat = (
                    SELECT CASE
                        WHEN SUM(sas_miktar) = 0 OR SUM(sas_miktar) IS NULL THEN 0
                        ELSE SUM(carpan) / SUM(sas_miktar)
                    END
                    FROM (
                        SELECT sas_miktar * birim_fiyat AS carpan, sas_miktar
                        FROM maliyet_satin_alma_siparis
                        WHERE urun_kod = '${depo[0].KOD}'
                    ) AS toplam
                )
                WHERE urun_kodu ='${data.urun_kodu}'`)
            } else {
                await sasCekMaliyet(cari_yil, depo[0].KOD)
            }
        }

    }
    res.status(200).json({ status: 200, data: result })
}
exports.satisUrunGirisi = async (req, res) => {
    let data = [
        {
            "urun_kodu": "6006-4040-1001",
            "urun_aciklama": "PİM KONTAK GK-9661"
        },
        {
            "urun_kodu": "6040-0054-5118",
            "urun_aciklama": "SOMUN HALKA RULMAN KU BANT RFRJ 7084"
        },
        {
            "urun_kodu": "6005-0044-1077",
            "urun_aciklama": "SOMUN ANTEN VHF IMM"
        },
        {
            "urun_kodu": "6040-0053-0048",
            "urun_aciklama": "TAPA MOTOR ALT POLAR SOJ"
        },
        {
            "urun_kodu": "6033-0054-8005",
            "urun_aciklama": "TK KAPAK ÖN AT T-LINK 3270 BASKILI"
        },
        {
            "urun_kodu": "6005-0516-4004",
            "urun_aciklama": "INSERT BR NI M4X0.5"
        },
        {
            "urun_kodu": "AR24-P2773691-325",
            "urun_aciklama": "LRF FİLTRE, LAT, AF600"
        },
        {
            "urun_kodu": "AR24-P2773691-324",
            "urun_aciklama": "LST FİLTRE, LAT, AF600"
        },
        {
            "urun_kodu": "10061954",
            "urun_aciklama": "A100 27MM OBJEKTİF TAKIMI"
        },
        {
            "urun_kodu": "10136707",
            "urun_aciklama": "RETAINER TWISTCAP, AF-410"
        },
        {
            "urun_kodu": "10132094",
            "urun_aciklama": "SPACER, ALMAC, GZM03"
        },
        {
            "urun_kodu": "10125400-2",
            "urun_aciklama": "KILAVUZ-11 BAĞLANTI ADAPTÖR PİM"
        },
        {
            "urun_kodu": "10125400-1",
            "urun_aciklama": "KILAVUZ-11 BAĞLANTI ADAPTÖR PİM"
        },
        {
            "urun_kodu": "10134441",
            "urun_aciklama": "JACKPOST, START KARTI, HPLAS410D"
        },
        {
            "urun_kodu": "10125714",
            "urun_aciklama": "FLEKS ARALAYICI"
        },
        {
            "urun_kodu": "10125789-1",
            "urun_aciklama": "GÖVDE,ATS 62"
        },
        {
            "urun_kodu": "10138490-KSZ",
            "urun_aciklama": "AYNA-45"
        },
        {
            "urun_kodu": "6005-4040-1010",
            "urun_aciklama": "ARALAYICI AK RF AG V/UHF"
        },
        {
            "urun_kodu": "6006-0040-1004",
            "urun_aciklama": "PİM MERKEZ ANTEN PSZÇL A4 AUB"
        },
        {
            "urun_kodu": "6040-0040-1125",
            "urun_aciklama": "KÜRE TOPRAK HAREKETLİ"
        },
        {
            "urun_kodu": "6005-0042-8033",
            "urun_aciklama": "KRIPTO HAPIS VIDA PIFF SORGULAYICI"
        },
        {
            "urun_kodu": "6040-0042-8262",
            "urun_aciklama": "ARALAYICI M2X4 PIFF SORGULAYICI"
        },
        {
            "urun_kodu": "MN-0000-7575",
            "urun_aciklama": "PUL PTFE 6.2X12X1"
        },
        {
            "urun_kodu": "6040-0042-8245",
            "urun_aciklama": "KONEKTÖR ARALAYICI-1 PIFF SORGULAYICI"
        },
        {
            "urun_kodu": "10061955-2",
            "urun_aciklama": "A100 ÜST GÖVDE TAKIMI"
        },
        {
            "urun_kodu": "10119685",
            "urun_aciklama": "A100 HOUSING TUBE  METRİK"
        },
        {
            "urun_kodu": "10099073-KSZ LENS3",
            "urun_aciklama": "10099073-KSZ LENS3 PORT FSN MK.ÜR"
        },
        {
            "urun_kodu": "10099074-KSZ LENS4",
            "urun_aciklama": "10099074-KSZ LENS4 PORT FSN MK.ÜR"
        },
        {
            "urun_kodu": "6040-0042-8225",
            "urun_aciklama": "ARALAYICI RF-GY PIFF SORGULAYICI"
        },
        {
            "urun_kodu": "6006-0042-8009",
            "urun_aciklama": "VIDA KRIPTO PIN  PIFF SORGULAYICI"
        },
        {
            "urun_kodu": "6005-4040-1001",
            "urun_aciklama": "BURÇ KONTAK GK-9661"
        },
        {
            "urun_kodu": "6006-0042-8007",
            "urun_aciklama": "PİM HİZALAMA RF-GY IFF BSC"
        },
        {
            "urun_kodu": "10099071-KSZ LENS1",
            "urun_aciklama": "10099071-KSZ LENS1 PORT FSN MK.ÜR"
        },
        {
            "urun_kodu": "10099072-KSZ LENS2",
            "urun_aciklama": "10099072-KSZ LENS2 PORT FSN MK.ÜR"
        },
        {
            "urun_kodu": "10063330-4",
            "urun_aciklama": "F5.5, SÜREKLİ BÜYÜTMELİ MOTORLU OBJEKTİF"
        },
        {
            "urun_kodu": "6005-0042-8004",
            "urun_aciklama": "GK ARALAYICI IFF BSC"
        },
        {
            "urun_kodu": "6005-0051-5001",
            "urun_aciklama": "HİZALAYICI RF SAYISAL 5433"
        },
        {
            "urun_kodu": "10080954",
            "urun_aciklama": "AYNA, KOLİMATÖR, GÖZ TTN"
        },
        {
            "urun_kodu": "10106414-1",
            "urun_aciklama": "GÜNGÖR-HDM"
        },
        {
            "urun_kodu": "6040-0050-7004",
            "urun_aciklama": "ÇUBUK ALT 10MM,ANTEN"
        },
        {
            "urun_kodu": "10137238",
            "urun_aciklama": "YÜKSELİŞ AYNASI, EOTS"
        },
        {
            "urun_kodu": "10119371",
            "urun_aciklama": "GÖZETLEME OPTİĞİ TAKIMI,9X"
        },
        {
            "urun_kodu": "10107195",
            "urun_aciklama": "LENS 13, SWIR ZOOM"
        },
        {
            "urun_kodu": "10117300-1",
            "urun_aciklama": "GÜNGÖR-HD-MD"
        },
        {
            "urun_kodu": "10107180",
            "urun_aciklama": "TRIPLET, SWIR ZOOM"
        },
        {
            "urun_kodu": "10107184",
            "urun_aciklama": "LENS 4, SWIR ZOOM"
        },
        {
            "urun_kodu": "10133110",
            "urun_aciklama": "SENSÖR BİRİMİ LENS6"
        },
        {
            "urun_kodu": "10133111",
            "urun_aciklama": "SENSÖR BİRİMİ LENS7"
        },
        {
            "urun_kodu": "10107200",
            "urun_aciklama": "LONG PASS FILTER, SWIR ZOOM"
        },
        {
            "urun_kodu": "6040-0046-0315",
            "urun_aciklama": "VIDA MERCEK KISA TUNNING FILTRE GEZGIN"
        },
        {
            "urun_kodu": "10133106",
            "urun_aciklama": "SENSÖR BİRİMİ LENS2"
        },
        {
            "urun_kodu": "10133105",
            "urun_aciklama": "SENSÖR BİRİMİ LENS1"
        },
        {
            "urun_kodu": "10133108",
            "urun_aciklama": "SENSÖR BİRİMİ LENS4"
        },
        {
            "urun_kodu": "10133107",
            "urun_aciklama": "SENSÖR BİRİMİ LENS3"
        },
        {
            "urun_kodu": "10133109",
            "urun_aciklama": "SENSÖR BİRİMİ LENS5"
        },
        {
            "urun_kodu": "6040-0046-0321",
            "urun_aciklama": "AYAR VİDASI M1.6/2 X-BANT LNB FİLTRE"
        },
        {
            "urun_kodu": "6040-0046-0320",
            "urun_aciklama": "AYAR VİDASI M1.6/1 X-BANT LNB FİLTRE"
        },
        {
            "urun_kodu": "6040-0054-5051",
            "urun_aciklama": "ARALAYICI ALGILAYICI POL 7084 HC"
        },
        {
            "urun_kodu": "6040-0046-0316",
            "urun_aciklama": "TUNNİNG VİDA 2.5 CC H BEND UZUN"
        },
        {
            "urun_kodu": "6040-0054-5099",
            "urun_aciklama": "MAKARA GERGİ POL 7084"
        },
        {
            "urun_kodu": "6009-0044-1154",
            "urun_aciklama": "ARALAYICI HAPİS DC MODUL PLASTİK"
        },
        {
            "urun_kodu": "10142205",
            "urun_aciklama": "LENS 1, MWIR EOTS "
        },
        {
            "urun_kodu": "10142211",
            "urun_aciklama": "LENS 7, MWIR EOTS"
        },
        {
            "urun_kodu": "10142212",
            "urun_aciklama": "LENS 8, MWIR EOTS"
        },
        {
            "urun_kodu": "10082007-1-KSZ",
            "urun_aciklama": "IR WINDOW,T72"
        },
        {
            "urun_kodu": "6040-0044-9030",
            "urun_aciklama": "VİDA HAPİS GK BBU 5220"
        },
        {
            "urun_kodu": "6009-0046-0018",
            "urun_aciklama": "PLASTİK KONTAK TUTUCU 7070 UHE Ş/GK"
        },
        {
            "urun_kodu": "10142207",
            "urun_aciklama": "LENS 3, MWIR EOTS"
        },
        {
            "urun_kodu": "10142206",
            "urun_aciklama": "LENS 2, MWIR EOTS"
        },
        {
            "urun_kodu": "10142208",
            "urun_aciklama": "LENS 4, MWIR EOTS"
        },
        {
            "urun_kodu": "10142209",
            "urun_aciklama": "LENS 5, MWIR EOTS"
        },
        {
            "urun_kodu": "10142210",
            "urun_aciklama": "LENS 6, MWIR EOTS"
        },
        {
            "urun_kodu": "10080995",
            "urun_aciklama": "LENS 4, COLLIMATOR, EYE ATS"
        },
        {
            "urun_kodu": "10080996",
            "urun_aciklama": "BEAM SPLITTER, COLLIMATOR, EYE ATS"
        },
        {
            "urun_kodu": "10108544",
            "urun_aciklama": "T1 LENS1 V3 "
        },
        {
            "urun_kodu": "10095565-72",
            "urun_aciklama": "A600 GÖVDE TAKIMI"
        },
        {
            "urun_kodu": "10087204",
            "urun_aciklama": "LENS-3, IŞIN GENİŞLETİCİ, MRLR"
        },
        {
            "urun_kodu": "10071404",
            "urun_aciklama": "LENS,ALMAÇ,GZM-04"
        },
        {
            "urun_kodu": "6040-0051-0111",
            "urun_aciklama": "DİELEKTRİK KONİ UHE 7070"
        },
        {
            "urun_kodu": "10080974",
            "urun_aciklama": "WINDOW, DAYSIGHT, EYE ATS"
        },
        {
            "urun_kodu": "10080991",
            "urun_aciklama": "LENS 1, COLLIMATOR, EYE ATS"
        },
        {
            "urun_kodu": "10080994",
            "urun_aciklama": "LENS 4, COLLIMATOR, EYE ATS"
        },
        {
            "urun_kodu": "10107193-IS",
            "urun_aciklama": "LENS 11, SWIR ZOOM KAPLAMASIZ"
        },
        {
            "urun_kodu": "10107194-IS",
            "urun_aciklama": "LENS 12, SWIR ZOOM KAPLAMASIZ"
        },
        {
            "urun_kodu": "10107195-IS",
            "urun_aciklama": "LENS 13, SWIR ZOOM KAPLAMASIZ"
        },
        {
            "urun_kodu": "10107196-IS",
            "urun_aciklama": "DOUBLET 3, SWIR ZOOM KAPLAMASIZ"
        },
        {
            "urun_kodu": "10107199-IS",
            "urun_aciklama": "LENS 16, SWIR ZOOM KAPLAMASIZ"
        },
        {
            "urun_kodu": "10107200-IS",
            "urun_aciklama": "LONG PASS FILTER, SWIR ZOOM"
        },
        {
            "urun_kodu": "10107180-IS",
            "urun_aciklama": "TRIPLET, SWIR ZOOM KAPLAMASIZ"
        },
        {
            "urun_kodu": "10107184-IS",
            "urun_aciklama": "LENS 4, SWIR ZOOM KAPLAMASIZ"
        },
        {
            "urun_kodu": "10107185-IS",
            "urun_aciklama": "LENS 5, SWIR ZOOM KAPLAMASIZ"
        },
        {
            "urun_kodu": "10107186-IS",
            "urun_aciklama": "LENS 6, SWIR ZOOM KAPLAMASIZ"
        },
        {
            "urun_kodu": "10107187-IS",
            "urun_aciklama": "DOUBLET 1, SWIR ZOOM KAPLAMASIZ"
        },
        {
            "urun_kodu": "10107190-IS",
            "urun_aciklama": "DOUBLET 2, SWIR ZOOM KAPLAMASIZ"
        },
        {
            "urun_kodu": "10107196",
            "urun_aciklama": "DOUBLET 3, SWIR ZOOM"
        },
        {
            "urun_kodu": "10107199",
            "urun_aciklama": "LENS 16, SWIR ZOOM"
        },
        {
            "urun_kodu": "10107193",
            "urun_aciklama": "LENS 11, SWIR ZOOM"
        },
        {
            "urun_kodu": "10107194",
            "urun_aciklama": "LENS 12, SWIR ZOOM"
        },
        {
            "urun_kodu": "10107186",
            "urun_aciklama": "LENS 6, SWIR ZOOm"
        },
        {
            "urun_kodu": "10107187",
            "urun_aciklama": "DOUBLET 1, SWIR ZOOM"
        },
        {
            "urun_kodu": "10107190",
            "urun_aciklama": "DUBLET 2, SWIR ZOOM"
        },
        {
            "urun_kodu": "10107185",
            "urun_aciklama": "LENS 5, SWIR ZOOM"
        },
        {
            "urun_kodu": "6005-0038-9002",
            "urun_aciklama": "VİDA TEST SIZDIRMAZLIK M5 A4 SOX"
        },
        {
            "urun_kodu": "6005-0040-1029",
            "urun_aciklama": "ARALAYICI BOBİN DAR"
        },
        {
            "urun_kodu": "6008-4040-1004",
            "urun_aciklama": "YÜZÜK ANTEN KONN MJ-000-1338"
        },
        {
            "urun_kodu": "10087201",
            "urun_aciklama": "LENS-2, IŞIN GENİŞLTİCİ, MRLR"
        },
        {
            "urun_kodu": "6040-4040-1019",
            "urun_aciklama": "YUVA KONTAK GK-9661"
        },
        {
            "urun_kodu": "10091693-1",
            "urun_aciklama": "F4 SÜREKLİ BÜYÜTMELİ MOTORLU OBJEKTİF"
        },
        {
            "urun_kodu": "10061951-17",
            "urun_aciklama": "A100 GECE GÖRÜŞ GÖVDE TAKIMI"
        },
        {
            "urun_kodu": "10091753-1",
            "urun_aciklama": "ATS 70 SOĞUTMASIZ SÜREKLİ OBJ."
        },
        {
            "urun_kodu": "10091753-2",
            "urun_aciklama": "ATS 70D SOĞUTMASIZ SÜREKLİ OBJ."
        },
        {
            "urun_kodu": "10069190",
            "urun_aciklama": "UZATMA OPTİĞİ LEG. ALTAY"
        },
        {
            "urun_kodu": "10097063-4",
            "urun_aciklama": "A600 GECE GÖRÜŞ EKLENTİSİ"
        },
        {
            "urun_kodu": "AB-0000-1191",
            "urun_aciklama": "UGES ELEKTROMEKANİK ÜRETİM VE TEST İŞLEMİ"
        },
        {
            "urun_kodu": "10033460-1",
            "urun_aciklama": "NAMLU REFLEKS KOLİMATÖRÜ"
        },
        {
            "urun_kodu": "10114070-3",
            "urun_aciklama": "KND 5-25 NİŞANCI DÜRBÜNÜ"
        },
        {
            "urun_kodu": "10097063-5",
            "urun_aciklama": "A600 GECE GÖRÜŞ EKLENTİSİ"
        },
        {
            "urun_kodu": "10121245-1",
            "urun_aciklama": "UZATMA OPTİĞİ TAKIMI, LEGGÖP"
        },
        {
            "urun_kodu": "10030870.K",
            "urun_aciklama": "PATRİAL REFLAKTÖR (KAPLAMASIZ)"
        },
        {
            "urun_kodu": "10095565-9",
            "urun_aciklama": "A600 GÖVDE TAKIMI"
        },
        {
            "urun_kodu": "10119455-1",
            "urun_aciklama": "A941 GÜNDÜZ NİŞANGAH SİSTEMİ"
        },
        {
            "urun_kodu": "10119204-1",
            "urun_aciklama": "GÜNDÜZ GÖRÜŞ TAKIMI, 6X, FERSAH"
        },
        {
            "urun_kodu": "10097063-57",
            "urun_aciklama": "A600 GECE GÖRÜŞ EKLENTİSİ(TİLKİ SARISI)"
        },
        {
            "urun_kodu": "10100205-9",
            "urun_aciklama": "REFLEKS NİŞANGAH (ARN-12) (SİYAH)"
        },
        {
            "urun_kodu": "10112173-12",
            "urun_aciklama": "TSD-MR, TİMSAH"
        },
        {
            "urun_kodu": "10114020.K",
            "urun_aciklama": "ANA GÖVDE, 3X-4X (KAPLAMASIZ)"
        },
        {
            "urun_kodu": "10114906-12",
            "urun_aciklama": "ARKA KAPAK TAKIMI, TİMSAH"
        },
        {
            "urun_kodu": "10108233-15",
            "urun_aciklama": "A210 GECE GÖRÜŞ EL DÜRBÜNÜ"
        },
        {
            "urun_kodu": "AB-0000-3409",
            "urun_aciklama": "UGES ELEKTROMEKANİK MONTAJ"
        },
        {
            "urun_kodu": "10103383",
            "urun_aciklama": "KAPALI REFLEKS NİŞANGAH (ARN12-K)"
        },
        {
            "urun_kodu": "10118474-1",
            "urun_aciklama": "OKÜLER TAKIM 45MM ER"
        },
        {
            "urun_kodu": "10061951-4",
            "urun_aciklama": "A100 GECE GÖRÜŞ GÖVDE TAKIMI"
        },
        {
            "urun_kodu": "AR16-U2400280-131",
            "urun_aciklama": "PENCERE-A53001"
        },
        {
            "urun_kodu": "AB-0000-3432",
            "urun_aciklama": "UGES ELEKTROMANYETİK MONTAJ "
        },
        {
            "urun_kodu": "10126597",
            "urun_aciklama": "TAKIM BOROSKOP 35mm HSSM PMT"
        },
        {
            "urun_kodu": "10119150-1",
            "urun_aciklama": "FERSAH-S LASER MESAFE ÖLÇME BİRİMİ"
        },
        {
            "urun_kodu": "10063330-6",
            "urun_aciklama": "F5.5, SÜREKLİ BÜYÜTMELİ MOTORLU OBJEKTİF"
        },
        {
            "urun_kodu": "10122496",
            "urun_aciklama": "AVCI4 EYEPIECE LENS10(AMLCD)"
        },
        {
            "urun_kodu": "10122487",
            "urun_aciklama": "AVCI4 EYEPIECE LENS1(IDMT)"
        },
        {
            "urun_kodu": "10122490",
            "urun_aciklama": "AVCI4 EYEPIECE LENS4(COMMON)"
        },
        {
            "urun_kodu": "10122493",
            "urun_aciklama": "AVCI4 EYEPIECE LENS7(COMMON)"
        },
        {
            "urun_kodu": "10119150-2",
            "urun_aciklama": "FERSAH-S LASER MESAFE OLCME BIRIMI"
        },
        {
            "urun_kodu": "10097394",
            "urun_aciklama": "60 MM LENS 1 VK"
        },
        {
            "urun_kodu": "10105236-1",
            "urun_aciklama": "60 MM ATERMAL OBJ. TAKIMI"
        },
        {
            "urun_kodu": "10112173-1",
            "urun_aciklama": "TSD-MR, TİMSAH"
        },
        {
            "urun_kodu": "10104822",
            "urun_aciklama": "KGYS FİLTRE TAKIMI"
        },
        {
            "urun_kodu": "10114906-1",
            "urun_aciklama": "ARKA KAPAK TAKIMI TİMSAH"
        },
        {
            "urun_kodu": "7052-045-004-50",
            "urun_aciklama": "ASPHERICAL LENS COATED 004-50"
        },
        {
            "urun_kodu": "10095603-4",
            "urun_aciklama": "A600 KÖRÜK TAKIMI"
        },
        {
            "urun_kodu": "7052-045-002-50",
            "urun_aciklama": "ASPHERICAL LENS COATED 002-50"
        },
        {
            "urun_kodu": "10092690-2",
            "urun_aciklama": "F4 2X UZATMA OPTİĞİ TAKIMI"
        },
        {
            "urun_kodu": "10127904",
            "urun_aciklama": "OKÜLER, MİNİ DORUK"
        },
        {
            "urun_kodu": "7052-045-005-50",
            "urun_aciklama": "LENS COATED 005-50"
        },
        {
            "urun_kodu": "7052-045-001-50",
            "urun_aciklama": "LENS COATED 001-50"
        },
        {
            "urun_kodu": "AB-0000-3220",
            "urun_aciklama": "MOBİL PTS V2 (X)"
        },
        {
            "urun_kodu": "10107607",
            "urun_aciklama": "DÖNER GÖVDE 1, ÖN 1, SWIR 1"
        },
        {
            "urun_kodu": "AB-0000-3329",
            "urun_aciklama": "AB-0000-3329 MONTAJ+TEST ASSY CAMERA EKINOKS"
        },
        {
            "urun_kodu": "10084678-3",
            "urun_aciklama": "TAKIM KAPAK ARKA MİNİ TSD"
        },
        {
            "urun_kodu": "10107972",
            "urun_aciklama": "SUPRASIL SUBSTRATE, 35DIAx1"
        },
        {
            "urun_kodu": "10111707",
            "urun_aciklama": "UG11 DIA 70.8x1.5"
        },
        {
            "urun_kodu": "10084678-15",
            "urun_aciklama": "TAKIM KAPAK MİNİ TSD"
        },
        {
            "urun_kodu": "10128688",
            "urun_aciklama": "LENS-3, Mini Doruk Oküler"
        },
        {
            "urun_kodu": "10086210",
            "urun_aciklama": "T-LEGGOB BEAMSPLITTER 2-ASSEMBLY"
        },
        {
            "urun_kodu": "10086207-2",
            "urun_aciklama": "T-LEGGOB BEAMSPLITTER 1-ASSEMBLY"
        },
        {
            "urun_kodu": "10122903-1",
            "urun_aciklama": "AYA OKULER TAKIM"
        },
        {
            "urun_kodu": "10119232",
            "urun_aciklama": "A100 BAĞLANTI ARAYÜZÜ,FERSAH"
        },
        {
            "urun_kodu": "10065317-32",
            "urun_aciklama": "A341 GECE GÖRÜŞ SILAH NİŞANGAHI"
        },
        {
            "urun_kodu": "10086178",
            "urun_aciklama": "T LEGGOB APD LENS 2"
        },
        {
            "urun_kodu": "10086194",
            "urun_aciklama": "T-LEGGOB ZBARREL-10DEG DOUBLET 2"
        },
        {
            "urun_kodu": "10086640-2",
            "urun_aciklama": "3X UZATMA OPTİK TAKIMI"
        },
        {
            "urun_kodu": "10024750-2",
            "urun_aciklama": "GÜNGÖR-D"
        },
        {
            "urun_kodu": "10104617-1",
            "urun_aciklama": "GÜNGÖR-HDS"
        },
        {
            "urun_kodu": "A53001",
            "urun_aciklama": "PC-WINDOW"
        },
        {
            "urun_kodu": "10130496",
            "urun_aciklama": "RELAY SİNGLET LENS"
        },
        {
            "urun_kodu": "10130511",
            "urun_aciklama": "APD LENS 1"
        },
        {
            "urun_kodu": "10127953",
            "urun_aciklama": "AF500 ROA NFOV Switch, Doublet 1"
        },
        {
            "urun_kodu": "10130493",
            "urun_aciklama": "RELAY DOUBLET"
        },
        {
            "urun_kodu": "10130501",
            "urun_aciklama": "KOMPANSATOR DOUBLET LENS"
        },
        {
            "urun_kodu": "10130515",
            "urun_aciklama": "CCD ENTRANCE DOUBLET"
        },
        {
            "urun_kodu": "10130518",
            "urun_aciklama": "CCD MİDDLE DOUBLET"
        },
        {
            "urun_kodu": "10113802",
            "urun_aciklama": "LENS 11, KUZGUN SWIR"
        },
        {
            "urun_kodu": "10113805",
            "urun_aciklama": "DOUBLET 3, KUZGUN SWIR"
        },
        {
            "urun_kodu": "10113808",
            "urun_aciklama": "LENS 16, KUZGUN SWIR"
        },
        {
            "urun_kodu": "10071443",
            "urun_aciklama": "OUTPUT WINDOW, GZM-04"
        },
        {
            "urun_kodu": "AB-0000-3221",
            "urun_aciklama": "MOBİL PTS V2 (X)"
        },
        {
            "urun_kodu": "10127727",
            "urun_aciklama": "RISLEY, CIKIS, HPLASDR"
        },
        {
            "urun_kodu": "10071948",
            "urun_aciklama": "MATCHED PAIR PRISM, 1 DEGREE"
        },
        {
            "urun_kodu": "10113796",
            "urun_aciklama": "DOUBLET 1, KUZGUN SWIR"
        },
        {
            "urun_kodu": "10113799",
            "urun_aciklama": "DOUBLET 2, KUZGUN SWIR"
        },
        {
            "urun_kodu": "10080463-1-KSZ",
            "urun_aciklama": "F5.5.CONT.ZOOM. LENS 7"
        },
        {
            "urun_kodu": "10137638",
            "urun_aciklama": "ARKA KAPAK TAKIMI, TİMSAH T3100C"
        },
        {
            "urun_kodu": "10107994",
            "urun_aciklama": "30MM ATHERMAL OBJ TAKIMI"
        },
        {
            "urun_kodu": "10110870",
            "urun_aciklama": "5X BÜYÜTME OPTİK TAKIMI"
        },
        {
            "urun_kodu": "10080458-1-KSZ",
            "urun_aciklama": "F5.5.CONT.ZOOM. LENS 2"
        },
        {
            "urun_kodu": "10080460-1-KSZ",
            "urun_aciklama": "F5.5.CONT.ZOOM. LENS 4"
        },
        {
            "urun_kodu": "10080461-1-KSZ",
            "urun_aciklama": "F5.5.CONT.ZOOM. LENS 5"
        },
        {
            "urun_kodu": "10080462-1-KSZ",
            "urun_aciklama": "F5.5.CONT.ZOOM. LENS 6"
        },
        {
            "urun_kodu": "10101753-2",
            "urun_aciklama": "KAPAK, LMÖ,  ATS 60 D"
        },
        {
            "urun_kodu": "10101752-2",
            "urun_aciklama": "ÖN KAPAK, ATS 60 D"
        },
        {
            "urun_kodu": "10101751-2",
            "urun_aciklama": "GÖVDE, ATS 60 D"
        },
        {
            "urun_kodu": "10111398-1",
            "urun_aciklama": "ÖN KAPAK 60 MM KNOBLU TSD-MR"
        },
        {
            "urun_kodu": "10108911-1",
            "urun_aciklama": "ARKA KAPAK TAKIMI TSD MR"
        },
        {
            "urun_kodu": "10101756-2",
            "urun_aciklama": "ÜST KAPAK,  ATS 60 D"
        },
        {
            "urun_kodu": "10105317-2",
            "urun_aciklama": "PENCERE TUTUCU,IR, ATS 60 D"
        },
        {
            "urun_kodu": "10105318-1",
            "urun_aciklama": "SGIM,ATS 65 D"
        },
        {
            "urun_kodu": "10086652-2",
            "urun_aciklama": "OBJEKTİF PLAKA, ATS 60"
        },
        {
            "urun_kodu": "10101755-2",
            "urun_aciklama": "KAPAK, SAYAÇ,  ATS 60 D"
        },
        {
            "urun_kodu": "10101754-2",
            "urun_aciklama": "KAPAK, TOROS,  ATS 60 D"
        },
        {
            "urun_kodu": "10103156-1",
            "urun_aciklama": "ÜST KAPAK, POI, ATS 70"
        },
        {
            "urun_kodu": "10103157-1",
            "urun_aciklama": "ÖN KAPAK, POI, ATS 70"
        },
        {
            "urun_kodu": "10103232-1",
            "urun_aciklama": "ÖN KAPAK, PENC, DMP, ATS 71"
        },
        {
            "urun_kodu": "10113772-1",
            "urun_aciklama": "ARKA KAPAK, ATS 71"
        },
        {
            "urun_kodu": "10103415-1",
            "urun_aciklama": "AYAR PARÇASI, MWXC"
        },
        {
            "urun_kodu": "10108913-1",
            "urun_aciklama": "ÜST KAPAK TAKIMI TSD-MR"
        },
        {
            "urun_kodu": "10098571-1",
            "urun_aciklama": "YAN KAPAK, TGB, ATS 70"
        },
        {
            "urun_kodu": "10100024-1",
            "urun_aciklama": "KAPAK, SAYAÇ, DÜZ, ATS 70"
        },
        {
            "urun_kodu": "10103155-1",
            "urun_aciklama": "GÖVDE, POI, ATS70"
        },
        {
            "urun_kodu": "10084657",
            "urun_aciklama": "GÖVDE İŞLEM, OMTAS AKÜ-GB"
        },
        {
            "urun_kodu": "10072141",
            "urun_aciklama": "KAPAK, İŞLEM"
        },
        {
            "urun_kodu": "10108909-1",
            "urun_aciklama": "GÖVDE TAKIM TSD-MR"
        },
        {
            "urun_kodu": "10136011",
            "urun_aciklama": "IRIS KAPAK BS"
        },
        {
            "urun_kodu": "10136013",
            "urun_aciklama": "IRIS DIOPTER KAPAK"
        },
        {
            "urun_kodu": "10136008",
            "urun_aciklama": "IRIS TUTUCU RET"
        },
        {
            "urun_kodu": "10136010-1",
            "urun_aciklama": "IRIS GOVDE BS"
        },
        {
            "urun_kodu": "10086324-1",
            "urun_aciklama": "SIKILAŞTIRICI 20° BARREL LENS 1"
        },
        {
            "urun_kodu": "10136007",
            "urun_aciklama": "IRIS TUTUCU DS"
        },
        {
            "urun_kodu": "10086322-1",
            "urun_aciklama": "ARALAYICI ALT GÖVDE 20° BARREL"
        },
        {
            "urun_kodu": "10086323-1",
            "urun_aciklama": "SIKILAŞTIRICI ALT GÖVDE LENS5 20° BARREL"
        },
        {
            "urun_kodu": "10086319-1",
            "urun_aciklama": "SIKILAŞTIRICI ALT GÖVDE 20° BARREL"
        },
        {
            "urun_kodu": "10086321-1",
            "urun_aciklama": "ALT GÖVDE 20° BARREL LENS 5 - LENS 6"
        },
        {
            "urun_kodu": "10086303-1",
            "urun_aciklama": "SIKILAŞTITICI APD BANDPASS"
        },
        {
            "urun_kodu": "10086318-1",
            "urun_aciklama": "GÖVDE 20° BARREL LEGGÖB"
        },
        {
            "urun_kodu": "10086301-1",
            "urun_aciklama": "ARALAYICI APD LENS 1 - LENS 2"
        },
        {
            "urun_kodu": "10086302-1",
            "urun_aciklama": "ARALAYICI APD LENS 3 - BANDPASS"
        },
        {
            "urun_kodu": "10086299-1",
            "urun_aciklama": "TUTUCU APD KART"
        },
        {
            "urun_kodu": "10086300-1",
            "urun_aciklama": "SIKILAŞTIRICI APD LENS 1"
        },
        {
            "urun_kodu": "10133837",
            "urun_aciklama": "DİŞLİ İRİS MOTOR"
        },
        {
            "urun_kodu": "10133838",
            "urun_aciklama": "İRİS MOTOR TUTUCU"
        },
        {
            "urun_kodu": "10086325-1",
            "urun_aciklama": "ARALAYICI 20° BARREL LENS 1 - LENS 2"
        },
        {
            "urun_kodu": "10123178-1",
            "urun_aciklama": "T2 LKK TUTUCU NP"
        },
        {
            "urun_kodu": "10123524",
            "urun_aciklama": "T2_HD_CCD_KART_TTC_TLGGB"
        },
        {
            "urun_kodu": "10086341-1",
            "urun_aciklama": "T-LEGGÖB DİŞLİ ÇUBUĞU"
        },
        {
            "urun_kodu": "10086344-2",
            "urun_aciklama": "GÖVDE, T-LEGGÖB"
        },
        {
            "urun_kodu": "10086339-1",
            "urun_aciklama": "AYAR VİDA DİŞLİ MEKANİZMA"
        },
        {
            "urun_kodu": "10086340-1",
            "urun_aciklama": "TUTUCU ANAHTAR"
        },
        {
            "urun_kodu": "10086337-1",
            "urun_aciklama": "PLAKA TUTUCU TAKIM BARREL LENS GRUP"
        },
        {
            "urun_kodu": "10086338-1",
            "urun_aciklama": "TUTUCU ARALAYICI DİŞLİ MEKANİZMA"
        },
        {
            "urun_kodu": "10086298-1",
            "urun_aciklama": "TUTUCU AYAR APD KART"
        },
        {
            "urun_kodu": "10086336-1",
            "urun_aciklama": "TUTUCU TAKIM BARREL LENS GRUP"
        },
        {
            "urun_kodu": "10086269-1",
            "urun_aciklama": "KAPAK BEAM SPLITTER"
        },
        {
            "urun_kodu": "10086270-1",
            "urun_aciklama": "KAPAK YAN BEAM SPLITTER"
        },
        {
            "urun_kodu": "10086271-1",
            "urun_aciklama": "ARALAYICI BEAM SPLITTER"
        },
        {
            "urun_kodu": "10086266-1",
            "urun_aciklama": "SIKILAŞTIRICI OBJEKTİF LENS"
        },
        {
            "urun_kodu": "10086268-1",
            "urun_aciklama": "GÖVDE BEAM SPLITTER LEGGÖB"
        },
        {
            "urun_kodu": "10086263-1",
            "urun_aciklama": "PLAKA T-LEGGÖB"
        },
        {
            "urun_kodu": "10086265-1",
            "urun_aciklama": "TUTUCU OBJEKTİF LENS"
        },
        {
            "urun_kodu": "10086258-1",
            "urun_aciklama": "TUTUCU MİNYATÜR RULMAN TLEGGÖB"
        },
        {
            "urun_kodu": "10086259-1",
            "urun_aciklama": "KAPAK DIOPTER T LEGGÖB KP"
        },
        {
            "urun_kodu": "10086257-1",
            "urun_aciklama": "TUTUCU MİNYATÜR RULMAN 4.5mm TLEGGÖB"
        },
        {
            "urun_kodu": "10086256-1",
            "urun_aciklama": "DELRIN AYAR HALKA TLIDS"
        },
        {
            "urun_kodu": "10086296-1",
            "urun_aciklama": "GÖVDE APD LEGGÖB"
        },
        {
            "urun_kodu": "10086297-1",
            "urun_aciklama": "KAYAR HALKA APD"
        },
        {
            "urun_kodu": "10086293-1",
            "urun_aciklama": "ARALAYICI CCD LENS 4 - LENS 5"
        },
        {
            "urun_kodu": "10086294-1",
            "urun_aciklama": "SIKILAŞTIRICI CCD LENS 6"
        },
        {
            "urun_kodu": "10086291-1",
            "urun_aciklama": "ARALAYICI CCD LENS 1 - LENS 2"
        },
        {
            "urun_kodu": "10086292-1",
            "urun_aciklama": "ARALAYICI CCD LENS 3 - LENS 4"
        },
        {
            "urun_kodu": "10086287-1",
            "urun_aciklama": "KAYAR HALKA CCD"
        },
        {
            "urun_kodu": "10086290-1",
            "urun_aciklama": "SIKILAŞTIRICI CCD LENS 1"
        },
        {
            "urun_kodu": "10086272-1",
            "urun_aciklama": "SIKILAŞTIRICI ÖN LENS BEAM SPLITTER"
        },
        {
            "urun_kodu": "10086286-1",
            "urun_aciklama": "GÖVDE CCD LEGGÖB"
        },
        {
            "urun_kodu": "10124587-1",
            "urun_aciklama": "GÖVDE CERAKOTE, İŞLENMİŞ, GG, 4X"
        },
        {
            "urun_kodu": "10069094-2",
            "urun_aciklama": "KAPAK, T-LEGGÖB"
        },
        {
            "urun_kodu": "10069115-1",
            "urun_aciklama": "KAPAK CCD,APD LEGGÖB"
        },
        {
            "urun_kodu": "10065324-1",
            "urun_aciklama": "A341 OKÜLER TAKIMI"
        },
        {
            "urun_kodu": "30005997",
            "urun_aciklama": "A100-SİLAH ADAPTÖRÜ"
        },
        {
            "urun_kodu": "10085553-1",
            "urun_aciklama": "A100 HAFİF OKÜLER TAKIMI MONTAJ"
        },
        {
            "urun_kodu": "10124601",
            "urun_aciklama": "OBJ. KORUMA KAPAGI TK. CERAKOTE, 6x"
        },
        {
            "urun_kodu": "10124596",
            "urun_aciklama": "OBJ.KORUMA KAPAĞI TK. CERAKOTE , 4X"
        },
        {
            "urun_kodu": "10086195",
            "urun_aciklama": "T LEGGOB ZBARREL 10 DEG LENS 6"
        },
        {
            "urun_kodu": "10086191",
            "urun_aciklama": "T-LEGGOB ZBARREL-10DEG DOUBLET 1"
        },
        {
            "urun_kodu": "10086179",
            "urun_aciklama": "T LEGGOB APD LENS 3"
        },
        {
            "urun_kodu": "10086188",
            "urun_aciklama": "T LEGGOB ZBARREL 10 DEG LENS 1"
        },
        {
            "urun_kodu": "10086177",
            "urun_aciklama": "T LEGGOB APD LENS 1"
        },
        {
            "urun_kodu": "10086219",
            "urun_aciklama": "T-LEGGOB  CCD DOUBLET 2"
        },
        {
            "urun_kodu": "10086215",
            "urun_aciklama": "T LEGGOB CCD LENS 4"
        },
        {
            "urun_kodu": "10086216",
            "urun_aciklama": "T LEGGOB CCD LENS 5"
        },
        {
            "urun_kodu": "10086211",
            "urun_aciklama": "T LEGGOB CCD LENS 1"
        },
        {
            "urun_kodu": "10086214",
            "urun_aciklama": "T-LEGGOB  CCD DOUBLET 1"
        },
        {
            "urun_kodu": "10086198",
            "urun_aciklama": "T-LEGGOB  DOUBLET 1"
        },
        {
            "urun_kodu": "10086199",
            "urun_aciklama": "T LEGGOB LENS 3"
        },
        {
            "urun_kodu": "10115874",
            "urun_aciklama": "GSWIR ARKA KAPAK TAKIMI"
        },
        {
            "urun_kodu": "10142451",
            "urun_aciklama": "AFOKAL GÖVDE,EOTS"
        },
        {
            "urun_kodu": "10115870",
            "urun_aciklama": "GSWIR ÖN KAPAK"
        },
        {
            "urun_kodu": "10115871",
            "urun_aciklama": "GSWIR ÜST KAPAK"
        },
        {
            "urun_kodu": "10115872",
            "urun_aciklama": "GSWIR SAĞ KAPAK"
        },
        {
            "urun_kodu": "10115868",
            "urun_aciklama": "GSWIR DIS 3 TUTUCU"
        },
        {
            "urun_kodu": "10115867",
            "urun_aciklama": "1921 SWIR TUTUCU B"
        },
        {
            "urun_kodu": "10115873",
            "urun_aciklama": "GSWIR SOL KAPAK"
        },
        {
            "urun_kodu": "10115866",
            "urun_aciklama": "1921 TUTUCU SWIR K"
        },
        {
            "urun_kodu": "10118962",
            "urun_aciklama": "SWIR DESTEK PLAKASI-1, GGB-S"
        },
        {
            "urun_kodu": "10115879",
            "urun_aciklama": "GSWIR GÜÇ SOĞUTMA PLAKASI"
        },
        {
            "urun_kodu": "10115878",
            "urun_aciklama": "GSWIR CAMGÖZ SOĞUTMA PLAKASI"
        },
        {
            "urun_kodu": "10115877",
            "urun_aciklama": "GSWIR KART KAPAĞI"
        },
        {
            "urun_kodu": "10115882",
            "urun_aciklama": "GSWIR SWIR TUTUCU HALKASI"
        },
        {
            "urun_kodu": "10115881",
            "urun_aciklama": "GSWIR SİLECEK TUTUCU"
        },
        {
            "urun_kodu": "10115883",
            "urun_aciklama": "GSWIR SWIR TUTUCU PLAKASI"
        },
        {
            "urun_kodu": "10115865",
            "urun_aciklama": "GSWIR 34X TABAN PLAKASI"
        },
        {
            "urun_kodu": "10110187",
            "urun_aciklama": "PLAKA,DEDEKTÖR 2,SWIR 1"
        },
        {
            "urun_kodu": "10107701",
            "urun_aciklama": "PLAKA 2, DESTEK SWIR"
        },
        {
            "urun_kodu": "10095153",
            "urun_aciklama": "WFOV VIZ  LENS 2"
        },
        {
            "urun_kodu": "10071747",
            "urun_aciklama": "T BRAKET IGT ADLR"
        },
        {
            "urun_kodu": "10071838",
            "urun_aciklama": "TUTUCU BANDPASS FİLTRE"
        },
        {
            "urun_kodu": "10104106-1",
            "urun_aciklama": "3-12X50 KESKİN NİŞANCI DÜRBÜNÜ TAKIMI SİYAH"
        },
        {
            "urun_kodu": "10095167",
            "urun_aciklama": "WFOV VIZ LENS 1 AND LENS2 ASSEMBLY"
        },
        {
            "urun_kodu": "10095568-1",
            "urun_aciklama": "A600, GÖVDE (SİYAH)"
        },
        {
            "urun_kodu": "10095152",
            "urun_aciklama": "WFOV VIZ LENS1 "
        },
        {
            "urun_kodu": "6005-0042-8032",
            "urun_aciklama": "ÖPB ARALAYICI IFF BSC"
        },
        {
            "urun_kodu": "6005-0042-8026",
            "urun_aciklama": "ARALAYICI KART AFB IFF BSC"
        },
        {
            "urun_kodu": "6006-0042-8008",
            "urun_aciklama": "PİM HİZALAMA KART-KAPAK ANHB IFF BSC"
        },
        {
            "urun_kodu": "10071617",
            "urun_aciklama": "PUL BUSBAR TERMINAL KMHST"
        },
        {
            "urun_kodu": "6040-0048-8008",
            "urun_aciklama": "BİLEZİK YAN GÖVDE"
        },
        {
            "urun_kodu": "6005-0054-3012",
            "urun_aciklama": "VAMPİR KARŞILIK FÜVB 7595"
        },
        {
            "urun_kodu": "6040-0053-0026",
            "urun_aciklama": "VIDA BESLEME M4 SOJ"
        },
        {
            "urun_kodu": "6040-0053-0023",
            "urun_aciklama": "BESLEME SOJ"
        },
        {
            "urun_kodu": "6040-0053-0012",
            "urun_aciklama": "MİL DÖNEN ELEV SOJ"
        },
        {
            "urun_kodu": "6040-0053-0035",
            "urun_aciklama": "TOPRAKLAMA TUTUCU KAİDE SOJ"
        },
        {
            "urun_kodu": "6040-0053-0003",
            "urun_aciklama": "EKSENLEME PİMİ LNA ADAPTOR SOJ"
        },
        {
            "urun_kodu": "6005-0054-3015",
            "urun_aciklama": "ARALAYICI HAPİS TFM VBYD 7595"
        },
        {
            "urun_kodu": "10087190",
            "urun_aciklama": "VİDA,LASER DİYOT, MRLR"
        },
        {
            "urun_kodu": "6005-0047-9016",
            "urun_aciklama": "ARALAYICI DC DC MODUL CVP SORG 3010"
        },
        {
            "urun_kodu": "6005-0047-9017",
            "urun_aciklama": "ARALAYICI TANTAL CVP SORG 3010"
        },
        {
            "urun_kodu": "6040-0053-0024",
            "urun_aciklama": "DIELEKTRIK SOJ"
        },
        {
            "urun_kodu": "6005-0041-4009",
            "urun_aciklama": "ARALAYICI M3x10 2064 IPKC-V2"
        },
        {
            "urun_kodu": "6005-0054-5001",
            "urun_aciklama": "ARALAYICI M2.5x5.0-M2"
        },
        {
            "urun_kodu": "6040-0051-5024",
            "urun_aciklama": "TUTUCU KONEKTÖR 5433 AET"
        },
        {
            "urun_kodu": "6040-0053-0050",
            "urun_aciklama": "TAPA MOTOR ÜST POLAR SOJ"
        },
        {
            "urun_kodu": "6005-0046-0037",
            "urun_aciklama": "ARALAYICI M2.5X11.43"
        },
        {
            "urun_kodu": "6005-0044-1072",
            "urun_aciklama": "ARALAYICI HAPİS M3x9.5"
        },
        {
            "urun_kodu": "6005-0044-1001",
            "urun_aciklama": "ARALAYICI HOPARLÖR"
        },
        {
            "urun_kodu": "6040-0044-1290",
            "urun_aciklama": "PİM MERKEZLEME LNA KAPAK"
        },
        {
            "urun_kodu": "6030-0044-1142",
            "urun_aciklama": "TK KARKAS PPS NÜVESİZ"
        },
        {
            "urun_kodu": "6040-0046-4038",
            "urun_aciklama": "HİZALAYICI YUVA 2R2T RRU"
        },
        {
            "urun_kodu": "10087081",
            "urun_aciklama": "LENS 16 MM QUAD "
        },
        {
            "urun_kodu": "10084678-8",
            "urun_aciklama": "TAKIM KAPAK MİNİ TSD"
        },
        {
            "urun_kodu": "10104165",
            "urun_aciklama": "MİL YATAY HDS"
        },
        {
            "urun_kodu": "10096146",
            "urun_aciklama": "IMU PİM BURCU"
        },
        {
            "urun_kodu": "10111845-3",
            "urun_aciklama": "TSD-MR MERMİSAYAR"
        },
        {
            "urun_kodu": "10082882",
            "urun_aciklama": "ENTRANCE GLASS"
        },
        {
            "urun_kodu": "10101391",
            "urun_aciklama": "ARALAYICI CUBUK AHTAPOT"
        },
        {
            "urun_kodu": "10125699",
            "urun_aciklama": "SWIR HİZALAMA DESTEK"
        },
        {
            "urun_kodu": "10134552",
            "urun_aciklama": "AF500 ISIN GENISLETICI GOVDE"
        },
        {
            "urun_kodu": "10069688",
            "urun_aciklama": "MOTOR TUTUCU"
        },
        {
            "urun_kodu": "6040-0046-0084",
            "urun_aciklama": "DİELEKTRİK KONİ UHE 7070"
        },
        {
            "urun_kodu": "6040-0053-1024",
            "urun_aciklama": "ROTOR YUVA KEÇE KALKAN-II"
        },
        {
            "urun_kodu": "MD-9941-0001",
            "urun_aciklama": "SOGUTUCU FIN ALOX SY CPU TKYS"
        },
        {
            "urun_kodu": "AR24-P2191441-100",
            "urun_aciklama": "KAAN(MMU) IRST PRCHAN PART-1"
        },
        {
            "urun_kodu": "AR24-P2191441-101",
            "urun_aciklama": "KAAN(MMU) IRST PRCHAN PART-2"
        },
        {
            "urun_kodu": "10136705",
            "urun_aciklama": "TWISTCAP GÖVDE, AF-410"
        },
        {
            "urun_kodu": "10125705-4",
            "urun_aciklama": "SIZDIRMAZ VİDA , AF400"
        },
        {
            "urun_kodu": "10125671",
            "urun_aciklama": "AZİMUT PLAKASI,SWIR"
        },
        {
            "urun_kodu": "6009-0044-1007",
            "urun_aciklama": "DÜĞME SES İŞLENMİŞ 9671"
        },
        {
            "urun_kodu": "6040-0048-8069",
            "urun_aciklama": "BALPETEĞİ İNSÖRT M5 AKÜ"
        },
        {
            "urun_kodu": "6030-0048-8003",
            "urun_aciklama": "TK İNSÖRT ELEV"
        },
        {
            "urun_kodu": "6040-4037-3103",
            "urun_aciklama": "YUVA AYAK MTT M5"
        },
        {
            "urun_kodu": "AR24-U2400630-008",
            "urun_aciklama": "DIRCM BEX V3 FAZ 2 AYNA"
        },
        {
            "urun_kodu": "10104555-1",
            "urun_aciklama": "PLASTİK BURÇ M2X6.5X1.3"
        },
        {
            "urun_kodu": "10132492",
            "urun_aciklama": "TEC MESNET-2, HPLAS 410D"
        },
        {
            "urun_kodu": "10024770",
            "urun_aciklama": "PİM, YAY, SİLECEK"
        },
        {
            "urun_kodu": "10132486",
            "urun_aciklama": "KAMA KRİSTAL TK., HPLAS410D"
        },
        {
            "urun_kodu": "10132493",
            "urun_aciklama": "TEC MESNET, HPLAS 410D"
        },
        {
            "urun_kodu": "10107689",
            "urun_aciklama": "ARLAYICI 2, SABİT, SWIR"
        },
        {
            "urun_kodu": "10117751",
            "urun_aciklama": "ZUM GRUP 1-2 KAYAR GÖVDESİ, GÜNDÜZ GÖRÜŞ"
        },
        {
            "urun_kodu": "10117720",
            "urun_aciklama": "ZOOM GROUP 1-2 KAYAR GÖVDESİ, DAY TV"
        },
        {
            "urun_kodu": "6005-0534-4001",
            "urun_aciklama": "PERCİN PR AU PIL KONTAK"
        },
        {
            "urun_kodu": "10131945-1",
            "urun_aciklama": "SPACER TEC SURUCU "
        },
        {
            "urun_kodu": "10119898",
            "urun_aciklama": "A931/A941 PETEK FİLTRE TAKIMI MGEOKGK-1000"
        },
        {
            "urun_kodu": "10106999",
            "urun_aciklama": "YAPIŞTIRMA MASTARI,NOKTALAYICI,TEMREN-Pİ"
        },
        {
            "urun_kodu": "10121224",
            "urun_aciklama": "KELEPÇE-3, TEMREN DOLUNAY"
        },
        {
            "urun_kodu": "23AR06-P18-OPT-L40",
            "urun_aciklama": "LMO CAM PENCERE"
        },
        {
            "urun_kodu": "TP0049223-B1",
            "urun_aciklama": "GOVDE DUZ PERISKOP TIP 1"
        },
        {
            "urun_kodu": "TP0049225-B1",
            "urun_aciklama": "GOVDE DUZ PERISKOP TIP 1 AYNA"
        },
        {
            "urun_kodu": "TP0049224-B1",
            "urun_aciklama": "GOVDE DUZ PERISKOP TIP 2"
        },
        {
            "urun_kodu": "TP0049227-B1",
            "urun_aciklama": "GOVDE DUZ PERISKOP TIP 2 AYNA SOL"
        },
        {
            "urun_kodu": "TP0049955-A1",
            "urun_aciklama": "KULE DUZ PERISKOP TIP 1"
        },
        {
            "urun_kodu": "TP0049956-A1",
            "urun_aciklama": "KULE DUZ PERISKOP TIP 2"
        },
        {
            "urun_kodu": "TP0049958-A1",
            "urun_aciklama": "KULE DUZ PERISKOP TIP 1 AYNA DOLDURUCU"
        },
        {
            "urun_kodu": "TP0049959-A1",
            "urun_aciklama": "KULE DUZ PERISKOP TIP 1 AYNA KOMUTAN"
        },
        {
            "urun_kodu": "TP0049226-B1",
            "urun_aciklama": "GOVDE DUZ PERISKOP TIP 2 AYNA SAG"
        },
        {
            "urun_kodu": "TP0049957-A1",
            "urun_aciklama": "KULE DUZ PERISKOP TIP 3"
        },
        {
            "urun_kodu": "TP0049290-B1",
            "urun_aciklama": "GÖVDE DÜZ PERİSKOP TİP 1 MİL BRAKETİ 1"
        },
        {
            "urun_kodu": "TP0049291-B1",
            "urun_aciklama": "GÖVDE DÜZ PERİSKOP TİP 1 MİL BRAKETİ 2"
        },
        {
            "urun_kodu": "58002000-3",
            "urun_aciklama": "M27 PERISKOP"
        },
        {
            "urun_kodu": "58002300-1",
            "urun_aciklama": "95A25-13220-AA  M17 PERİSKOP"
        },
        {
            "urun_kodu": "ZAP-250",
            "urun_aciklama": "ZIRHLI ARAÇ PERİSKOPU-LOOK UP"
        },
        {
            "urun_kodu": "ZAP-200",
            "urun_aciklama": "ZIRHLI ARAÇ PERİSKOPU-M27"
        },
        {
            "urun_kodu": "58002000",
            "urun_aciklama": "M27 PERİSKOP"
        },
        {
            "urun_kodu": "58000040",
            "urun_aciklama": "TANK UZATMA OPTİĞİ / MUZZLE BORESIGH DEVICE"
        },
        {
            "urun_kodu": "100,710,014",
            "urun_aciklama": "WC009 10X42 BINOCULAR  "
        },
        {
            "urun_kodu": "95A30-13220-AA",
            "urun_aciklama": "M27 ISITICILI PERISKOP (58002700)"
        },
        {
            "urun_kodu": "95A27-13210-AA",
            "urun_aciklama": "M17 PERİSKOP ISITICILI, EMI "
        },
        {
            "urun_kodu": "KMT00-13242-AA",
            "urun_aciklama": "58004000 YILDIRIM PERİSKOP"
        },
        {
            "urun_kodu": "238395",
            "urun_aciklama": "DOME-1, TVGAB-125 "
        },
        {
            "urun_kodu": "204410",
            "urun_aciklama": "ALIGNMENT CUBE, YTNS"
        },
        {
            "urun_kodu": "262714",
            "urun_aciklama": "LENS-1, TVGHAB-180, TV-IIR EO"
        },
        {
            "urun_kodu": "262718",
            "urun_aciklama": "LENS-3, TVGHAB-180, TV-IIR EO"
        },
        {
            "urun_kodu": "10110187.K",
            "urun_aciklama": "PLAKA,DEDEKTÖR 2,SWIR 1"
        },
        {
            "urun_kodu": "10115867.K",
            "urun_aciklama": "1921 SWIR TUTUCU B"
        },
        {
            "urun_kodu": "10092754-2",
            "urun_aciklama": "PUL PLASTİK      "
        },
        {
            "urun_kodu": "AR25-P2191441-017",
            "urun_aciklama": "PECHAN S1 KELEPÇE "
        },
        {
            "urun_kodu": "AR25-P2191441-018",
            "urun_aciklama": "PECHAN S3 KELEPÇE"
        },
        {
            "urun_kodu": "AR25-P2191441-019",
            "urun_aciklama": "PECHAN S4 KELEPÇE"
        },
        {
            "urun_kodu": "AR25-P2191441-020",
            "urun_aciklama": "PECHAN S6 KELEPÇE "
        },
        {
            "urun_kodu": "10071755",
            "urun_aciklama": "KAMA 2 IGT ADLR"
        },
        {
            "urun_kodu": "AR23-P2923501-046",
            "urun_aciklama": "LENS,PLANO-CONVEX,F63.6 D15 T3.5"
        },
        {
            "urun_kodu": "AR24-P2161541-048",
            "urun_aciklama": "18 MM FOTOKATOT CAMI "
        },
        {
            "urun_kodu": "6040-0052-2054",
            "urun_aciklama": "VİDA ÇAKMA V1 M4x10x2 PSZÇL"
        },
        {
            "urun_kodu": "10138490",
            "urun_aciklama": "AYNA-45"
        },
        {
            "urun_kodu": "10095603-1",
            "urun_aciklama": "A600 KÖRÜK TAKIMI"
        },
        {
            "urun_kodu": "5307-1472-9204",
            "urun_aciklama": "VIDA BŞZ/ALY PSZÇL/SOX M2,5X4"
        },
        {
            "urun_kodu": "10105323-1",
            "urun_aciklama": "A600 SİLAH ADAPTÖRÜ 16.8MM"
        },
        {
            "urun_kodu": "10120089",
            "urun_aciklama": "CYLINDER MIRROR"
        },
        {
            "urun_kodu": "10106961",
            "urun_aciklama": "BATARYA KAPAK TAKIMI A510 (BT-A510)"
        },
        {
            "urun_kodu": "10070441",
            "urun_aciklama": "BATARYA KONTAK TAKIMI"
        },
        {
            "urun_kodu": "10101237",
            "urun_aciklama": "BAĞLANTI KAPAĞI, A600"
        },
        {
            "urun_kodu": "10101239",
            "urun_aciklama": "ÇEVİRME HALKASI KAPAĞI, A600"
        },
        {
            "urun_kodu": "10101373",
            "urun_aciklama": "TBDK,A510 KOPRU"
        },
        {
            "urun_kodu": "10101649",
            "urun_aciklama": "UZAKTAN KUMANDA KABLOSU,A600"
        },
        {
            "urun_kodu": "10108539",
            "urun_aciklama": "VALF KAPAK"
        },
        {
            "urun_kodu": "100,500,242",
            "urun_aciklama": "UMİCORE HAFNİUM HF 99.5%"
        },
        {
            "urun_kodu": "10125698",
            "urun_aciklama": "GÜNDÜZ KAMERASI HİZALAMA DESTEK"
        },
        {
            "urun_kodu": "10111150-1",
            "urun_aciklama": "A500 GECE GÖRÜŞ GÖVDE TAKIMI(GT-A500)"
        },
        {
            "urun_kodu": "10030749",
            "urun_aciklama": "YAPIŞTIRICI, EPKS, MASTERBOND-2LO"
        },
        {
            "urun_kodu": "10091045-1",
            "urun_aciklama": "BURÇ, LMÖ PLAKA, ATS 70"
        },
        {
            "urun_kodu": "10099468-1",
            "urun_aciklama": "BURÇ, GGB 2X, DRAGONEYE"
        },
        {
            "urun_kodu": "10100205-1",
            "urun_aciklama": "REFLEKS NİŞANGAH (ARN-12) (SİYAH)"
        },
        {
            "urun_kodu": "AR23-P2709511-169",
            "urun_aciklama": "COMPANSE LENS2 VER2"
        },
        {
            "urun_kodu": "AR23-P2709511-168",
            "urun_aciklama": "COMPANSE LENS2 VER1"
        },
        {
            "urun_kodu": "AR23-P2709511-167",
            "urun_aciklama": "COMPANSE LENS1 VER2"
        },
        {
            "urun_kodu": "AR23-P2709511-166",
            "urun_aciklama": "COMPANSE LENS1 VER1"
        },
        {
            "urun_kodu": "10142214",
            "urun_aciklama": "LENS 1,LST,TOYGUN EOTS"
        },
        {
            "urun_kodu": "10142215",
            "urun_aciklama": "LENS 2,LST,TOYGUN EOTS"
        },
        {
            "urun_kodu": "10142216",
            "urun_aciklama": "LENS 3,LST,TOYGUN EOTS"
        },
        {
            "urun_kodu": "10142217",
            "urun_aciklama": "BANDPASS, LST, TOYGUN EOTS"
        },
        {
            "urun_kodu": "10083444",
            "urun_aciklama": "DOUBLET 2"
        },
        {
            "urun_kodu": "AR24-P2686711-003",
            "urun_aciklama": "OPTİK GİRİŞ PENCERESİ PARÇASI"
        },
        {
            "urun_kodu": "10092370",
            "urun_aciklama": "ENTRANCE WINDOW"
        },
        {
            "urun_kodu": "10083436",
            "urun_aciklama": "LENS 1"
        },
        {
            "urun_kodu": "10083440",
            "urun_aciklama": "DOUBLET 1"
        },
        {
            "urun_kodu": "10125566",
            "urun_aciklama": "CAM, CIKIS, HPLASDR"
        },
        {
            "urun_kodu": "10130462",
            "urun_aciklama": "LENS-4, ISINGENISLETICI-2, HPLASDR"
        },
        {
            "urun_kodu": "10130461",
            "urun_aciklama": "LENS-3, ISINGENISLETICI-2, HPLASDR"
        },
        {
            "urun_kodu": "10130460",
            "urun_aciklama": "LENS-2, ISINGENISLETICI-2, HPLASDR"
        },
        {
            "urun_kodu": "10130459",
            "urun_aciklama": "LENS-1, ISINGENISLETICI-2, HPLASDR"
        },
        {
            "urun_kodu": "10134550",
            "urun_aciklama": "AF500 AF410 ISIN GENISLETICI ARKA TUTUCU"
        },
        {
            "urun_kodu": "10134551",
            "urun_aciklama": "AF500 AF410 ISIN GENISLETICI SOMUN"
        },
        {
            "urun_kodu": "10134549",
            "urun_aciklama": "AF500 AF410 ISIN GENISLETICI KOVAN"
        },
        {
            "urun_kodu": "10134548",
            "urun_aciklama": "AF500 ISIN GENISLETICI GOVDE"
        },
        {
            "urun_kodu": "10105747-10",
            "urun_aciklama": "A940 GÜNDÜZ NİŞANGAHI"
        },
        {
            "urun_kodu": "10105747-11",
            "urun_aciklama": "A940 GÜNDÜZ NİŞANGAHI"
        },
        {
            "urun_kodu": "10105748-10",
            "urun_aciklama": "A960 GÜNDÜZ NİŞANGAHI, CİHAZ"
        },
        {
            "urun_kodu": "10070711-35",
            "urun_aciklama": "A230 GECE GÖRÜŞ EL DÜRBÜNÜ"
        },
        {
            "urun_kodu": "AR24-P2480631-001",
            "urun_aciklama": "AR KAPLI PC-WİNDOW"
        },
        {
            "urun_kodu": "AR24-P2662091-019",
            "urun_aciklama": "YGL Focuser Motor Tutucu"
        },
        {
            "urun_kodu": "AR24-P2662091-012",
            "urun_aciklama": "HPC 2.7x SPACER RING"
        },
        {
            "urun_kodu": "AR24-P2662091-009",
            "urun_aciklama": "HPC DIŞ TUTUCU"
        },
        {
            "urun_kodu": "AR24-P2662091-008",
            "urun_aciklama": "H.P. 6kW COLLIMATOR QB BODY"
        },
        {
            "urun_kodu": "AR24-P2662091-007",
            "urun_aciklama": "HPF 6 HAREKETLI LENS TUTUCU"
        },
        {
            "urun_kodu": "10085553-4",
            "urun_aciklama": "HAFİF OKÜLER TAKIMI "
        },
        {
            "urun_kodu": "10113809",
            "urun_aciklama": "FILTER, KUZGUN SWIR"
        },
        {
            "urun_kodu": "AR24-P2662091-011",
            "urun_aciklama": "HPC MID SPACER RING"
        },
        {
            "urun_kodu": "AR24-P2662091-010",
            "urun_aciklama": "HPF 6 MOTOR SPACER SHIM"
        },
        {
            "urun_kodu": "AR24-P2662091-006",
            "urun_aciklama": "HPF 6 10 MAIN BODY"
        },
        {
            "urun_kodu": "10113794",
            "urun_aciklama": "LENS 5, KUZGUN SWIR"
        },
        {
            "urun_kodu": "10113793",
            "urun_aciklama": "LENS 4, KUZGUN SWIR"
        },
        {
            "urun_kodu": "10113803",
            "urun_aciklama": "LENS 12, KUZGUN SWIR"
        },
        {
            "urun_kodu": "10127982",
            "urun_aciklama": "AF500 ROA, FOLD MİRROR"
        },
        {
            "urun_kodu": "10113795",
            "urun_aciklama": "LENS 6, KUZGUN SWIR"
        },
        {
            "urun_kodu": "10116859",
            "urun_aciklama": "LENS 7, 43MM VK"
        },
        {
            "urun_kodu": "10116858",
            "urun_aciklama": "LENS 6, 43MM VK"
        },
        {
            "urun_kodu": "10116853",
            "urun_aciklama": "LENS 1, 43MM VK"
        },
        {
            "urun_kodu": "10086694-42",
            "urun_aciklama": "A341 GECE GÖRÜS SYLAH NYSANGAHI, SYSTEM"
        },
        {
            "urun_kodu": "10130521",
            "urun_aciklama": "CCD EXİT DOUBLET"
        },
        {
            "urun_kodu": "10130524",
            "urun_aciklama": "CCD EXİT SİNGLET LENS"
        },
        {
            "urun_kodu": "10104106-3",
            "urun_aciklama": "3-12X50 KESKİN NİŞANCI DÜRBÜNÜ TAKIMI SARI"
        },
        {
            "urun_kodu": "10116861",
            "urun_aciklama": "DOUBLET 2, 43MM VK"
        },
        {
            "urun_kodu": "10116860",
            "urun_aciklama": "DOUBLET 1, 43MM VK"
        },
        {
            "urun_kodu": "10130504",
            "urun_aciklama": "COMPENSATOR SİNGLET LENS"
        },
        {
            "urun_kodu": "10130512",
            "urun_aciklama": "APD SİNGLET LENS 2"
        },
        {
            "urun_kodu": "10130513",
            "urun_aciklama": "APD SİNGLET LENS 3"
        },
        {
            "urun_kodu": "10130497",
            "urun_aciklama": "FOCUS SİNGLET LENS"
        },
        {
            "urun_kodu": "10130498",
            "urun_aciklama": "FOCUS DOUBLET"
        },
        {
            "urun_kodu": "AR23-P2191441-246",
            "urun_aciklama": "MMU IRST FSM AYNA"
        },
        {
            "urun_kodu": "10100743-1",
            "urun_aciklama": "A600 BATARYA KAPAK TAKIMI"
        },
        {
            "urun_kodu": "10104620-1",
            "urun_aciklama": "BİNOKÜLER GECE GÖRÜŞ GÖZLÜĞÜ,SİTEM,A510"
        },
        {
            "urun_kodu": "10085558-2",
            "urun_aciklama": "A100- GÜNDÜZ EĞİTİM FİLTRESİ"
        },
        {
            "urun_kodu": "10061960-42",
            "urun_aciklama": "A100 MONOKULER GECE GÖRÜŞ GÖZLÜĞÜ"
        },
        {
            "urun_kodu": "10095566-1",
            "urun_aciklama": "A600 OBJEKTİF TAKIMI"
        },
        {
            "urun_kodu": "10095567",
            "urun_aciklama": "A600 KOLİMATÖR TAKIMI"
        },
        {
            "urun_kodu": "10106950-9",
            "urun_aciklama": "A510 GECE GÖRÜŞ GÖVDE TAKIMI"
        },
        {
            "urun_kodu": "10014948",
            "urun_aciklama": "NEUTRAL DENSITY FILTER, T=.06%"
        },
        {
            "urun_kodu": "10086694-36",
            "urun_aciklama": "A341 GECE GÖRÜS SYLAH NYSANGAHI, SYSTEM"
        },
        {
            "urun_kodu": "10086695-39",
            "urun_aciklama": "A361 GECE GÖRÜS SYLAH NYSANGAHI, SYSTEM"
        },
        {
            "urun_kodu": "10087523-2",
            "urun_aciklama": "OKÜLER ALT-TAKIMI, A301"
        },
        {
            "urun_kodu": "10065318-35",
            "urun_aciklama": "A361, GECE GÖRÜŞ SİLAH NİŞANGAHI"
        },
        {
            "urun_kodu": "10097063-48",
            "urun_aciklama": "A600 GECE GÖRÜŞ EKLENTİSİ(SARI)"
        },
        {
            "urun_kodu": "10106300-201",
            "urun_aciklama": "34 MM DÜRBÜN MONTE HAMİLİ"
        },
        {
            "urun_kodu": "10111845-1",
            "urun_aciklama": "TSD-MR MERMİSAYAR"
        },
        {
            "urun_kodu": "10107973",
            "urun_aciklama": "SUPRASIL SUBSTRATE, D84.7DIAX3"
        },
        {
            "urun_kodu": "10107974",
            "urun_aciklama": "SUPRASIL SUBSTRATE, UV"
        },
        {
            "urun_kodu": "7052-045-006-50",
            "urun_aciklama": "LENS COATED 006-50"
        },
        {
            "urun_kodu": "10086640-1",
            "urun_aciklama": "3X UZATMA OPTİK TAKIMI"
        },
        {
            "urun_kodu": "10070613",
            "urun_aciklama": "OBJ. KORUMA KAPAGI TK., 6X"
        },
        {
            "urun_kodu": "10097063-40",
            "urun_aciklama": "A600 GECE GÖRÜŞ EKLENTİSİ"
        },
        {
            "urun_kodu": "10119455-15",
            "urun_aciklama": "A931 GÜNDÜZ NİŞANGAH SİSTEMİ"
        },
        {
            "urun_kodu": "10065455",
            "urun_aciklama": "A341 LENS 1 OBJ."
        },
        {
            "urun_kodu": "10097063-2",
            "urun_aciklama": "A600 GECE GÖRÜŞ EKLENTİSİ"
        },
        {
            "urun_kodu": "10097395",
            "urun_aciklama": "60 MM LENS 2 VK"
        },
        {
            "urun_kodu": "U21-0000-0262",
            "urun_aciklama": "LENS PROTOTİP 4.4-10.2 MM GÜNDÜZ"
        },
        {
            "urun_kodu": "U21-0000-0263",
            "urun_aciklama": "LENS PROTOTİP 6-210 MM GÜNDÜZ"
        },
        {
            "urun_kodu": "U21-0000-0264",
            "urun_aciklama": "LENS PROTOTYPE 5.7-256 MM VISIBLE"
        },
        {
            "urun_kodu": "U22-0000-0733",
            "urun_aciklama": "LENS PROTOTIP 50 MM TERMAL"
        },
        {
            "urun_kodu": "U21-0000-0258",
            "urun_aciklama": "LENS PROTOTİP 55 MM TERMAL"
        },
        {
            "urun_kodu": "U21-0000-0261",
            "urun_aciklama": "LENS PROTOTİP 25-225 MM TERMAL"
        },
        {
            "urun_kodu": "10100205-2",
            "urun_aciklama": "REFLEKS NİŞANGAH (ARN-12) (SARI)"
        },
        {
            "urun_kodu": "10114020/4X-1",
            "urun_aciklama": "ANA GÖVDE, 4X (SİYAH)"
        },
        {
            "urun_kodu": "10071323",
            "urun_aciklama": "LENS-3, BEAM EXPANDER, GZM03"
        },
        {
            "urun_kodu": "10087174",
            "urun_aciklama": "HIGH REFLECTING MIRROR 1535NM, MRLR"
        },
        {
            "urun_kodu": "10087177",
            "urun_aciklama": "PARTIALLY REF. MIRROR 1535NM R75, MRLR"
        },
        {
            "urun_kodu": "10087200",
            "urun_aciklama": "LENS-1, IŞIN GENİŞLTİCİ, MRLR"
        },
        {
            "urun_kodu": "10071322",
            "urun_aciklama": "LENS-2, BEAM EXPANDER, GZM03"
        },
        {
            "urun_kodu": "10095565-70",
            "urun_aciklama": "A600 GÖVDE TAKIMI"
        },
        {
            "urun_kodu": "30011121",
            "urun_aciklama": "TABANCA REFLEKS NİŞANGAHI"
        },
        {
            "urun_kodu": "10119455-19",
            "urun_aciklama": "A941 GÜNDÜZ NİŞANGAH SİSTEMİ"
        },
        {
            "urun_kodu": "10097404",
            "urun_aciklama": "60 MM BLANK LENS 1 VK"
        },
        {
            "urun_kodu": "AR19-P2535091-017",
            "urun_aciklama": "A931"
        },
        {
            "urun_kodu": "AR19-P2535091-018",
            "urun_aciklama": "A941"
        },
        {
            "urun_kodu": "10065460",
            "urun_aciklama": "A341 OBJ. DOUBLET"
        },
        {
            "urun_kodu": "58000060",
            "urun_aciklama": "SGSI PROJEKTOR BİRİMİ"
        },
        {
            "urun_kodu": "ZAP-300",
            "urun_aciklama": "ZIRHLI ARAÇ PERİSKOPU-T15"
        },
        {
            "urun_kodu": "58002000",
            "urun_aciklama": "M27 PERISKOP"
        },
        {
            "urun_kodu": "ZAP-400",
            "urun_aciklama": "ZIRHLI ARAÇ PERİSKOPU-T13 "
        },
        {
            "urun_kodu": "58002300",
            "urun_aciklama": "95A25-13220-AA  M17 PERİSKOP"
        },
        {
            "urun_kodu": "ZAP261ZAP265",
            "urun_aciklama": "PANORAMİK PERİSKOP "
        },
        {
            "urun_kodu": "203554",
            "urun_aciklama": "KUBBE-1, LAB-CB2"
        },
        {
            "urun_kodu": "203552",
            "urun_aciklama": "LENS-1, LAB-CB2"
        },
        {
            "urun_kodu": "238393",
            "urun_aciklama": "DOME-1, TVSAB-160 PLM:DWG"
        },
        {
            "urun_kodu": "238392",
            "urun_aciklama": "LENS-6, TVSAB-160 PLM:DWG"
        },
        {
            "urun_kodu": "238391",
            "urun_aciklama": "LENS-5, TVSAB-160 PLM:DWG"
        },
        {
            "urun_kodu": "238390",
            "urun_aciklama": "LENS-4, TVSAB-160 PLM:DWG"
        },
        {
            "urun_kodu": "262722",
            "urun_aciklama": "LENS-5, TVGHAB-180, TV-IIR EO"
        },
        {
            "urun_kodu": "262720",
            "urun_aciklama": "LENS-4, TVGHAB-180, TV-IIR EO"
        },
        {
            "urun_kodu": "262716",
            "urun_aciklama": "LENS-2, TVGHAB-180, TV-IIR EO"
        },
        {
            "urun_kodu": "232353",
            "urun_aciklama": "LENS-2,TVGHAB-180"
        },
        {
            "urun_kodu": "232352",
            "urun_aciklama": "LENS-1,TVGHAB-180"
        },
        {
            "urun_kodu": "238394",
            "urun_aciklama": "LENS-6, TVGAB-125"
        },
        {
            "urun_kodu": "238389",
            "urun_aciklama": "LENS-3, TVSAB-160 PLM:DWG"
        },
        {
            "urun_kodu": "238388",
            "urun_aciklama": "LENS-2, TVSAB-160 PLM:DWG"
        },
        {
            "urun_kodu": "238387",
            "urun_aciklama": "LENS-1, TVSAB-160 PLM:DWG"
        },
        {
            "urun_kodu": "232356",
            "urun_aciklama": "LENS-5,TVGHAB-180"
        },
        {
            "urun_kodu": "232355",
            "urun_aciklama": "LENS-4,TVGHAB-180"
        },
        {
            "urun_kodu": "232354",
            "urun_aciklama": "LENS-3,TVGHAB-180"
        },
        {
            "urun_kodu": "PRS20-100-1",
            "urun_aciklama": "TABANCA REFLEKS"
        },
        {
            "urun_kodu": "PRS20-110-1",
            "urun_aciklama": "TABANCA REFLEKS"
        },
        {
            "urun_kodu": "10106300-401",
            "urun_aciklama": "34 MM DÜRBÜN MONTE HAMİLİ"
        },
        {
            "urun_kodu": "10086694-38",
            "urun_aciklama": "A341 GECE GÖRÜS SYLAH NYSANGAHI, SYSTEM"
        },
        {
            "urun_kodu": "10119150-3",
            "urun_aciklama": "FERSAH-S LASER MESAFE OLCME BIRIMI"
        },
        {
            "urun_kodu": "10105756",
            "urun_aciklama": "A940 PETEK FİLTRE TK."
        },
        {
            "urun_kodu": "10104617-1",
            "urun_aciklama": "GÜNGÖR-HD-S"
        },
        {
            "urun_kodu": "10070719-3",
            "urun_aciklama": "ÇANTA TAŞIMA, A200"
        },
        {
            "urun_kodu": "10065340",
            "urun_aciklama": "GÖVDE, ODAK"
        },
        {
            "urun_kodu": "10065404",
            "urun_aciklama": "SABİTLEYİCİ"
        },
        {
            "urun_kodu": "10065445",
            "urun_aciklama": "KAPAK, BİRLEŞTİRİCİ TK."
        },
        {
            "urun_kodu": "10065467",
            "urun_aciklama": "TUP ARALAYICI"
        },
        {
            "urun_kodu": "10101850",
            "urun_aciklama": "ODAK DÜĞME A300"
        },
        {
            "urun_kodu": "10106414-1",
            "urun_aciklama": "GÜNGÖR HD-S"
        },
        {
            "urun_kodu": "10070711-33",
            "urun_aciklama": "A200 GECE GÖRÜŞ EL DÜRBÜNÜ"
        },
        {
            "urun_kodu": "10086695-48",
            "urun_aciklama": "A361 GECE GÖRÜS SYLAH NYSANGAHI, SYSTEM"
        },
        {
            "urun_kodu": "10095580",
            "urun_aciklama": "A600, KOLİMATÖR, TUTUCU LENS 1"
        },
        {
            "urun_kodu": "10094454",
            "urun_aciklama": "A600 COLIMATOR LENS 1"
        },
        {
            "urun_kodu": "10094469",
            "urun_aciklama": "A600 OBJ. LENS 1"
        },
        {
            "urun_kodu": "10095570",
            "urun_aciklama": "A600, OBJEKTİF, GÖVDE, HAREKETLİ"
        },
        {
            "urun_kodu": "10095574",
            "urun_aciklama": "A600, OBJEKTİF, TUTUCU, LENS 4"
        },
        {
            "urun_kodu": "10105795",
            "urun_aciklama": "A940/A960 YAY YUVASI"
        },
        {
            "urun_kodu": "10072564",
            "urun_aciklama": "REED SWITCH SPST 250V 1.0A"
        },
        {
            "urun_kodu": "10111397-1",
            "urun_aciklama": "60 MM OBJ TAKIMI KNOBLU TSD-MR"
        },
        {
            "urun_kodu": "10105757",
            "urun_aciklama": "A960 PETEK FİLTRE TK."
        },
        {
            "urun_kodu": "10105750-1",
            "urun_aciklama": "A940/A960 GN YAN KAPAK TAKIMI (SİYAH)"
        },
        {
            "urun_kodu": "10061951-37",
            "urun_aciklama": "A100 GECE GÖRÜŞ GÖVDE TAKIMI"
        },
        {
            "urun_kodu": "10068898-2",
            "urun_aciklama": "A100 MONOKÜLER NİŞANGAHI"
        },
        {
            "urun_kodu": "10061960-47",
            "urun_aciklama": "A100 MONOKULER GECE GÖRÜŞ GÖZLÜĞÜ"
        },
        {
            "urun_kodu": "10107612",
            "urun_aciklama": "ANA SABİTLEYİCİ, SWIR 1"
        },
        {
            "urun_kodu": "10107614",
            "urun_aciklama": "DÖNER GÖVDE 1, ARKA 1, SWIR 1"
        },
        {
            "urun_kodu": "10107686",
            "urun_aciklama": "SABİTLEYİCİ 1, ARKA, SWIR"
        },
        {
            "urun_kodu": "10107697",
            "urun_aciklama": "SABİTLEYİCİ 2, ÖN, SWIR"
        },
        {
            "urun_kodu": "10124140",
            "urun_aciklama": "GÖVDE TAKIMI, SWIR 1"
        },
        {
            "urun_kodu": "10095586-1",
            "urun_aciklama": "A600, KOLİMATÖR AYAR, GÖVDE, SABİT"
        },
        {
            "urun_kodu": "10026146",
            "urun_aciklama": "EYEPIECE ASSY"
        },
        {
            "urun_kodu": "10061960-36",
            "urun_aciklama": "A100 MONOKULER GECE GÖRÜŞ GÖZLÜĞÜ"
        },
        {
            "urun_kodu": "10061960-41",
            "urun_aciklama": "A100 MONOKULER GECE GÖRÜŞ GÖZLÜĞÜ"
        },
        {
            "urun_kodu": "10095591",
            "urun_aciklama": "A600, TÜP STOP"
        },
        {
            "urun_kodu": "10095592",
            "urun_aciklama": "A600, TÜP ARALAYICI"
        },
        {
            "urun_kodu": "10101240",
            "urun_aciklama": "AÇMA DÜĞMESİ, A600"
        },
        {
            "urun_kodu": "10083441",
            "urun_aciklama": "LENS 5"
        },
        {
            "urun_kodu": "10082012",
            "urun_aciklama": "A100-OKÜLER DOUBLET"
        },
        {
            "urun_kodu": "10104106-19",
            "urun_aciklama": "3-12X50 KESKİN NİŞANCI DÜRBÜNÜ TAKIMI "
        },
        {
            "urun_kodu": "10062055-2",
            "urun_aciklama": "A100 SÜRÜCÜ KARTI TAKIMI"
        },
        {
            "urun_kodu": "10118512-1",
            "urun_aciklama": "TSD MR, S"
        },
        {
            "urun_kodu": "AR22-P2435611-001",
            "urun_aciklama": "LMO PENCERE DİK"
        },
        {
            "urun_kodu": "AR22-P2435611-002",
            "urun_aciklama": "LMO PENCERE AÇILI"
        },
        {
            "urun_kodu": "10103046-45",
            "urun_aciklama": "A960 TÜRKÇE 5.56 TROY COYOTE TAN"
        },
        {
            "urun_kodu": "10129471",
            "urun_aciklama": "T3100C COL SINGLET 1"
        },
        {
            "urun_kodu": "10129472",
            "urun_aciklama": "T3100C COL DOUBLET 1"
        },
        {
            "urun_kodu": "10129475",
            "urun_aciklama": "T3100C COL SINGLET 2"
        },
        {
            "urun_kodu": "10129476",
            "urun_aciklama": "T3100C COL SINGLET 3"
        },
        {
            "urun_kodu": "10061960-27",
            "urun_aciklama": "A100 MONOKULER GECE GÖRÜŞ GÖZLÜĞÜ"
        },
        {
            "urun_kodu": "10095572",
            "urun_aciklama": "A600, OBJEKTİF, TUTUCU, LENS 1"
        },
        {
            "urun_kodu": "10061960-29",
            "urun_aciklama": "A100 MONOKULER GECE GÖRÜŞ GÖZLÜĞÜ"
        },
        {
            "urun_kodu": "10095587",
            "urun_aciklama": "A600, KOLİMATÖR AYAR, GÖVDE, HAREKETLİ"
        },
        {
            "urun_kodu": "10095588",
            "urun_aciklama": "A600, KOLİMATÖR AYAR, SABİTLEYİCİ"
        },
        {
            "urun_kodu": "10095589",
            "urun_aciklama": "A600, KOLİMATÖR, ODAK SABİTLEYİCİ"
        },
        {
            "urun_kodu": "10128022",
            "urun_aciklama": "CAM PROXIMITY SENSÖR MINI DORUK "
        },
        {
            "urun_kodu": "10103046-61",
            "urun_aciklama": "A940 GÜNDÜZ NİŞANGAHI TÜRKÇE 5,45 GRAPHITE BLACK"
        },
        {
            "urun_kodu": "10087523-1",
            "urun_aciklama": "A301 OKÜLER"
        },
        {
            "urun_kodu": "10103046-63",
            "urun_aciklama": "A940 GÜNDÜZ NİŞANGAHI TÜRKÇE 7.62 GRAPHITE BLACK"
        },
        {
            "urun_kodu": "AB-0000-1151",
            "urun_aciklama": "TAKIM KAMERA EKINOKS EKS-21"
        },
        {
            "urun_kodu": "10061960-48",
            "urun_aciklama": "A100 MONOKULER GECE GÖRÜŞ GÖZLÜĞÜ"
        },
        {
            "urun_kodu": "10106283",
            "urun_aciklama": "ARN-12 Adapter (10106283)"
        },
        {
            "urun_kodu": "10100205-5",
            "urun_aciklama": "REFLEKS NİŞANGAH (ARN-12) (SİYAH)"
        },
        {
            "urun_kodu": "10127368",
            "urun_aciklama": "DIOPTRI TAKIMI "
        },
        {
            "urun_kodu": "10125806",
            "urun_aciklama": "RETİCLE BOROSCOPE"
        },
        {
            "urun_kodu": "10083677-1",
            "urun_aciklama": "BOYUN ASKISI, A200"
        },
        {
            "urun_kodu": "10095162",
            "urun_aciklama": "WFOV VIZ LENS 11"
        },
        {
            "urun_kodu": "10095179",
            "urun_aciklama": "WFOV NIR LENS 8"
        },
        {
            "urun_kodu": "10095187",
            "urun_aciklama": "NIR_ DOUBLET_1"
        },
        {
            "urun_kodu": "10095189",
            "urun_aciklama": "SLASH NIR FILTER"
        },
        {
            "urun_kodu": "10097063-11",
            "urun_aciklama": "A600 GECE GÖRÜŞ EKLENTİSİ"
        },
        {
            "urun_kodu": "10097063-1",
            "urun_aciklama": "A600 GECE GÖRÜŞ EKLENTİSİ"
        },
        {
            "urun_kodu": "CD-O 5315 00",
            "urun_aciklama": "KALİBRASYON LENSİ, N-BK7"
        },
        {
            "urun_kodu": "58001300",
            "urun_aciklama": "TABANCA REFLEKS V2"
        },
        {
            "urun_kodu": "TP0047791",
            "urun_aciklama": "GOVDE DUZ PERISKOP TIP 1"
        },
        {
            "urun_kodu": "TP0047793",
            "urun_aciklama": "GOVDE DUZ PERISKOP TIP 1 AYNA"
        },
        {
            "urun_kodu": "TP0047792",
            "urun_aciklama": "GOVDE DUZ PERISKOP TIP 2"
        },
        {
            "urun_kodu": "TP0047795",
            "urun_aciklama": "GOVDE DUZ PERISKOP TIP 2 AYNA SOL"
        },
        {
            "urun_kodu": "TP0047796",
            "urun_aciklama": "KULE DUZ PERISKOP TIP 1"
        },
        {
            "urun_kodu": "TP0047797",
            "urun_aciklama": "KULE DUZ PERISKOP TIP 2"
        },
        {
            "urun_kodu": "TP0047798",
            "urun_aciklama": "KULE DUZ PERISKOP TIP 3"
        },
        {
            "urun_kodu": "TP0047799",
            "urun_aciklama": "KULE DUZ PERISKOP TIP 1 AYNA KOMUTAN"
        },
        {
            "urun_kodu": "TP0047800",
            "urun_aciklama": "KULE DUZ PERISKOP TIP 1 AYNA DOLDURUCU"
        },
        {
            "urun_kodu": "TP0047794",
            "urun_aciklama": "GOVDE DUZ PERISKOP TIP 2 AYNA SAG"
        },
        {
            "urun_kodu": "22AR10-P10-OPT-L30",
            "urun_aciklama": "HR-MİROR HIGH "
        },
        {
            "urun_kodu": "22AR11-P10-OPT-L31",
            "urun_aciklama": "OC/Opto Coupler // Mercek"
        },
        {
            "urun_kodu": "22AR12-P12-OPT-L32",
            "urun_aciklama": "Q-SWİTCH LENS"
        },
        {
            "urun_kodu": "DGT2385836",
            "urun_aciklama": "LENS 1"
        },
        {
            "urun_kodu": "999900-20342:T0806",
            "urun_aciklama": "MEKANİK PARÇA İMALAT ÜRETİM"
        },
        {
            "urun_kodu": "422.20.09.300.0",
            "urun_aciklama": "LENS 17"
        },
        {
            "urun_kodu": "422.20.08.203.0",
            "urun_aciklama": "LENS 18"
        },
        {
            "urun_kodu": "58002400",
            "urun_aciklama": "95A27-13210-AA  M17 PERİSKOP"
        },
        {
            "urun_kodu": "58002050",
            "urun_aciklama": "LOOKUP PERISKOP / LOOKUP PERISCOPE"
        },
        {
            "urun_kodu": "ITS00049436",
            "urun_aciklama": "LENS 1 YTNS "
        },
        {
            "urun_kodu": "ITS00049437",
            "urun_aciklama": "LENS 2 YTNS "
        },
        {
            "urun_kodu": "ITS00049438-1",
            "urun_aciklama": "LENS 3 YTNS"
        },
        {
            "urun_kodu": "ITS00049439",
            "urun_aciklama": "LENS 4 YTNS"
        },
        {
            "urun_kodu": "191566",
            "urun_aciklama": "T-ASPHERIC"
        },
        {
            "urun_kodu": "R82091610.K",
            "urun_aciklama": "ALT İÇ GÖVDE FASON KALEMİ"
        },
        {
            "urun_kodu": "R82091920-YD",
            "urun_aciklama": "MAKARA"
        },
        {
            "urun_kodu": "912172",
            "urun_aciklama": "UKS-A LIDT Test samples"
        },
        {
            "urun_kodu": "79441",
            "urun_aciklama": "LENS 4"
        },
        {
            "urun_kodu": "79444",
            "urun_aciklama": "LENS 5"
        },
        {
            "urun_kodu": "10084930",
            "urun_aciklama": "A100-NEUTRAL DENSITY FILTER"
        },
        {
            "urun_kodu": "30005995",
            "urun_aciklama": "A100-BAŞ BANDI "
        },
        {
            "urun_kodu": "10063321-1",
            "urun_aciklama": "F5.5.CONT.ZOOM.CELL LENS 1"
        },
        {
            "urun_kodu": "10063326-1",
            "urun_aciklama": "F5.5.CONT.ZOOM. ARALAYICI SABİT GÖVDE"
        },
        {
            "urun_kodu": "10065458",
            "urun_aciklama": "A341 LENS 4 OBJ."
        },
        {
            "urun_kodu": "10082011",
            "urun_aciklama": "A100-EYEPIECE LENS 3 "
        },
        {
            "urun_kodu": "10085558",
            "urun_aciklama": "A100- GÜNDÜZ EĞİTİM FİLTRESİ"
        },
        {
            "urun_kodu": "SK 00038",
            "urun_aciklama": "LEXMARK X658 DTME YAZICI"
        },
        {
            "urun_kodu": "10082842-1",
            "urun_aciklama": "A100 OKÜLER HAFİF TAKIMI"
        },
        {
            "urun_kodu": "10104141",
            "urun_aciklama": "31 MM KOLİMATÖR TAKIMI (KIT)"
        },
        {
            "urun_kodu": "10101837",
            "urun_aciklama": "BOROSCOPE TAKIM CİHAZI"
        },
        {
            "urun_kodu": "10101236",
            "urun_aciklama": "A600, OBJEKTİF ODAK, ÇEVİRME HALKASI"
        },
        {
            "urun_kodu": "10086029-1",
            "urun_aciklama": "A600 ÜST GÖVDE TAKIMI"
        },
        {
            "urun_kodu": "10098627",
            "urun_aciklama": "A600 KART KABLAJ TAKIMI"
        },
        {
            "urun_kodu": "10094473",
            "urun_aciklama": "A600 OBJ. LENS 4"
        },
        {
            "urun_kodu": "10103046-11-SKD",
            "urun_aciklama": "A900/A901 GÜNDÜZ NİŞANGAH SİSTEMİ MGEOKGK-150"
        },
        {
            "urun_kodu": "10103046-11-CKD",
            "urun_aciklama": "A900/A901 GÜNDÜZ NİŞANGAH SİSTEMİ MGEOKGK-150"
        },
        {
            "urun_kodu": "10103046-12-SKD",
            "urun_aciklama": "A900/A901 GÜNDÜZ NİŞANGAH SİSTEMİ MGEOKGK-150"
        },
        {
            "urun_kodu": "10103046-12-CKD",
            "urun_aciklama": "A900/A901 GÜNDÜZ NİŞANGAH SİSTEMİ MGEOKGK-150"
        },
        {
            "urun_kodu": "10103022",
            "urun_aciklama": "AVCI V4 OBJ. DOUBLET (LENS-4-LENS-5)"
        },
        {
            "urun_kodu": "10105323",
            "urun_aciklama": "A600 SİLAH ADAPTÖRÜ 16.8MM"
        },
        {
            "urun_kodu": "30008486",
            "urun_aciklama": "A600, BATARYA ŞARJ CİHAZI"
        },
        {
            "urun_kodu": "10103046-3",
            "urun_aciklama": "A960 GÜNDÜZ NİŞANGAH SİSTEMİ"
        },
        {
            "urun_kodu": "10091753",
            "urun_aciklama": "ATS 70 SOĞUTMASIZ SÜREKLİ OBJ."
        },
        {
            "urun_kodu": "10102762-3",
            "urun_aciklama": "KABLAJ, MOTOR"
        },
        {
            "urun_kodu": "10102762-4",
            "urun_aciklama": "KABLAJ, MOTOR"
        },
        {
            "urun_kodu": "10107053",
            "urun_aciklama": "ARN-12K MONTE HAMİLİ"
        },
        {
            "urun_kodu": "10103046-1",
            "urun_aciklama": "A940 GÜNDÜZ NİŞANGAHI CİHAZ"
        },
        {
            "urun_kodu": "10070752-1",
            "urun_aciklama": "A210 KART KABLAJ TAKIMI"
        },
        {
            "urun_kodu": "AR17-P2480631",
            "urun_aciklama": "UG11, DIA70.8x1.5"
        },
        {
            "urun_kodu": "10105236-2",
            "urun_aciklama": "60 MM ATERMAL OBJ. TAKIMI (SARI)"
        },
        {
            "urun_kodu": "10072048",
            "urun_aciklama": "OPTİK TEMİZLEME KİTİ"
        },
        {
            "urun_kodu": "10084678-7",
            "urun_aciklama": "TAKIM KAPAK MİNİ TSD"
        },
        {
            "urun_kodu": "10084678-9",
            "urun_aciklama": "TAKIM KAPAK MİNİ TSD"
        },
        {
            "urun_kodu": "SK 00210",
            "urun_aciklama": "CANON MF645CX YAZICI"
        },
        {
            "urun_kodu": "10030870",
            "urun_aciklama": "PATRİAL REFLAKTÖR"
        },
        {
            "urun_kodu": "10103226-1",
            "urun_aciklama": "35 MM ATERMAL OBJ. TKM. GRAPHITE BLACK"
        },
        {
            "urun_kodu": "SK 00283",
            "urun_aciklama": "XEROX WORKCENTRE 3345 YAZICI"
        },
        {
            "urun_kodu": "10086640",
            "urun_aciklama": "3X UZATMA OPTİK TAKIMI"
        },
        {
            "urun_kodu": "SK18-P2687451-002",
            "urun_aciklama": "KOLİMATÖR AYARLANABİLİR ÖLÇÜM DÜZENEĞİ"
        },
        {
            "urun_kodu": "SK18-P2687451-003",
            "urun_aciklama": "A600 OPTİK TEST DÜZENEĞİ"
        },
        {
            "urun_kodu": "D2181640",
            "urun_aciklama": "WC009 10X42 BINOCULAR  "
        },
        {
            "urun_kodu": "10084678-10",
            "urun_aciklama": "TAKIM KAPAK MİNİ TSD"
        },
        {
            "urun_kodu": "10106300-001",
            "urun_aciklama": "34 MM DÜRBÜN MONTE HAMİLİ"
        },
        {
            "urun_kodu": "10103046-43",
            "urun_aciklama": "A940 TÜRKÇE 5.56 TROY COYOTE TAN"
        },
        {
            "urun_kodu": "10097063-25",
            "urun_aciklama": "A600 GECE GÖRÜŞ EKLENTİSİ"
        },
        {
            "urun_kodu": "10103046-13",
            "urun_aciklama": "A940 GÜNDÜZ NİŞANGAH TÜRKÇE 5.56/7.62 GB"
        },
        {
            "urun_kodu": "10103046-15",
            "urun_aciklama": "A960 GÜNDÜZ NİŞANGAHI CİHAZ"
        },
        {
            "urun_kodu": "10103046-19",
            "urun_aciklama": "A940 GÜNDÜZ NİŞANGAHI TÜRKÇE 7.62 GRAPHITE BLACK"
        },
        {
            "urun_kodu": "10095566-3",
            "urun_aciklama": "A600 OBJEKTİF TAKIMI"
        },
        {
            "urun_kodu": "10095568-3",
            "urun_aciklama": "A600, GÖVDE (SARI)"
        },
        {
            "urun_kodu": "10095586-3",
            "urun_aciklama": "A600, KOLİMATÖR AYAR, GÖVDE, SABİT (SARI)"
        },
        {
            "urun_kodu": "10113907",
            "urun_aciklama": "KORUYUCU KAPAK 60MM KNOBLU"
        },
        {
            "urun_kodu": "SK 00447",
            "urun_aciklama": "TRIUMPH ADLER P-2540I-MFP A3-A4 YAZICI"
        },
        {
            "urun_kodu": "AB-0000-0891",
            "urun_aciklama": "UGES ELEKTROMEKANİK MONTAJ İŞLEM"
        },
        {
            "urun_kodu": "10061951-16",
            "urun_aciklama": "A100 GECE GÖRÜŞ GÖVDE TAKIMI"
        },
        {
            "urun_kodu": "10084678-14",
            "urun_aciklama": "TAKIM KAPAK MİNİ TSD"
        },
        {
            "urun_kodu": "10114020-1",
            "urun_aciklama": "ANA GÖVDE, 3X-4X (SİYAH)"
        },
        {
            "urun_kodu": "10104106-10",
            "urun_aciklama": "3-12X50 KESKİN NİŞANCI DÜRBÜNÜ TAKIMI "
        },
        {
            "urun_kodu": "10097063-9",
            "urun_aciklama": "A600 GECE GÖRÜŞ EKLENTİSİ"
        },
        {
            "urun_kodu": "10092700",
            "urun_aciklama": "OPTİK TAKIM 22MM OKÜLER FÜZYON"
        },
        {
            "urun_kodu": "10103046-21",
            "urun_aciklama": "A940 GÜNDÜZ NİŞANGAHI CİHAZ"
        },
        {
            "urun_kodu": "10033460-2",
            "urun_aciklama": "NAMLU REFLEKS KOLİMATÖRÜ"
        },
        {
            "urun_kodu": "10106300-301",
            "urun_aciklama": "34 MM DÜRBÜN MONTE HAMİLİ"
        },
        {
            "urun_kodu": "10086235",
            "urun_aciklama": "T LEGGOB OLED LENS 6"
        },
        {
            "urun_kodu": "AB-0000-0510",
            "urun_aciklama": "UGES ELEKTROMEKANİK ONARIM İŞLEM"
        },
        {
            "urun_kodu": "HETS-1004-R05",
            "urun_aciklama": "LENS (HETS-1004-R05)"
        },
        {
            "urun_kodu": "HETS-1032-R02",
            "urun_aciklama": "LENS (HETS-1032-R02)"
        },
        {
            "urun_kodu": "HETS-1031-R05",
            "urun_aciklama": "LENS (HETS-1031-R05)"
        },
        {
            "urun_kodu": "HETS-1033-R06",
            "urun_aciklama": "LENS (HETS-1033-R06)"
        },
        {
            "urun_kodu": "HETS-1034-R01",
            "urun_aciklama": "LENS (HETS-1034-R01)"
        },
        {
            "urun_kodu": "HETS-1036-R06",
            "urun_aciklama": "LENS (HETS-1036-R06)"
        },
        {
            "urun_kodu": "AB-0000-1095",
            "urun_aciklama": "UGES ELEKTROMEKANİK ONARIM İŞLEM"
        },
        {
            "urun_kodu": "10061960-27 LOT",
            "urun_aciklama": "A100 MONOKULER GECE GÖRÜŞ GÖZLÜĞÜ"
        },
        {
            "urun_kodu": "AB-0000-3024",
            "urun_aciklama": "UGES TAKIM KAMERA ODİNOKS ÜRETİM"
        },
        {
            "urun_kodu": "10118500",
            "urun_aciklama": "LENS3_MRCHO_OBJ"
        },
        {
            "urun_kodu": "10118501",
            "urun_aciklama": "LENS4_MRCHO_OBJ"
        },
        {
            "urun_kodu": "10118502",
            "urun_aciklama": "DOUBLET MRCHO OBJ"
        },
        {
            "urun_kodu": "10070496",
            "urun_aciklama": "OBJ 108 V2 LENS-7"
        },
        {
            "urun_kodu": "AB-0000-3060",
            "urun_aciklama": "UGES ELEKTROMEKANİK MONTAJ + TEST"
        },
        {
            "urun_kodu": "10033460-1 ALT TAKIM",
            "urun_aciklama": "NAMLU REFLEKS KOLİMATÖRÜ"
        },
        {
            "urun_kodu": "10120867",
            "urun_aciklama": "RETICLE, DUPLEX, A341"
        },
        {
            "urun_kodu": "MN-9972-0010",
            "urun_aciklama": "CAM TEMPER ÇAP56.5x3"
        },
        {
            "urun_kodu": "10121228",
            "urun_aciklama": "TAKS L UZATMA LENS 3"
        },
        {
            "urun_kodu": "10121227",
            "urun_aciklama": "TAKS L UZATMA LENS 2"
        },
        {
            "urun_kodu": "10121226",
            "urun_aciklama": "TAKS L UZATMA LENS 1"
        },
        {
            "urun_kodu": "10116469",
            "urun_aciklama": "LENS 1, ROA LRF"
        },
        {
            "urun_kodu": "10116470",
            "urun_aciklama": "LENS 2, ROA LRF"
        },
        {
            "urun_kodu": "10116471",
            "urun_aciklama": "LENS 3, ROA LRF"
        },
        {
            "urun_kodu": "10118264",
            "urun_aciklama": "6X 6DEG PECHAN PRISM"
        },
        {
            "urun_kodu": "10119225",
            "urun_aciklama": "CAM ÖN KAPAK"
        },
        {
            "urun_kodu": "AR20-P2633631-022",
            "urun_aciklama": "OMTTZA KC BOR ARKA DOUBLET"
        },
        {
            "urun_kodu": "AR20-P2633631-023",
            "urun_aciklama": "OMTTZA KC BOR ÖN DOUBLET"
        },
        {
            "urun_kodu": "AR20-P2633631-026",
            "urun_aciklama": "OMTTZA KC BOR ÖN PRİZ"
        },
        {
            "urun_kodu": "AR20-P2633631-027",
            "urun_aciklama": "OMTTZA KC BOR ARKA PRİZ"
        },
        {
            "urun_kodu": "AR16-U2400280-131.K",
            "urun_aciklama": "PENCERE-A53001 (KAPLAMASIZ)"
        },
        {
            "urun_kodu": "10103180",
            "urun_aciklama": "OBJEKTİF TAKIMI, KGYS"
        },
        {
            "urun_kodu": "AR20-U2400220-18",
            "urun_aciklama": "LRF PENCERE"
        },
        {
            "urun_kodu": "137872",
            "urun_aciklama": "DPK\"\"YI DIŞ DÖVDEYE BAĞLAMA APARATI ALT"
        },
        {
            "urun_kodu": "137931",
            "urun_aciklama": "DPK BAĞLAMA ÜST GÖVDE"
        },
        {
            "urun_kodu": "138145",
            "urun_aciklama": "ALTLIK, RIS1614"
        },
        {
            "urun_kodu": "10061960-25",
            "urun_aciklama": "A100 MONOKULER GECE GÖRÜŞ GÖZLÜĞÜ"
        },
        {
            "urun_kodu": "10097063-29",
            "urun_aciklama": "A600 GECE GÖRÜŞ EKLENTİSİ"
        },
        {
            "urun_kodu": "10084678-1",
            "urun_aciklama": "TAKIM KAPAK MİNİ TSD"
        },
        {
            "urun_kodu": "10111844-5",
            "urun_aciklama": "TAKIM TSD-MR MERMİSAYAR"
        },
        {
            "urun_kodu": "30005230",
            "urun_aciklama": "BATARYA(LI-ION 7.4V-3.25AH)"
        },
        {
            "urun_kodu": "30001521",
            "urun_aciklama": "BAT_CHARGER(LI-ION,8.4V,13.86W)"
        },
        {
            "urun_kodu": "30007805",
            "urun_aciklama": "GÖZ LASTİĞİ ÖNDER"
        },
        {
            "urun_kodu": "10115574",
            "urun_aciklama": "A100-3X EXTENDER, COVER ASSEMBLY"
        },
        {
            "urun_kodu": "10116971",
            "urun_aciklama": "NAKLİYE ÇANTASI TAKIMI,A200"
        },
        {
            "urun_kodu": "10095154",
            "urun_aciklama": "WFOV VIZ LENS 3 "
        },
        {
            "urun_kodu": "10095156",
            "urun_aciklama": "WFOV VIZ LENS 5 "
        },
        {
            "urun_kodu": "10095159",
            "urun_aciklama": "WFOV VIZ LENS 8"
        },
        {
            "urun_kodu": "10095160",
            "urun_aciklama": "WFOV VIZ LENS 9"
        },
        {
            "urun_kodu": "10095161",
            "urun_aciklama": "WFOV VIX LENS 10"
        },
        {
            "urun_kodu": "10095163",
            "urun_aciklama": "WFOV VIZ LENS 12"
        },
        {
            "urun_kodu": "10095164",
            "urun_aciklama": "WFOV VIZ LENS 13"
        },
        {
            "urun_kodu": "10095165",
            "urun_aciklama": "WFOV VIZ LENS14 "
        },
        {
            "urun_kodu": "10095168",
            "urun_aciklama": "WFOV VIZ LENS 6 AND LENS 7 ASSEMBLY"
        },
        {
            "urun_kodu": "10095174",
            "urun_aciklama": "WFOV NIR LENS 3"
        },
        {
            "urun_kodu": "10095175",
            "urun_aciklama": "WFOV NIR LENS 4"
        },
        {
            "urun_kodu": "10095176",
            "urun_aciklama": "WFOV NIR LENS 5"
        },
        {
            "urun_kodu": "10095180",
            "urun_aciklama": "WFOV NIR LENS 9"
        },
        {
            "urun_kodu": "10095181",
            "urun_aciklama": "WFOV NIR LENS 10"
        },
        {
            "urun_kodu": "10095182",
            "urun_aciklama": "WFOV NIR LENS 11"
        },
        {
            "urun_kodu": "10095183",
            "urun_aciklama": "WFOV NIR LENS 12"
        },
        {
            "urun_kodu": "10095184",
            "urun_aciklama": "WFOV NIR LENS 13 "
        },
        {
            "urun_kodu": "10095185",
            "urun_aciklama": "WFOV NIR LENS 14"
        },
        {
            "urun_kodu": "10095186",
            "urun_aciklama": "WFOV NIR LENS 15"
        },
        {
            "urun_kodu": "10095188",
            "urun_aciklama": "WFOV NIR DOUBLET 2"
        },
        {
            "urun_kodu": "10095166",
            "urun_aciklama": "WFOV VIZ LENS15"
        },
        {
            "urun_kodu": "10085706-2",
            "urun_aciklama": "NAKLIYE ÇANTASI, MINI TSD ENG"
        },
        {
            "urun_kodu": "10085707-2",
            "urun_aciklama": "TAŞIMA ÇANTASI, MİNİ TSD"
        },
        {
            "urun_kodu": "10109252",
            "urun_aciklama": "ATMACA VISIBLE WINDOW"
        },
        {
            "urun_kodu": "10108911-5",
            "urun_aciklama": "ARKA KAPAK TAKIMI TSD MR"
        },
        {
            "urun_kodu": "10119362",
            "urun_aciklama": "CAM ÖN KAPAK, 9X"
        },
        {
            "urun_kodu": "R82091610",
            "urun_aciklama": "ALT İÇ GÖVDE FASON KALEMİ"
        },
        {
            "urun_kodu": "93446",
            "urun_aciklama": "KAPAK, RIS 1614"
        },
        {
            "urun_kodu": "93447",
            "urun_aciklama": "GÖVDE, RIS 1614"
        },
        {
            "urun_kodu": "58001200",
            "urun_aciklama": "TABANCA REFLEKS NISANGAH, PRS20-120"
        },
        {
            "urun_kodu": "10117010-2",
            "urun_aciklama": "ATERMAL OBJEKTİF TAKIMI, 50MM"
        },
        {
            "urun_kodu": "10061951-15",
            "urun_aciklama": "A100 GECE GÖRÜŞ GÖVDE TAKIMI"
        },
        {
            "urun_kodu": "AR21-U2400220-071",
            "urun_aciklama": "BK7 1535 AR KAPLAMA"
        },
        {
            "urun_kodu": "AR21-P2662091-045",
            "urun_aciklama": "LEON LMAG PENCERE"
        },
        {
            "urun_kodu": "D218641",
            "urun_aciklama": "Optik Kalıp Lokması"
        },
        {
            "urun_kodu": "D1181135",
            "urun_aciklama": "POLYGON AYNA PARÇASI"
        },
        {
            "urun_kodu": "10123443",
            "urun_aciklama": "OPTİK FİLTRE TAKIMI"
        },
        {
            "urun_kodu": "AR21-P2535091-022",
            "urun_aciklama": "A940 (SİYAH) MİLDOT RETICLE"
        },
        {
            "urun_kodu": "AR21-P2535091-023",
            "urun_aciklama": "A940 (Çöl Sarısı) Mildot Reticle"
        },
        {
            "urun_kodu": "AR21-P2535091-024",
            "urun_aciklama": "A960 (Siyah) Mildot Reticle"
        },
        {
            "urun_kodu": "AR21-P2535091-025",
            "urun_aciklama": "A960 (Çöl Sarısı) Mildot Reticle"
        },
        {
            "urun_kodu": "130922",
            "urun_aciklama": "SINGLET LENS 3"
        },
        {
            "urun_kodu": "130920",
            "urun_aciklama": "DOUBLET 1-WT, TV-125 L1-L2"
        },
        {
            "urun_kodu": "10070710-35",
            "urun_aciklama": "A200 GECE GÖRÜŞ EL DÜRBÜNÜ, SİSTEM"
        },
        {
            "urun_kodu": "MN-9090-0006",
            "urun_aciklama": "ANTİREFLEKTİF TAMPERLİ CAM"
        },
        {
            "urun_kodu": "154281",
            "urun_aciklama": "AÇIK KANAT KİLİT DÜZ PIN"
        },
        {
            "urun_kodu": "154336",
            "urun_aciklama": "ALTERNATİF KİLİT ELİPS YOL"
        },
        {
            "urun_kodu": "154366",
            "urun_aciklama": "ALTERNATİF KİLİT ELİPS KİLİT PİMİ"
        },
        {
            "urun_kodu": "164835",
            "urun_aciklama": "AİRFOİL KANAT KİLİT INSERTU"
        },
        {
            "urun_kodu": "168485",
            "urun_aciklama": "GÖVDE ÖN SAC KAİDE"
        },
        {
            "urun_kodu": "168561",
            "urun_aciklama": "GÖVDE ARKA SAC KAİDE"
        },
        {
            "urun_kodu": "169173",
            "urun_aciklama": "FMSK BACKSHELL"
        },
        {
            "urun_kodu": "169182",
            "urun_aciklama": "AK FMSK KAPAK"
        },
        {
            "urun_kodu": "169183",
            "urun_aciklama": "AÇILIR KANAT ŞAFTI"
        },
        {
            "urun_kodu": "REFLEX PLASTİC 1",
            "urun_aciklama": "GLOCK REFLEKS LENS, PLASTIC"
        },
        {
            "urun_kodu": "10119239-2",
            "urun_aciklama": "ALRF-S50 SİSTEM ÜST TAKIMI"
        },
        {
            "urun_kodu": "AHO-000155",
            "urun_aciklama": "GLOCK REFLEKS WINDOW"
        },
        {
            "urun_kodu": "10111844-7",
            "urun_aciklama": "TSD-MR MERMİSAYAR"
        },
        {
            "urun_kodu": "22AR05-P01-OPT-L10",
            "urun_aciklama": "GLOCK REFLEKS LENS GLASS"
        },
        {
            "urun_kodu": "10070710-13",
            "urun_aciklama": "A200 GECE GÖRÜŞ EL DÜRBÜNÜ, SİSTEM"
        },
        {
            "urun_kodu": "DIGITEST-1",
            "urun_aciklama": "OC/Opto Coupler // Mercek"
        },
        {
            "urun_kodu": "DIGITEST-2",
            "urun_aciklama": "HR/Hight Reflectör // Mercek"
        },
        {
            "urun_kodu": "T30011404",
            "urun_aciklama": "TANK HİZALAMA OPTİĞİ"
        },
        {
            "urun_kodu": "AR22-P2191441-408",
            "urun_aciklama": "IRST FSM AYNA "
        },
        {
            "urun_kodu": "10033460-2",
            "urun_aciklama": "TAKIM, NAMLU REFLEKS KOLİMATÖRÜ"
        },
        {
            "urun_kodu": "10087523-1",
            "urun_aciklama": "A301 OKÜLER ALT TAKIMI"
        },
        {
            "urun_kodu": "10102977",
            "urun_aciklama": "AVCI V4 FILTER"
        },
        {
            "urun_kodu": "10102975",
            "urun_aciklama": "AVCI V4 OBJ. LENS 6"
        },
        {
            "urun_kodu": "AR-19-00009300-056",
            "urun_aciklama": "3-12X50 PARALLAX AYAR DÜĞMESİ GURUBU"
        },
        {
            "urun_kodu": "AR-19-00009300-057",
            "urun_aciklama": "3-12X50 YÜKSELİŞ AYAR DÜĞMESİ GURUBU"
        },
        {
            "urun_kodu": "AR-19-00009300-058",
            "urun_aciklama": "3-12X50 YANCA AYAR DÜĞMESİ GURUBU"
        },
        {
            "urun_kodu": "10084678-13",
            "urun_aciklama": "TAKIM KAPAK MİNİ TSD"
        },
        {
            "urun_kodu": "MM-7803-0003",
            "urun_aciklama": "GOVDE AL KAMERA RAL7001"
        },
        {
            "urun_kodu": "10102971",
            "urun_aciklama": "AVCI V4 OBJ. LENS 2"
        },
        {
            "urun_kodu": "10102972",
            "urun_aciklama": "AVCI V4 OBJ. LENS 3"
        },
        {
            "urun_kodu": "10102970",
            "urun_aciklama": "AVCI V4 OBJ. LENS 1"
        },
        {
            "urun_kodu": "10103046-5",
            "urun_aciklama": "5X BÜYÜTME OPTİK TAKIMI"
        },
        {
            "urun_kodu": "10103226-3",
            "urun_aciklama": "35 MM ATERMAL OBJ. TKM. TROY COYOTE TAN"
        },
        {
            "urun_kodu": "SK18-P2687451-001",
            "urun_aciklama": "REFLEKS NİŞANGAH TEST SETUP"
        }
    ]
    for (let element of data) {

        const result = await pool.query(`INSERT INTO maliyet_satis_urun (urun_kodu,urun_aciklama) VALUES($1,$2)`, [element.urun_kodu,element.urun_aciklama])

    }


    res.status(200).json({ status: 200, data: data })
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
         ORDER BY linee.DATE_ DESC 
        `
            )
            if (hareketQuery.rowsAffected > 0) {
                let hareketResult = hareketQuery.recordsets[0]


                for (let element of hareketResult) {

                    if (element.DATE_) {
                        let lastPurchaseDate = new Date(element.DATE_); // SQL tarihini Date objesine çevir
                        let gunFarki = Math.floor((today - lastPurchaseDate) / (1000 * 60 * 60 * 24)); // Gün farkını hesapla

                        await pool.query(depoUpdateTigerQuery, [urun_kodu, gunFarki]);
                    }


                }
            } else {
                let cariKodlar = [225, 224, 223, 220, 219]
                let kacinci = cariKodlar.findIndex(s => s == cari_yil);
                if (kacinci > -1) {
                    let sonrakiCariKod = cariKodlar[kacinci + 1];
                    if (sonrakiCariKod) {
                        sonHareketBul(sonrakiCariKod, urun_kodu);

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
        const mssqlPool = await poolPromises; // MSSQL bağlantısı
        const tigerCariOku = mssqlPool.request();
        const siparisCek = await tigerCariOku.query(
            `  SELECT
                                CONVERT(nvarchar, ORF.DATE_, 104) AS tarih,    ORF.DOCODE AS [siparis_kodu], 
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
								AND ITM.CODE LIKE '${item.urun_kodu}'	AND ORL.PRICE>0
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
								AND ORF.STATUS = 4     AND ITM.CODE LIKE '${item.urun_kodu}'	AND ORL.PRICE>0
                                GROUP BY
                                ORF.DOCODE,    CONVERT(nvarchar, ORF.DATE_, 104),  	ORL.USREF,
									ORL.UOMREF,ITM.LOGICALREF,  PR.CODE,    ITM.CODE,    ITM.DEFINITION_,     PY.CODE,    ORL.PRICE,    ORL.TRCURR,    ORF.TRCURR,    ORL.TRRATE,    ORF.GROSSTOTAL,    ORF.TOTALVAT,    ORF.NETTOTAL
                            ORDER BY tarih
`
        )

        if (siparisCek.recordset && siparisCek.recordset.length > 0) {
            let satinAlmaSiparis = siparisCek.recordsets[0]
            for (let data of satinAlmaSiparis) {
                const parts = data.tarih.split("."); // Noktadan ayırıyoruz

                const month = parseInt(parts[1], 10); // Ay
                const year = parseInt(parts[2], 10);  // Yıl
                const indexCarpanResult = await pool.query(indexSearch, [year, month])
                let siparisSayisi = await pool.query(`SELECT * FROM  maliyet_satin_alma_siparis WHERE urun_kod =$1`, [urun_kodu])
                let siparisVarmi = await pool.query(`SELECT * FROM  maliyet_satin_alma_siparis WHERE urun_kod =$1 AND sas_kod = $2`, [urun_kodu, data.siparis_kodu])
                if (siparisSayisi.rowCount <= 5 && siparisVarmi.rowCount == 0) {

                    let indexs = indexCarpanResult.rows[0].index

                    const insertSas = await pool.query(`INSERT INTO maliyet_satin_alma_siparis(
	urun_kod, urun_aciklama, sas_tarih, sas_kod, sas_miktar, birim_fiyat) VALUES($1,$2,$3,$4,$5,$6)`,
                        [urun_kodu, data.MALZEME, data.tarih, data.siparis_kodu, data.siparis_adet, (data.birim_fiyat * indexs)])
                    const ortalamaBirimFiyatHesapla = await pool.query(`UPDATE maliyet_urun_birim_fiyat SET birim_fiyat = (
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
WHERE urun_kodu ='${urun_kodu}' `)
                }
            }
        }
        let siparisSayisi = await pool.query(`SELECT COUNT(urun_kod) as say FROM  maliyet_satin_alma_siparis WHERE urun_kod =$1`, [urun_kodu])
        let cariKodlar = [225, 224, 223, 220, 219]
        let kacinci = cariKodlar.findIndex(s => s == cari_yil);


        if (kacinci > -1) {
            let sonrakiCariKod = cariKodlar[kacinci + 1];
            if (sonrakiCariKod > 220) {
                if (siparisSayisi.rows[0].say <= 5 && sonrakiCariKod >= 219) {
                    // Eğer sipariş sayısı 5 veya daha azsa ve sonraki kod 219'dan büyük veya eşitse çalıştır (219 ve 220 hariç)

                    sasCekMaliyet(sonrakiCariKod, urun_kodu);

                }

            } else {
                if (siparisSayisi.rows[0].say == 0 && sonrakiCariKod >= 219) {
                    // Eğer sipariş sayısı 5 veya daha azsa ve sonraki kod 219'dan büyük veya eşitse çalıştır (219 ve 220 hariç)

                    sasCekMaliyet(sonrakiCariKod, urun_kodu);

                }
            }
        }
    } catch (error) {
        console.error(error)
    }
    //  finally {
    //     // Bağlantıyı kapat
    //     if (mssqlPool) {
    //         await mssqlPool.close();
    //      

    //     }
    // }


}
async function bomCek(code, cari_yil) {
    const mssqlPool = await poolPromises; // MSSQL bağlantısı
    const tigerCariOku = mssqlPool.request();


    // Daha önce işlenen ürün kodlarını saklamak için bir set
    const visitedCodes = new Set();

    const fetchBomData = async (kod) => {
        if (visitedCodes.has(kod)) return []; // Eğer kod daha önce işlendiyse tekrar sorgulama
        visitedCodes.add(kod); // İşlenmiş kodları sakla

        const msqlBomListQuery = await tigerCariOku.query(`
            SELECT item.CODE as ana_urun, item.NAME as ana_urun_aciklama, line.AMOUNT,
                   (SELECT NAME FROM LG_${cari_yil}_ITEMS WHERE LOGICALREF = line.ITEMREF) AS NAME,
                   (SELECT CODE FROM LG_${cari_yil}_ITEMS WHERE LOGICALREF = line.ITEMREF) AS CODE
            FROM LG_${cari_yil}_BOMASTER bom 
            INNER JOIN LG_${cari_yil}_ITEMS item ON item.CODE = '${kod}' AND bom.MAINPRODREF = item.LOGICALREF 
            INNER JOIN LG_${cari_yil}_BOMLINE line ON line.BOMMASTERREF = bom.LOGICALREF 
            WHERE bom.ACTIVE = 0 AND bom.BOMTYPE = 1
        `);
        return msqlBomListQuery.recordset ?? [];
    };

    const processBomLevel = async (bomList, level) => {
        const result = [];

        for (const element of bomList) {
            element.level = level;
            if (element.CODE && element.CODE !== element.ana_urun) {
                const subComponentData = await fetchBomData(element.CODE);
                const processedSubComponents = await processBomLevel(subComponentData, level + 1);
                result.push(...processedSubComponents);
            }
        }

        result.push(...bomList);
        return result;
    };

    // İlk seviye için BOM listesi al
    const initialBomList = await fetchBomData(code);
    const bomlist = await processBomLevel(initialBomList, 0);
    if (!bomlist || bomlist.length === 0) {
        const cariKodlar = [225, 224, 223, 220, 219];
        const currentIndex = cariKodlar.findIndex(y => y == cari_yil);

        if (currentIndex !== -1 && currentIndex + 1 < cariKodlar.length) {
            return await bomCek(code, cariKodlar[currentIndex + 1]);
        } else {
            return;
        }
    }
    // Önceki BOM verilerini temizle
    await pool.query(`DELETE FROM maliyet_bom WHERE ana_urun = '${code}' `);

    // Yeni BOM verilerini ekle
    for (const element of bomlist) {
        const veriVarMi = await pool.query(
            `SELECT * FROM maliyet_bom WHERE ana_urun = '${element.ana_urun}' AND kod = '${element.CODE}' AND  ana_urun = '${code}'`
        );
        if (veriVarMi.rowCount === 0) {
            const insertNewBom = await pool.query(`
                INSERT INTO maliyet_bom (ust_kod, ust_malzeme, kod, malzeme, miktar, seviye, ana_urun)
                VALUES ('${element.ana_urun}', '${element.ana_urun_aciklama}', '${element.CODE}', '${element.NAME}', ${element.AMOUNT}, ${element.level}, '${code}')
            `);
            if (insertNewBom.rowCount > 0) {
                const depoKontrol = await pool.query(`SELECT * FROM maliyet_urun_birim_fiyat WHERE urun_kodu = $1`, [element.CODE]);
                if (depoKontrol.rowCount === 0) {
                    await pool.query(`
                        INSERT INTO maliyet_urun_birim_fiyat (urun_kodu)
                        VALUES ($1)
                    `, [element.CODE]);
                    await sasCekMaliyet(cari_yil, element.CODE);
                }
            }
        }
    }

}
