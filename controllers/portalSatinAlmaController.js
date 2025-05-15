

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


exports.satinAlmaSiparisHesapla = async (req, res) => {
    const { ay } = req.body;
    try {
        const mssqlPool = await poolPromises;
        const tigerCariOku = mssqlPool.request();

        const tigerSqlDepo = `
          SELECT CONVERT(nvarchar, ORF.DATE_, 104) AS tarih, MONTH(ORF.DATE_) AS 'AY' ,    ORF.DOCODE AS [siparis_kodu],   
           (SELECT TOP 1 ([POBIRIMFIYATINDIRIMI]-[POINDIRIMILISONFIYAT])
 FROM [AHO_SATINALMA_SIPARIS] 
 WHERE [PONUMARASI]=ORF.DOCODE AND [POKALEMKOD]=ITM.CODE) as indirimTL,
        (SELECT TOP 1 ([POBIRIMFIYATINDIRIMI]-[POINDIRIMILISONFIYAT])/(SELECT kur.kur FROM PBI_KUR as  kur WHERE CONVERT(nvarchar, kur.TARİH, 104)=CONVERT(nvarchar, POTARIH, 104))
 FROM [AHO_SATINALMA_SIPARIS] 
 WHERE [PONUMARASI]=ORF.DOCODE AND [POKALEMKOD]=ITM.CODE) as indirim,
                                PR.CODE AS [proje_kod],    ITM.CODE AS KOD,    ITM.NAME AS MALZEME,    SUM(ORL.AMOUNT) AS siparis_adet, 
                                SUM(ORL.SHIPPEDAMOUNT) AS [karsilanan_siparis],
                                SUM(ORL.AMOUNT - ORL.SHIPPEDAMOUNT) AS [acik_siparis],  
                                   ((ORL.PRICE))/(SELECT kur.kur FROM PBI_KUR as  kur WHERE CONVERT(nvarchar, kur.TARİH, 104)=CONVERT(nvarchar, ORF.DATE_, 104)) AS birim_fiyat, 
                                   ((ORL.PRICE)) AS birim_fiyat1, 
                                    ORL.TRRATE AS 'KUR',
                                    ORL.USREF,
                                    ORL.UOMREF,
                                    ITM.LOGICALREF
                                    FROM LG_225_01_ORFLINE AS ORL
                                    INNER JOIN LG_225_01_ORFICHE AS ORF ON ORL.ORDFICHEREF = ORF.LOGICALREF
                                    INNER JOIN LG_225_ITEMS AS ITM ON ORL.STOCKREF = ITM.LOGICALREF
                                    INNER JOIN LG_225_ITMUNITA AS unt ON unt.ITEMREF = ITM.LOGICALREF AND unt.UNITLINEREF = ORL.UOMREF
                                    INNER JOIN LG_225_PROJECT AS PR ON ORL.PROJECTREF = PR.LOGICALREF
                                    FULL OUTER JOIN LG_225_PAYPLANS AS PY ON ORL.PAYDEFREF = PY.LOGICALREF
                            WHERE
                                (ORL.LINETYPE = 0)     AND (ORL.TRCODE = 2)     AND ORF.CANCELLED = 0     AND ORL.CLOSED = 0     AND ORF.STATUS = 4    
                                AND ORL.PRICE>0 AND MONTH(ORF.DATE_)=${ay}
                            GROUP BY
                                ORF.DOCODE,
                                CONVERT(nvarchar, ORF.DATE_, 104), MONTH(ORF.DATE_) ,
                                PR.CODE,    ITM.CODE,  ITM.LOGICALREF,  ITM.NAME,      ORL.USREF,
                                    ORL.UOMREF,unt.CONVFACT1,unt.CONVFACT2 ,  PY.CODE,    ORL.PRICE,    ORL.TRCURR,    ORF.TRCURR,    ORL.TRRATE,    ORF.GROSSTOTAL,    ORF.TOTALVAT,    ORF.NETTOTAL

                            UNION ALL

                            SELECT
                                CONVERT(nvarchar, ORF.DATE_, 104) AS tarih, MONTH(ORF.DATE_) AS 'AY' ,     ORF.DOCODE AS [siparis_kodu],      (SELECT TOP 1 ([POBIRIMFIYATINDIRIMI]-[POINDIRIMILISONFIYAT])
 FROM [AHO_SATINALMA_SIPARIS] 
 WHERE [PONUMARASI]=ORF.DOCODE AND [POKALEMKOD]=ITM.CODE) as indirimTL,
        (SELECT TOP 1 ([POBIRIMFIYATINDIRIMI]-[POINDIRIMILISONFIYAT])/(SELECT kur.kur FROM PBI_KUR as  kur WHERE CONVERT(nvarchar, kur.TARİH, 104)=CONVERT(nvarchar, POTARIH, 104))
 FROM [AHO_SATINALMA_SIPARIS] 
 WHERE [PONUMARASI]=ORF.DOCODE AND [POKALEMKOD]=ITM.CODE) as indirim, PR.CODE AS [proje_kod],     ITM.CODE AS KOD,  
                                ITM.DEFINITION_ AS MALZEME,     SUM(ORL.AMOUNT) AS [SİPARİŞ ADETİ],     SUM(ORL.SHIPPEDAMOUNT) AS [karsilanan_siparis],  
                                SUM(ORL.AMOUNT - ORL.SHIPPEDAMOUNT) AS [acik_siparis],  
                                ((ORL.PRICE))/(SELECT kur.kur FROM PBI_KUR as  kur WHERE CONVERT(nvarchar, kur.TARİH, 104)=CONVERT(nvarchar, ORF.DATE_, 104)) AS birim_fiyat, 
                                 ((ORL.PRICE)) AS birim_fiyat1, 
                                ORL.TRRATE AS 'KUR',
                                    ORL.USREF,
                                    ORL.UOMREF,
                                    ITM.LOGICALREF
                            FROM
                                LG_225_01_ORFLINE AS ORL
                                INNER JOIN LG_225_01_ORFICHE AS ORF ON ORL.ORDFICHEREF = ORF.LOGICALREF
                                INNER JOIN LG_225_SRVCARD AS ITM ON ORL.STOCKREF = ITM.LOGICALREF
                                INNER JOIN LG_225_PROJECT AS PR ON ORL.PROJECTREF = PR.LOGICALREF
                                FULL OUTER JOIN LG_225_PAYPLANS AS PY ON ORL.PAYDEFREF = PY.LOGICALREF
                            WHERE
                                (ORL.LINETYPE = 4)     AND (ORL.TRCODE = 2)     AND ORF.CANCELLED = 0     AND ORL.CLOSED = 0   
                                AND ORF.STATUS = 4         AND ORL.PRICE>0  AND MONTH(ORF.DATE_)=${ay}
                                GROUP BY
                                ORF.DOCODE,    CONVERT(nvarchar, ORF.DATE_, 104), MONTH(ORF.DATE_) ,      ORL.USREF,
                                    ORL.UOMREF,ITM.LOGICALREF,  PR.CODE,    ITM.CODE,    ITM.DEFINITION_,     PY.CODE,    ORL.PRICE,    ORL.TRCURR,    ORF.TRCURR,    ORL.TRRATE,    ORF.GROSSTOTAL,    ORF.TOTALVAT,    ORF.NETTOTAL
                            ORDER BY tarih
            `;

        let depoAdetResult;
        try {
            depoAdetResult = await tigerCariOku.query(tigerSqlDepo);
            
            const siparisler = depoAdetResult.recordset;
            
            // Genel istatistikler
            const uniqueSiparisKodlari = [...new Set(siparisler.map(item => item.siparis_kodu))];
            const uniqueCariler = [...new Set(siparisler.map(item => item.USREF))];
            const uniqueMalzemeKodlari = [...new Set(siparisler.map(item => item.KOD))];
            const uniqueProjeKodlari = [...new Set(siparisler.map(item => item.proje_kod))];
            
            // Proje bazlı istatistikler için nesne oluştur
            const projeBazliIstatistikler = {};
            
            // Toplamlar için değişkenler
            let toplamTutar = 0;
            let toplamTutarTl = 0;
            let toplamIndirimTl = 0;
            let toplamIndirim = 0;
            let yurtIciToplamTutar = 0;
            let yurtIciToplamTutarTL = 0;
            let yurtDisiToplamTutar = 0;
            let yurtDisiToplamTutarTL = 0;
            
            // Proje bazlı istatistikleri hesapla
            uniqueProjeKodlari.forEach(projeKod => {
                projeBazliIstatistikler[projeKod] = {
                    projeKod: projeKod,
                    toplamTutar: 0,
                    yurtIciTutar: 0,
                    yurtDisiTutar: 0,
                    toplamTutarTL: 0,
                    yurtIciTutarTL: 0,
                    yurtDisiTutarTL: 0,
                    siparisSayisi: 0,
                    yurtIciSiparisSayisi: 0,
                    yurtDisiSiparisSayisi: 0,
                    uniqueSiparisKodlari: []
                };
            });
            
            // Siparişleri işle
            siparisler.forEach(item => {
                const siparisTutari = item.siparis_adet * item.birim_fiyat;
                const siparisTutariTL = item.siparis_adet * item.birim_fiyat1;
                const siparisIndirimiTL = item.siparis_adet * item.indirimTL;
                const siparisIndirimi = item.siparis_adet * item.indirim;
                const projeKod = item.proje_kod;
                const siparisKod = item.siparis_kodu;
                
                // Genel toplamlar
                toplamTutar += siparisTutari;
                toplamTutarTl += siparisTutariTL;
                toplamIndirimTl+=siparisIndirimiTL
                toplamIndirim+=siparisIndirimi
                if (siparisKod.endsWith('I')) {
                    yurtIciToplamTutar += siparisTutari;
                    yurtIciToplamTutarTL += siparisTutariTL;
                } else if (siparisKod.endsWith('D')) {
                    yurtDisiToplamTutar += siparisTutari;
                    yurtDisiToplamTutarTL += siparisTutariTL;
                }
                
                // Proje bazlı toplamlar
                if (projeBazliIstatistikler[projeKod]) {
                    projeBazliIstatistikler[projeKod].toplamTutar += siparisTutari;
                    projeBazliIstatistikler[projeKod].toplamTutarTL += siparisTutariTL;
                    
                    if (siparisKod.endsWith('I')) {
                        projeBazliIstatistikler[projeKod].yurtIciTutar += siparisTutari;
                        projeBazliIstatistikler[projeKod].yurtIciTutarTL += siparisTutariTL;
                    } else if (siparisKod.endsWith('D')) {
                        projeBazliIstatistikler[projeKod].yurtDisiTutar += siparisTutari;
                        projeBazliIstatistikler[projeKod].yurtDisiTutarTL += siparisTutariTL;
                    }
                    
                    // Sipariş kodlarını projeye ekle (tekrarsız)
                    if (!projeBazliIstatistikler[projeKod].uniqueSiparisKodlari.includes(siparisKod)) {
                        projeBazliIstatistikler[projeKod].uniqueSiparisKodlari.push(siparisKod);
                        
                        // Sipariş sayılarını güncelle
                        projeBazliIstatistikler[projeKod].siparisSayisi++;
                        
                        if (siparisKod.endsWith('I')) {
                            projeBazliIstatistikler[projeKod].yurtIciSiparisSayisi++;
                        } else if (siparisKod.endsWith('D')) {
                            projeBazliIstatistikler[projeKod].yurtDisiSiparisSayisi++;
                        }
                    }
                }
            });
            
            // Proje bazlı istatistikleri diziye çevir
            const projeIstatistikleri = Object.values(projeBazliIstatistikler);
            
            const istatistikler = {
                genel: {
                    toplamSiparisSayisi: uniqueSiparisKodlari.length,
                    farkliCariSayisi: uniqueCariler.length,
                    yurtIciSiparisSayisi: uniqueSiparisKodlari.filter(kod => kod.endsWith('I')).length,
                    yurtDisiSiparisSayisi: uniqueSiparisKodlari.filter(kod => kod.endsWith('D')).length,
                    toplamSiparisTutari: toplamTutar,
                    toplamSiparisTutariTL: toplamTutarTl,
                    toplamSiparisIndirimTL: toplamIndirimTl,
                    toplamSiparisIndirim: toplamIndirim,
                    yurtIciSiparisTutari: yurtIciToplamTutar,
                    yurtIciSiparisTutariTL: yurtIciToplamTutarTL,
                    yurtDisiSiparisTutari: yurtDisiToplamTutar,
                    yurtDisiSiparisTutariTL: yurtDisiToplamTutarTL,
                    farkliMalzemeSayisi: uniqueMalzemeKodlari.length,
                    farkliProjeSayisi: uniqueProjeKodlari.length
                },
                projeBazli: projeIstatistikleri,
                siparisDetaylari: siparisler
            };

            res.status(200).json({ status: 200, data: istatistikler });
        } catch (error) {
            console.error("Error executing SQL query for depoAdetResult:", error);
            return res.status(400).json({ error: "Error fetching depo data" });
        }

    } catch (error) {
        console.error("Error in depoCekMaliyet function:", error);
        res.status(400).json({ error: error.message });
    }
};