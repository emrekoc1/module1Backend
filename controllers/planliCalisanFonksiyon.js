
const pool = require('../db');
const portal_pool = require('../portal_db');
const { create } = require('xmlbuilder2');
const sql = require('mssql'); // Ensure sql from mssql is imported
const path = require('path');
const transliteration = require('transliteration');
const multer = require('multer');
const express = require('express');
const router = express.Router();

const cors = require('cors');
router.use(cors());
const { sqls, poolPromises } = require('../portal_Tiger_db'); // MSSQL yapılandırması
const ikiSaat = 3 * 60 * 60 * 1000;

// satınalma siparişleri
async function maliyetCek() {

    try {
        const resultPortal = await pool.query(`SELECT * FROM portal_tiger_aktif_cari`)
        const cari_yil = resultPortal.rows[0].yil

        const mssqlPool = await poolPromises; // MSSQL bağlantısı
        const tigerCariOku = mssqlPool.request();


        const depoAdetResult = await tigerCariOku.query(`
            SELECT ITM.CODE AS KODU, ITM.NAME AS MALZEME, DP.NAME AS DEPO, ROUND(SUM(ST.ONHAND), 1) AS miktar, UNI.NAME AS BİRİM
FROM  dbo.LV_${cari_yil}_01_STINVTOT AS ST WITH (NOLOCK) INNER JOIN
                         dbo.LG_${cari_yil}_ITEMS AS ITM WITH (NOLOCK) ON ST.STOCKREF = ITM.LOGICALREF INNER JOIN
                         dbo.L_CAPIWHOUSE AS DP WITH (NOLOCK) ON ST.INVENNO = DP.NR INNER JOIN
                         dbo.LG_${cari_yil}_UNITSETF AS UNI WITH (NOLOCK) ON ITM.UNITSETREF = UNI.LOGICALREF
WHERE        (ITM.ACTIVE = 0) AND (DP.FIRMNR = ${cari_yil})
GROUP BY ITM.CODE, ITM.NAME, DP.NAME, ST.INVENNO, UNI.NAME`);
        let depo = depoAdetResult.recordsets[0]
        const deleteSas = await pool.query(`DELETE FROM maliyet_satin_alma_siparis`)
        const deleteDepo = await pool.query(`DELETE FROM maliyet_urun_depo`)
        for (let element of depo) {

            const depoKontrol = await pool.query(`SELECT * FROM maliyet_urun_depo WHERE urun_kodu = $1`, [element.KODU])
            if (depoKontrol.rowCount > 0) {
                let topla = depoKontrol.rows[0].depo_miktar + element.miktar
                const updateDepo = await pool.query(`UPDATE maliyet_urun_depo SET depo_miktar = $1 WHERE urun_kodu = $2`, [topla, element.KODU])
            } else {
                const depoInsert = await pool.query(`
                INSERT INTO maliyet_urun_depo(
	            urun_kodu, urun_aciklama, depo_miktar)
	            VALUES ($1, $2, $3)`, [element.KODU, element.MALZEME, element.miktar])
            }

        }

        const depoSiparisCekQuery = await pool.query(`SELECT * FROM maliyet_urun_depo`)
        for (let element of depoSiparisCekQuery.rows) {
              await sasCekMaliyet(cari_yil, element.urun_kodu)
            }
         } catch (error) {
              console.error(error);
         }

}
async function bomMaliyetTopla(code) {
        const urunBomGetir = await pool.query(`SELECT SUM(depo.birim_fiyat) FROM maliyet_bom bom 
	INNER JOIN maliyet_urun_depo depo
	ON depo.urun_kodu= bom.kod AND bom.ana_urun = ${code}`)

      
}
async function urunBomMaliyet(urun_kodu) {
   
        
         const updateDepo = await pool.query(`UPDATE maliyet_urun_depo SET birim_fiyat=(SELECT SUM(birim_fiyat *miktar )FROM maliyet_bom bom 
	INNER JOIN maliyet_urun_depo depo
	ON depo.urun_kodu= bom.kod AND bom.ust_kod = '${urun_kodu}') WHERE urun_kodu='${urun_kodu}'`)
  
}
async function bomCek(code) {
    const mssqlPool = await poolPromises; // MSSQL bağlantısı
    const tigerCariOku = mssqlPool.request();
    const resultPortal = await pool.query(`SELECT * FROM portal_tiger_aktif_cari`);
    const cari_yil = resultPortal.rows[0].yil;

    // Daha önce işlenen ürün kodlarını saklamak için bir set
    const visitedCodes = new Set();

    const fetchBomData = async (kod) => {
        if (visitedCodes.has(kod)) return []; // Eğer kod daha önce işlendiyse tekrar sorgulama
        visitedCodes.add(kod); // İşlenmiş kodları sakla

        const msqlBomListQuery = await tigerCariOku.query(`
            SELECT item.CODE as ana_urun, item.NAME as ana_urun_aciklama, line.AMOUNT,
                   (SELECT NAME FROM LG_224_ITEMS WHERE LOGICALREF = line.ITEMREF) AS NAME,
                   (SELECT CODE FROM LG_224_ITEMS WHERE LOGICALREF = line.ITEMREF) AS CODE
            FROM LG_224_BOMASTER bom 
            INNER JOIN LG_224_ITEMS item ON item.CODE = '${kod}' AND bom.MAINPRODREF = item.LOGICALREF 
            INNER JOIN LG_224_BOMLINE line ON line.BOMMASTERREF = bom.LOGICALREF 
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

    // Önceki BOM verilerini temizle
    await pool.query(`DELETE FROM maliyet_bom WHERE ana_urun = '${code}'`);

    // Yeni BOM verilerini ekle
    for (const element of bomlist) {
        const veriVarMi = await pool.query(
            `SELECT * FROM maliyet_bom WHERE ust_kod = '${element.ana_urun}' AND kod = '${element.CODE}'`
        );
        if (veriVarMi.rowCount === 0) {
            const insertNewBom = await pool.query(`
                INSERT INTO maliyet_bom (ust_kod, ust_malzeme, kod, malzeme, miktar, seviye, ana_urun)
                VALUES ('${element.ana_urun}', '${element.ana_urun_aciklama}', '${element.CODE}', '${element.NAME}', ${element.AMOUNT}, ${element.level}, '${code}')
            `);
            if (insertNewBom.rowCount > 0) {
                const depoKontrol = await pool.query(`SELECT * FROM maliyet_urun_depo WHERE urun_kodu = $1`, [element.CODE]);
                if (depoKontrol.rowCount === 0) {
                    await pool.query(`
                        INSERT INTO maliyet_urun_depo (urun_kodu, urun_aciklama, depo_miktar)
                        VALUES ($1, $2, $3)
                    `, [element.CODE, element.NAME, 0]);
                    await sasCekMaliyet(cari_yil, element.CODE);
                }
            }
        }
    }
}

async function sasCekMaliyet(cari_yil, urun_kodu) {
    const mssqlPool = await poolPromises; // MSSQL bağlantısı

    const tigerCariOku = mssqlPool.request();
    const siparisCek = await tigerCariOku.query(
        `
         SELECT
        CONVERT(nvarchar, ORF.DATE_, 104) AS tarih,    ORF.DOCODE AS [siparis_kodu],    PR.CODE AS [proje_kod],    ITM.CODE AS KOD,    ITM.NAME AS MALZEME,    SUM(ORL.AMOUNT) AS siparis_adet,    SUM(ORL.SHIPPEDAMOUNT) AS [karsilanan_siparis],
          SUM(ORL.AMOUNT - ORL.SHIPPEDAMOUNT) AS [acik_siparis],    CLC.CODE AS cari_kodu,    CLC.DEFINITION_ AS cari,    PY.CODE AS odeme_sekli,    ORL.PRICE AS birim_fiyat,    CASE
            WHEN ORL.TRCURR = 20 THEN 'EURO'
            WHEN ORF.TRCURR = 0 OR ORF.TRCURR = 160 THEN 'TL'
            WHEN ORF.TRCURR = 1 THEN 'USD'
            WHEN ORF.TRCURR = 17 THEN 'GBP'
            WHEN ORF.TRCURR = 11 THEN 'CHF'
            WHEN ORF.TRCURR = 13 THEN 'JPY'
        END AS siparis_dovizi,
        ORL.TRRATE AS 'KUR',
        ORF.GROSSTOTAL AS MATRAH,
        ORF.TOTALVAT AS KDV,
        ORF.NETTOTAL AS TOPLAM
        FROM
        dbo.LG_${cari_yil}_01_ORFLINE AS ORL
        INNER JOIN dbo.LG_${cari_yil}_01_ORFICHE AS ORF ON ORL.ORDFICHEREF = ORF.LOGICALREF
        INNER JOIN dbo.LG_${cari_yil}_ITEMS AS ITM ON ORL.STOCKREF = ITM.LOGICALREF
        INNER JOIN dbo.LG_${cari_yil}_CLCARD AS CLC ON ORL.CLIENTREF = CLC.LOGICALREF
        INNER JOIN dbo.LG_${cari_yil}_PROJECT AS PR ON ORL.PROJECTREF = PR.LOGICALREF
        FULL OUTER JOIN dbo.LG_${cari_yil}_PAYPLANS AS PY ON ORL.PAYDEFREF = PY.LOGICALREF
    WHERE
        (ORL.LINETYPE = 0)     AND (ORL.TRCODE = 2)     AND ORF.CANCELLED = 0     AND ORL.CLOSED = 0     AND ORF.STATUS = 4     AND ITM.CODE LIKE '${urun_kodu}'	AND ORL.PRICE>0
    GROUP BY
        ORF.DOCODE,
        CONVERT(nvarchar, ORF.DATE_, 104),
        PR.CODE,    ITM.CODE,    ITM.NAME,    CLC.CODE,    CLC.DEFINITION_,    PY.CODE,    ORL.PRICE,    ORL.TRCURR,    ORF.TRCURR,    ORL.TRRATE,    ORF.GROSSTOTAL,    ORF.TOTALVAT,    ORF.NETTOTAL

    UNION ALL

    SELECT
        CONVERT(nvarchar, ORF.DATE_, 104) AS tarih,     ORF.DOCODE AS [siparis_kodu],     PR.CODE AS [proje_kod],     ITM.CODE AS KOD,     ITM.DEFINITION_ AS MALZEME,     SUM(ORL.AMOUNT) AS [SİPARİŞ ADETİ],     SUM(ORL.SHIPPEDAMOUNT) AS [karsilanan_siparis],     SUM(ORL.AMOUNT - ORL.SHIPPEDAMOUNT) AS [acik_siparis],     CLC.CODE AS cari_kodu,     CLC.DEFINITION_ AS cari,     PY.CODE AS odeme_sekli,     ORL.PRICE AS birim_fiyat,     CASE
            WHEN ORL.TRCURR = 20 THEN 'EURO'
            WHEN ORF.TRCURR = 0 OR ORF.TRCURR = 160 THEN 'TL'
            WHEN ORF.TRCURR = 1 THEN 'USD'
            WHEN ORF.TRCURR = 17 THEN 'GBP'
            WHEN ORF.TRCURR = 11 THEN 'CHF'
            WHEN ORF.TRCURR = 13 THEN 'JPY'
        END AS [siparis_dovizi],
        ORL.TRRATE AS 'KUR',
        ORF.GROSSTOTAL AS MATRAH,
        ORF.TOTALVAT AS KDV,
        ORF.NETTOTAL AS TOPLAM
    FROM
        dbo.LG_${cari_yil}_01_ORFLINE AS ORL
        INNER JOIN dbo.LG_${cari_yil}_01_ORFICHE AS ORF ON ORL.ORDFICHEREF = ORF.LOGICALREF
        INNER JOIN dbo.LG_${cari_yil}_SRVCARD AS ITM ON ORL.STOCKREF = ITM.LOGICALREF
        INNER JOIN dbo.LG_${cari_yil}_CLCARD AS CLC ON ORL.CLIENTREF = CLC.LOGICALREF
        INNER JOIN dbo.LG_${cari_yil}_PROJECT AS PR ON ORL.PROJECTREF = PR.LOGICALREF
        FULL OUTER JOIN dbo.LG_${cari_yil}_PAYPLANS AS PY ON ORL.PAYDEFREF = PY.LOGICALREF
    WHERE
        (ORL.LINETYPE = 4)     AND (ORL.TRCODE = 2)     AND ORF.CANCELLED = 0     AND ORL.CLOSED = 0     AND ORF.STATUS = 4     AND ITM.CODE LIKE '${urun_kodu}'	AND ORL.PRICE>0
        GROUP BY
        ORF.DOCODE,    CONVERT(nvarchar, ORF.DATE_, 104),    PR.CODE,    ITM.CODE,    ITM.DEFINITION_,    CLC.CODE,    CLC.DEFINITION_,    PY.CODE,    ORL.PRICE,    ORL.TRCURR,    ORF.TRCURR,    ORL.TRRATE,    ORF.GROSSTOTAL,    ORF.TOTALVAT,    ORF.NETTOTAL
    ORDER BY tarih
    `
    )

    if (siparisCek.rowsAffected > 0) {
        let satinAlmaSiparis = siparisCek.recordsets[0]
        for (let data of satinAlmaSiparis) {
            let siparisSayisi = await pool.query(`SELECT COUNT(urun_kod) as say FROM  maliyet_satin_alma_siparis WHERE urun_kod =$1`, [urun_kodu])
            if (siparisSayisi.rows[0].say <= 5) {
                const insertSas = await pool.query(`INSERT INTO maliyet_satin_alma_siparis(
	urun_kod, urun_aciklama, sas_tarih, sas_kod, sas_miktar, birim_fiyat) VALUES($1,$2,$3,$4,$5,$6)`, [urun_kodu, data.MALZEME, data.tarih, data.siparis_kodu, data.siparis_adet, data.birim_fiyat])
                const ortalamaBirimFiyatHesapla = await pool.query(`UPDATE maliyet_urun_depo
SET birim_fiyat = (
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

    let kacinci = cariKodlar.findIndex(s =>
        s == cari_yil
    )
    if (kacinci > -1) {

        if (siparisSayisi.rows[0].say <= 5 && cariKodlar[kacinci + 1] >= 219) {
            sasCekMaliyet(cariKodlar[kacinci + 1], urun_kodu)
        }
    }


}
async function birimFiyatHesapla(urun_kodu) {
   
   
        const ortalamaBirimFiyatHesapla = await pool.query(`UPDATE maliyet_urun_depo
            SET birim_fiyat = (
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
async function gunlukCariCek() {
    let toplamDepo = 0
    try {
        const resultPortal = await pool.query(`SELECT * FROM portal_tiger_aktif_cari`)
        const cari_yil = resultPortal.rows[0].yil

        const mssqlPool = await poolPromises; // MSSQL bağlantısı
        const tigerCariOku = mssqlPool.request();


        const flowDataGuncelemeResult = await tigerCariOku.query(`SELECT * FROM LG_${cari_yil}_CLCARD WHERE CODE like '320.%'`);
        let cari = flowDataGuncelemeResult.recordsets[0]
        for (const element of cari) {

            const cariKontrol = await pool.query(`SELECT * FROM s_cari WHERE tiger_kod like '${element.CODE}'`)
            if (cariKontrol.rowCount == 0) {
                await pool.query(
                    `INSERT INTO s_cari (name, tiger_kod) VALUES ($1, $2)`,
                    [element['DEFINITION_'], element['CODE']]
                );
            }
        }
        return flowDataGuncelemeResult;

    } catch (error) {
        console.error(error);

    }

}
async function sevkDataCek() {
    try {
        const resultPortal = await pool.query(`SELECT * FROM portal_tiger_aktif_cari`)
        const cari_yil = resultPortal.rows[0].yil

        const mssqlPool = await poolPromises; // MSSQL bağlantısı
        const tigerCariOku = mssqlPool.request();

        const siparisGetir = await pool.query(`SELECT * FROM m_uretim_siparis`)
        const siparisler = siparisGetir.rows

        for (const element of siparisler) {

            const flowDataGuncelemeResult = await tigerCariOku.query(`SELECT C.CODE AS 'cari_kod', C.DEFINITION_ AS 'cari', ST.FICHENO AS [fis_no], F.DOCODE AS [siparis_no], M.CODE AS KODU, M.NAME AS cihaz,
                S.AMOUNT AS [siparis_adet], S.AMOUNT - S.SHIPPEDAMOUNT AS [acik_siparis], S.SHIPPEDAMOUNT AS sevk_miktar, S.PRICE AS [birim_fiyat], SUM(I.AMOUNT) AS [irsaliye_miktar], ST.DOCODE AS [irsaliye_no],
                             ST.SPECODE AS irsaliye_ozel_kod, CONVERT(NVARCHAR, ST.DATE_, 104) AS irsaliye_tarih, CASE WHEN ST.INVOICEREF = 0 THEN 'FATURA YOK' WHEN ST.INVOICEREF != 0 THEN
                                 (SELECT        CONVERT(nvarchar, DATE_, 104)
                                   FROM            LG_${cari_yil}_01_INVOICE
                                   WHERE        LOGICALREF = ST.INVOICEREF) END AS fatura_tarih, DATEPART(WK, ST.DATE_) AS irsaliye_hafta,
                             CASE WHEN TP.IADE_TIPI = 1 THEN 'SATIŞ' WHEN TP.IADE_TIPI = 2 THEN 'ONARIM' WHEN TP.IADE_TIPI = 3 THEN 'İADE' ELSE 'YOK' END AS irsaliye_tip,
                             CASE WHEN ST.IOCODE = 1 THEN 'GELEN' WHEN ST.IOCODE = 3 THEN 'GİDEN' END AS giris_cikis_tur,
                             CASE WHEN ST.TRCODE = 3 THEN 'TOPTAN İADE İRSALİYESİ' WHEN ST.TRCODE = 8 THEN 'TOPTAN SATIŞ İRSALİYESİ' WHEN ST.TRCODE = 36 THEN 'ONARIM İRSALİYESİ İRSALİYESİ' END AS irsaliye_tur,
                             CASE WHEN ST.INVOICEREF = 0 THEN 'FATURA YOK' WHEN ST.INVOICEREF != 0 THEN
                                 (SELECT        FICHENO
                                   FROM            LG_${cari_yil}_01_INVOICE
                                   WHERE        LOGICALREF = ST.INVOICEREF) END AS fatura_durum, CASE WHEN MONTH(I.DATE_) = 1 THEN 'OCAK' WHEN MONTH(I.DATE_) = 2 THEN 'ŞUBAT' WHEN MONTH(I.DATE_)
                             = 3 THEN 'MART' WHEN MONTH(I.DATE_) = 4 THEN 'NİSAN' WHEN MONTH(I.DATE_) = 5 THEN 'MAYIS' WHEN MONTH(I.DATE_) = 6 THEN 'HAZİRAN' WHEN MONTH(I.DATE_) = 7 THEN 'TEMMUZ' WHEN MONTH(I.DATE_)
                             = 8 THEN 'AĞUSTOS' WHEN MONTH(I.DATE_) = 9 THEN 'EYLÜL' WHEN MONTH(I.DATE_) = 10 THEN 'EKİM' WHEN MONTH(I.DATE_) = 11 THEN 'KASIM' WHEN MONTH(I.DATE_) = 12 THEN 'ARALIK' END AS AY,
                             ST.DOCODE AS irsaliye_belge_no, ST.GENEXP1 + ' ' + ST.GENEXP2 AS irsaliye_aciklama
    FROM            dbo.LG_${cari_yil}_01_ORFLINE AS S INNER JOIN
                             dbo.LG_${cari_yil}_CLCARD AS C ON S.CLIENTREF = C.LOGICALREF INNER JOIN
                             dbo.LG_${cari_yil}_01_ORFICHE AS F ON S.ORDFICHEREF = F.LOGICALREF INNER JOIN
                             dbo.LG_${cari_yil}_ITEMS AS M ON S.STOCKREF = M.LOGICALREF INNER JOIN
                             dbo.LG_${cari_yil}_01_STLINE AS I ON S.LOGICALREF = I.ORDTRANSREF INNER JOIN
                             dbo.LG_${cari_yil}_01_STFICHE AS ST ON I.STFICHEREF = ST.LOGICALREF FULL OUTER JOIN
                             LG_XT1008001_${cari_yil} TP ON ST.LOGICALREF = TP.PARLOGREF
    WHERE      (S.LINETYPE = 0) AND ST.CANCELLED = 0 AND M.CODE = '${element.urun_kod}' AND  F.DOCODE ='${element.siparis_kod}'
    GROUP BY M.CODE, I.DATE_, M.NAME, C.CODE, C.DEFINITION_, F.DOCODE, S.AMOUNT, S.SHIPPEDAMOUNT, S.PRICE, ST.DOCODE, ST.IOCODE, S.LOGICALREF, ST.SPECODE, ST.DATE_, TP.IADE_TIPI, ST.INVOICEREF, ST.GENEXP1,
                             ST.GENEXP2, ST.TRCODE, ST.FICHENO
    UNION ALL
    SELECT        CL.CODE AS 'cari_kod', CL.DEFINITION_ AS 'cari', ST.FICHENO AS [fis_no], 'SİPARİŞE BAĞLI DEĞİL' AS [siparis_no], ITM.CODE AS KODU, ITM.NAME AS cihaz, 0 AS [siparis_adet], 0 AS [acik_siparis],
                             0 AS sevk_miktar, 0 AS [birim_fiyat], SL.AMOUNT AS [irsaliye_miktar], ST.DOCODE AS [irsaliye_no], ST.SPECODE AS irsaliye_ozel_kod, CONVERT(NVARCHAR, ST.DATE_, 104) AS irsaliye_tarih,
                             CASE WHEN ST.INVOICEREF = 0 THEN 'FATURA YOK' WHEN ST.INVOICEREF != 0 THEN
                                 (SELECT        CONVERT(nvarchar, DATE_, 104)
                                   FROM            LG_${cari_yil}_01_INVOICE
                                   WHERE        LOGICALREF = ST.INVOICEREF) END AS 'FATURA TARİHİ', DATEPART(WK, ST.DATE_) AS irsaliye_hafta,
                             CASE WHEN TP.IADE_TIPI = 1 THEN 'SATIŞ' WHEN TP.IADE_TIPI = 2 THEN 'ONARIM' WHEN TP.IADE_TIPI = 3 THEN 'İADE' ELSE 'YOK' END AS irsaliye_tip,
                             CASE WHEN ST.IOCODE = 1 THEN 'GELEN' WHEN ST.IOCODE = 3 THEN 'GİDEN' END AS giris_cikis_tur,
                             CASE WHEN ST.TRCODE = 3 THEN 'TOPTAN İADE İRSALİYESİ' WHEN ST.TRCODE = 8 THEN 'TOPTAN SATIŞ İRSALİYESİ' WHEN ST.TRCODE = 36 THEN 'ONARIM İRSALİYESİ İRSALİYESİ' END AS irsaliye_tur,
                             CASE WHEN ST.INVOICEREF = 0 THEN 'FATURA YOK' WHEN ST.INVOICEREF != 0 THEN
                                 (SELECT        FICHENO
                                   FROM            LG_${cari_yil}_01_INVOICE
                                   WHERE        LOGICALREF = ST.INVOICEREF) END AS fatura_durum, CASE WHEN MONTH(SL.DATE_) = 1 THEN 'OCAK' WHEN MONTH(SL.DATE_) = 2 THEN 'ŞUBAT' WHEN MONTH(SL.DATE_)
                             = 3 THEN 'MART' WHEN MONTH(SL.DATE_) = 4 THEN 'NİSAN' WHEN MONTH(SL.DATE_) = 5 THEN 'MAYIS' WHEN MONTH(SL.DATE_) = 6 THEN 'HAZİRAN' WHEN MONTH(SL.DATE_)
                             = 7 THEN 'TEMMUZ' WHEN MONTH(SL.DATE_) = 8 THEN 'AĞUSTOS' WHEN MONTH(SL.DATE_) = 9 THEN 'EYLÜL' WHEN MONTH(SL.DATE_) = 10 THEN 'EKİM' WHEN MONTH(SL.DATE_)
                             = 11 THEN 'KASIM' WHEN MONTH(SL.DATE_) = 12 THEN 'ARALIK' END AS AY, ST.DOCODE AS irsaliye_belge_no, ST.GENEXP1 + ' ' + ST.GENEXP2 AS irsaliye_aciklama
    FROM            LG_${cari_yil}_01_STLINE SL INNER JOIN
                             LG_${cari_yil}_ITEMS ITM ON SL.STOCKREF = ITM.LOGICALREF INNER JOIN
                             LG_${cari_yil}_CLCARD CL ON SL.CLIENTREF = CL.LOGICALREF INNER JOIN
                             LG_${cari_yil}_01_STFICHE ST ON SL.STFICHEREF = ST.LOGICALREF FULL OUTER JOIN
                             LG_XT1008001_${cari_yil} TP ON ST.LOGICALREF = TP.PARLOGREF
    WHERE        SL.LINETYPE = 0 AND ST.GRPCODE = 2  AND SL.ORDFICHEREF = 0 AND SL.SOURCELINK = 0 AND ST.CANCELLED = 0  AND ITM.CODE = '${element.urun_kod}'`);
            let cari = flowDataGuncelemeResult.recordsets[0]
            if (cari && cari.length > 0) {
                for (const item of cari) {
                    if (element && element.urun_kod && item && item.fis_no) {
                        const sevkIrsaliyeKontrol = await pool.query(`SELECT * FROM m_uretim_sevk_iptal WHERE urun_kod = '${element.urun_kod}' AND siparis_id=${element.id} AND irsaliye_no='${item.fis_no}'`);

                        if (sevkIrsaliyeKontrol.rowCount === 0) {
                            const siparisKontrol = await pool.query(`SELECT * FROM m_uretim_siparis WHERE id = ${element.id}`);
                            if (siparisKontrol.rowCount > 0) {
                                const sipariResult = siparisKontrol.rows[0];
                                let siparis_fark = sipariResult.siparis_miktar - sipariResult.sevk_miktar;

                                if (siparis_fark > 0) {
                                    await pool.query(`INSERT INTO m_uretim_sevk_iptal (siparis_id, urun_kod, sevk_tarih, miktar, is_deleted, irsaliye_no) VALUES($1,$2,$3,$4,$5,$6)`,
                                        [element.id, element.urun_kod, item.irsaliye_tarih, item.irsaliye_miktar, false, item.fis_no]);

                                    await pool.query(`UPDATE m_uretim_siparis SET sevk_miktar = $1, acik_siparis=$2 WHERE id = $3`,
                                        [sipariResult.sevk_miktar + item.irsaliye_miktar,
                                        Math.max(0, sipariResult.acik_siparis - item.irsaliye_miktar),
                                        element.id]);
                                } else {
                                    const digerSipariseUlas = await pool.query(`SELECT * FROM m_uretim_siparis WHERE urun_kod = $1 AND siparis_kod = $2 AND siparis_miktar-sevk_miktar > 0 ORDER BY sevk_tarih`,
                                        [element.urun_kod, element.siparis_kod]);
                                    if (digerSipariseUlas.rowCount > 0) {
                                        const sipariResult = digerSipariseUlas.rows[0];
                                        await pool.query(`INSERT INTO m_uretim_sevk_iptal (siparis_id, urun_kod, sevk_tarih, miktar, is_deleted, irsaliye_no) VALUES($1,$2,$3,$4,$5,$6)`,
                                            [sipariResult.id, element.urun_kod, item.irsaliye_tarih, item.irsaliye_miktar, false, item.fis_no]);

                                        await pool.query(`UPDATE m_uretim_siparis SET sevk_miktar = $1, acik_siparis=$2 WHERE id = $3`,
                                            [sipariResult.sevk_miktar + item.irsaliye_miktar,
                                            Math.max(0, sipariResult.acik_siparis - item.irsaliye_miktar),
                                            sipariResult.id]);
                                    }
                                }
                            }
                        }
                    }
                }
            }


        }
        return tigerCariOku;
    } catch (error) {
        console.error(error);

    }

    // return Object.values(toplamDepo);

}
async function ototmatikSatinAlmaSiparisCek() {
    let toplamDepo = 0
    try {
        const resultPortal = await pool.query(`SELECT * FROM portal_tiger_aktif_cari`)
        const cari_yil = resultPortal.rows[0].yil

        const mssqlPool = await poolPromises; // MSSQL bağlantısı
        const tigerCariOku = mssqlPool.request();


        const flowDataGuncelemeResult = await tigerCariOku.query(`SELECT CONVERT(nvarchar, ORF.DATE_, 104) AS 'TARİH', ORF.DOCODE AS [SİPARİŞ KODU], PR.CODE AS [PROJE KODU], ITM.CODE AS KOD, ITM.NAME AS MALZEME, ORL.AMOUNT AS [SİPARİŞ ADETİ],
                         ORL.SHIPPEDAMOUNT AS [KARŞILANAN SİPARİŞ], ORL.AMOUNT - ORL.SHIPPEDAMOUNT AS [AÇIK SİPARİŞ], CLC.CODE AS 'CARİ KODU', CLC.DEFINITION_ AS CARİ, PY.CODE AS [ÖDEME ŞEKLİ], ORL.PRICE AS 'BİRİM FİYAT',
                         CASE WHEN ORL.TRCURR = 20 THEN 'EURO' WHEN ORF.TRCURR = 0 OR
                         ORF.TRCURR = 160 THEN 'TL' WHEN ORF.TRCURR = 1 THEN 'USD' WHEN ORF.TRCURR = 17 THEN 'GBP' WHEN ORF.TRCURR = 11 THEN 'CHF' WHEN ORF.TRCURR = 13 THEN 'JPY' END AS [SİPARİŞ DÖVİZİ],
                         ORL.TRRATE AS 'KUR', ORF.GROSSTOTAL AS MATRAH, ORF.TOTALVAT AS KDV, ORF.NETTOTAL AS TOPLAM, CONVERT(nvarchar, ORL.DUEDATE, 104) AS 'TERMİN TARİHİ', KR.KUR AS 'MB KUR'
FROM            dbo.LG_${cari_yil}_01_ORFLINE AS ORL INNER JOIN
                         dbo.LG_${cari_yil}_01_ORFICHE AS ORF ON ORL.ORDFICHEREF = ORF.LOGICALREF INNER JOIN
                         dbo.LG_${cari_yil}_ITEMS AS ITM ON ORL.STOCKREF = ITM.LOGICALREF INNER JOIN
                         dbo.LG_${cari_yil}_CLCARD AS CLC ON ORL.CLIENTREF = CLC.LOGICALREF INNER JOIN
                         dbo.LG_${cari_yil}_PROJECT AS PR ON ORL.PROJECTREF = PR.LOGICALREF FULL OUTER JOIN
                         dbo.LG_${cari_yil}_PAYPLANS AS PY ON ORL.PAYDEFREF = PY.LOGICALREF INNER JOIN
                         PBI_KUR KR ON ORL.DATE_ = KR.TARİH
WHERE        (ORL.LINETYPE = 0) AND (ORL.TRCODE = 2) AND ORF.CANCELLED = 0 AND ORL.CLOSED = 0 AND ORF.STATUS = 4
UNION ALL
SELECT        CONVERT(nvarchar, ORF.DATE_, 104) AS 'TARİH', ORF.DOCODE AS [SİPARİŞ KODU], PR.CODE AS [PROJE KODU], ITM.CODE AS KOD, ITM.DEFINITION_ AS MALZEME, ORL.AMOUNT AS [SİPARİŞ ADETİ],
                         ORL.SHIPPEDAMOUNT AS [KARŞILANAN SİPARİŞ], ORL.AMOUNT - ORL.SHIPPEDAMOUNT AS [AÇIK SİPARİŞ], CLC.CODE AS 'CARİ KODU', CLC.DEFINITION_ AS CARİ, PY.CODE AS [ÖDEME ŞEKLİ], ORL.PRICE AS 'BİRİM FİYAT',
                         CASE WHEN ORL.TRCURR = 20 THEN 'EURO' WHEN ORF.TRCURR = 0 OR
                         ORF.TRCURR = 160 THEN 'TL' WHEN ORF.TRCURR = 1 THEN 'USD' WHEN ORF.TRCURR = 17 THEN 'GBP' WHEN ORF.TRCURR = 11 THEN 'CHF' WHEN ORF.TRCURR = 13 THEN 'JPY' END AS [SİPARİŞ DÖVİZİ],
                         ORL.TRRATE AS 'KUR', ORF.GROSSTOTAL AS MATRAH, ORF.TOTALVAT AS KDV, ORF.NETTOTAL AS TOPLAM, CONVERT(nvarchar, ORL.DUEDATE, 104) AS 'TERMİN TARİHİ', KR.KUR AS 'MB KUR'
FROM            dbo.LG_${cari_yil}_01_ORFLINE AS ORL INNER JOIN
                         dbo.LG_${cari_yil}_01_ORFICHE AS ORF ON ORL.ORDFICHEREF = ORF.LOGICALREF INNER JOIN
                         dbo.LG_${cari_yil}_SRVCARD AS ITM ON ORL.STOCKREF = ITM.LOGICALREF INNER JOIN
                         dbo.LG_${cari_yil}_CLCARD AS CLC ON ORL.CLIENTREF = CLC.LOGICALREF INNER JOIN
                         dbo.LG_${cari_yil}_PROJECT AS PR ON ORL.PROJECTREF = PR.LOGICALREF FULL OUTER JOIN
                         dbo.LG_${cari_yil}_PAYPLANS AS PY ON ORL.PAYDEFREF = PY.LOGICALREF INNER JOIN
                         PBI_KUR KR ON ORL.DATE_ = KR.TARİH
WHERE        (ORL.LINETYPE = 4) AND (ORL.TRCODE = 2) AND ORF.CANCELLED = 0 AND ORL.CLOSED = 0 AND ORF.STATUS = 4`);
        let cari = flowDataGuncelemeResult.recordsets[0]
        const deleteSatinalma = await pool.query(`delete from public.p_gunluk_satin_alma`)
        for (const element of cari) {
            const insertAmbar = await pool.query(`INSERT INTO p_gunluk_satin_alma(
                cari, aciksas, siparis_no, teslim_tarihi,urun_kod,urun_aciklamasi,cari_kod)
                VALUES ('${element['CARİ']}', '${element['AÇIK SİPARİŞ']}', '${element['SİPARİŞ KODU']}', '${element['TERMİN TARİHİ']}', '${element['KOD']}', '${element['MALZEME']}','${element['CARİ KODU']}')`)

        }
        return cari[0];
    } catch (error) {
        console.error(error);

    }

    // return Object.values(toplamDepo);

}
const otomatikDepoCek = async () => {
    try {
        const resultPortal = await pool.query(`SELECT * FROM portal_tiger_aktif_cari`);
        const cari_yil = resultPortal.rows[0]?.yil;

        if (!cari_yil) {
            throw new Error("Missing 'yil' in portal_tiger_aktif_cari.");
        }

        const mssqlPool = await poolPromises; // MSSQL connection
        const tigerCariOku = mssqlPool.request();

        const flowDataGuncelemeResult = await tigerCariOku.query(`
            SELECT
                ITM.CODE AS malzeme_kod,
                ITM.NAME AS MALZEME,
                DP.NAME AS DEPO,
                CASE
                    WHEN ST.SLTYPE = 1 THEN 'LOT'
                    WHEN ST.SLTYPE = 2 THEN 'SERİ'
                END AS seri_tur,
                SR.CODE AS seri_no,
                SR.NAME AS seri_no_aciklama,
                CONVERT(NVARCHAR, SR.CAPIBLOCK_CREADEDDATE, 104) AS seri_lot_tarih,
                ST.REMAMOUNT AS miktar
            FROM dbo.LG_${cari_yil}_01_SLTRANS AS ST WITH (NOLOCK)
            INNER JOIN dbo.LG_${cari_yil}_ITEMS AS ITM ON ITM.LOGICALREF = ST.ITEMREF
            INNER JOIN dbo.LG_${cari_yil}_01_SERILOTN AS SR ON SR.LOGICALREF = ST.SLREF
            INNER JOIN dbo.L_CAPIWHOUSE AS DP ON DP.NR = ST.INVENNO AND DP.FIRMNR = ${cari_yil}
            WHERE ST.REMAMOUNT > 0 AND ST.IOCODE NOT IN (4) AND ST.SLTYPE IN (1, 2)
        `);

        let cari = flowDataGuncelemeResult.recordsets[0];

        if (!cari || cari.length === 0) {
            console.warn("No data returned from MSSQL query.");
            return;
        }

        await pool.query(`DELETE FROM gk_depo`);

        for (const element of cari) {
            if (!element || element["miktar"] === undefined) {
                console.error("Skipping invalid element:", element);
                continue;
            }

            const miktar = parseFloat(element["miktar"]);
            const depoVarmi = await pool.query(
                `SELECT * FROM gk_depo WHERE urun_kodu = $1 AND lot = $2`,
                [element["malzeme_kod"], element["seri_no"]]
            );

            if (depoVarmi.rowCount > 0) {
                const depoToplam = depoVarmi.rows[0].miktar + miktar;
                await pool.query(
                    `UPDATE gk_depo SET miktar = $1 WHERE id = $2`,
                    [depoToplam, depoVarmi.rows[0].id]
                );
            } else {
                await pool.query(
                    `INSERT INTO gk_depo(urun_kodu, urun_aciklama, lot, miktar, gelis_tarih, firma_lot, depo)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [
                        element["malzeme_kod"],
                        element["MALZEME"],
                        element["seri_no"],
                        miktar,
                        element["seri_lot_tarih"],
                        element["seri_no_aciklama"],
                        element["DEPO"]
                    ]
                );
            }
        }
    } catch (error) {
        console.error("General Error:", error);
    }
};

const satisSiparis = async () => {
    // Burada sorgunuzu çalıştırabilirsiniz, örneğin:
    try {
        const resultPortal = await pool.query(`SELECT * FROM portal_tiger_aktif_cari`)
        const cari_yil = resultPortal.rows[0].yil

        const mssqlPool = await poolPromises; // MSSQL bağlantısı
        const tigerCariOku = mssqlPool.request();


        const flowDataGuncelemeResult = await tigerCariOku.query(`SELECT        ORL.LOGICALREF, MONTH(ORF.DATE_) AS 'AY', YEAR(ORF.DATE_) AS 'YIL', CL.DEFINITION_ AS CARİ, CONVERT(NVARCHAR, ORF.DATE_, 104) AS [SİPARİŞ TARİHİ], CONVERT(NVARCHAR, ORL.DUEDATE, 104)
                         AS [TESLİM TARİHİ], ORF.DOCODE AS [SİPARİŞ NUMARASI], 'MALZEME' AS [MALZEME/HİZMET], ITM.CODE AS [MALZEME KODU], ITM.NAME AS [MALZEME AÇIKLAMASI], ORL.AMOUNT AS [SİPARİŞ ADETİ],
                         ORL.AMOUNT - ORL.SHIPPEDAMOUNT AS [AÇIK SİPARİŞ], ORL.SHIPPEDAMOUNT AS [SEVKEDİLEN ADET], ORL.PRICE AS [FİYAT TL],
                         CASE WHEN ORF.TRRATE > 0 THEN ORL.PRICE / ORF.TRRATE ELSE ORL.PRICE END AS 'DÖVİZ FİYAT', CASE WHEN ORL.TRCURR = 0 THEN 'TL' WHEN ORL.TRCURR = 1 THEN 'USD' ELSE CONVERT(nvarchar, ORL.TRCURR)
                         END 'KUR TÜRÜ', MONTH(ORF.DATE_) AS [SİPARİŞ AYI], PRJ.CODE AS PROJE
FROM            dbo.LG_${cari_yil}_01_ORFLINE AS ORL INNER JOIN
                         dbo.LG_${cari_yil}_01_ORFICHE AS ORF ON ORL.ORDFICHEREF = ORF.LOGICALREF INNER JOIN
                         dbo.LG_${cari_yil}_ITEMS AS ITM ON ORL.STOCKREF = ITM.LOGICALREF INNER JOIN
                         dbo.LG_${cari_yil}_CLCARD AS CL ON ORL.CLIENTREF = CL.LOGICALREF INNER JOIN
                         LG_${cari_yil}_PROJECT PRJ ON ORL.PROJECTREF = PRJ.LOGICALREF
WHERE        (ORL.LINETYPE = 0) AND (ORF.TRCODE = 1) AND ORF.CANCELLED = 0 AND ORL.CLOSED = 0 AND ORF.STATUS = 4
UNION ALL
SELECT        ORL.LOGICALREF, MONTH(ORF.DATE_) AS 'AY', YEAR(ORF.DATE_) AS 'YIL', CL.DEFINITION_ AS CARİ, CONVERT(NVARCHAR, ORF.DATE_, 104) AS [SİPARİŞ TARİHİ], CONVERT(NVARCHAR, ORL.DUEDATE, 104)
                         AS [TESLİM TARİHİ], ORF.DOCODE AS [SİPARİŞ NUMARASI], 'HİZMET' AS [MALZEME/HİZMET], ITM.CODE AS [MALZEME KODU], ITM.DEFINITION_ AS [MALZEME AÇIKLAMASI], ORL.AMOUNT AS [SİPARİŞ ADETİ],
                         ORL.AMOUNT - ORL.SHIPPEDAMOUNT AS [AÇIK SİPARİŞ], ORL.SHIPPEDAMOUNT AS [SEVKEDİLEN ADET], ORL.PRICE AS [FİYAT TL],
                         CASE WHEN ORF.TRRATE > 0 THEN ORL.PRICE / ORF.TRRATE ELSE ORL.PRICE END AS 'DÖVİZ FİYAT', CASE WHEN ORL.TRCURR = 0 THEN 'TL' WHEN ORL.TRCURR = 1 THEN 'USD' ELSE CONVERT(nvarchar, ORL.TRCURR)
                         END 'KUR TÜRÜ', MONTH(ORF.DATE_) AS [SİPARİŞ AYI], PRJ.CODE AS PROJE
FROM            dbo.LG_${cari_yil}_01_ORFLINE AS ORL INNER JOIN
                         dbo.LG_${cari_yil}_01_ORFICHE AS ORF ON ORL.ORDFICHEREF = ORF.LOGICALREF INNER JOIN
                         dbo.LG_${cari_yil}_SRVCARD AS ITM ON ORL.STOCKREF = ITM.LOGICALREF INNER JOIN
                         dbo.LG_${cari_yil}_CLCARD AS CL ON ORL.CLIENTREF = CL.LOGICALREF INNER JOIN
                         LG_${cari_yil}_PROJECT PRJ ON ORL.PROJECTREF = PRJ.LOGICALREF
WHERE        (ORL.LINETYPE = 4) AND (ORF.TRCODE = 1) AND ORF.CANCELLED = 0 AND ORL.CLOSED = 0 AND ORF.STATUS = 4`);
        let cari = flowDataGuncelemeResult.recordsets[0]
        transformedSiparisler = groupAndSumSiparisler(cari);
    } catch (error) {
        console.error(error);

    }
};
async function satisSiparisDuzenleme() {
    try {
        let dataSiparis = await pool.query(`SELECT * FROM p_siparisler`);
        let siparisler = dataSiparis.rows;
        let deleteLocalSiparisDuzen = await pool.query('DELETE FROM p_local_duzenli_siparis');

        for (const element of siparisler) {
            await updateLocalDuzenliSiparis(element);
        }
        return 0
    } catch (error) {
        console.error(error);
    }
}
async function updateLocalDuzenliSiparis(element) {
    try {
        let monthField = getMonthField(element.teslim_tarihi);

        let siparisVarmi = await pool.query(`SELECT * FROM p_local_duzenli_siparis WHERE malzeme=$1`, [element.malzeme]);

        if (siparisVarmi.rowCount > 0) {
            let totalAmount = element.acik_siparis + siparisVarmi.rows[0][monthField];
            let updateFieldQuery = `UPDATE p_local_duzenli_siparis SET ${monthField} = $1 WHERE id = $2`;

            await pool.query(updateFieldQuery, [totalAmount, siparisVarmi.rows[0].id]);
        } else {
            let totalAmount = element.acik_siparis;
            let insertFieldQuery = `INSERT INTO p_local_duzenli_siparis (proje, malzeme, malzeme_adi, ${monthField}) VALUES ($1, $2, $3, $4)`;

            await pool.query(insertFieldQuery, [element.proje, element.malzeme, element.malzeme_adi, totalAmount]);
        }
    } catch (error) {
        console.error(error);
    }
}

async function ototmatikAmbarCek(element) {
    let toplamDepo = 0

    try {
        const resultPortal = await pool.query(`SELECT * FROM portal_tiger_aktif_cari`)
        const cari_yil = resultPortal.rows[0].yil

        const mssqlPool = await poolPromises; // MSSQL bağlantısı
        const tigerCariOku = mssqlPool.request();


        const flowDataGuncelemeResult = await tigerCariOku.query(`SELECT        ITM.CODE AS KODU, ITM.NAME AS MALZEME, DP.NAME AS DEPO, ROUND(SUM(ST.ONHAND), 1) AS MİKTAR, UNI.NAME AS BİRİM
FROM            dbo.LV_225_01_STINVTOT AS ST WITH (NOLOCK) INNER JOIN
                         dbo.LG_225_ITEMS AS ITM WITH (NOLOCK) ON ST.STOCKREF = ITM.LOGICALREF INNER JOIN
                         dbo.L_CAPIWHOUSE AS DP WITH (NOLOCK) ON ST.INVENNO = DP.NR INNER JOIN
                         dbo.LG_225_UNITSETF AS UNI WITH (NOLOCK) ON ITM.UNITSETREF = UNI.LOGICALREF
WHERE        (ITM.ACTIVE = 0) AND (DP.FIRMNR = 225)
GROUP BY ITM.CODE, ITM.NAME, DP.NAME, ST.INVENNO, UNI.NAME`);
        let ambar = flowDataGuncelemeResult.recordsets[0]


        const deleteSatinalma = await pool.query(`delete from public.p_gunluk_depo_toplam`)
        for (const element of ambar) {
            const insertAmbar = await pool.query(`INSERT INTO public.p_gunluk_depo_toplam(
                urun_kod, miktar, ambar)
                VALUES ('${element.KODU}', ${element['MİKTAR']}, '${element.DEPO}');`)
        }

        return toplamDepo;





    } catch (error) {
        console.error(error);

    }

    // return Object.values(toplamDepo);

}
function getToken2() {
    return new Promise((resolve, reject) => {
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
                reject(error);
                return;
            }
            const access_token = JSON.parse(body); // access_token değerini al
            resolve(access_token);
        });
    });
}
async function ambarDurumUpdate(element) {
    const code = element.kod
    let toplamDepo = 0
    try {

        const access_token = await getToken2();
        const initialUrl = `http://20.0.0.14:32001/api/v1/queries?tsql=${encodeURIComponent("SELECT * FROM AMBAR_TOPLAMLARI_225 WHERE( KODU = '" + code + "') AND MİKTAR > 0 AND DEPO != 'Şube Tekrar Lens Deposu' AND DEPO != 'AHO Hurda-Fire' AND DEPO != 'Sevkiyat' AND DEPO != 'Bakım Onarım Deposu' AND DEPO != 'Ek Uygunsuzluk Deposu' AND DEPO != 'İthalat Deposu' AND DEPO != 'Aselsan Hurda-Fire Yansıtma' AND DEPO != 'Rework Deposu' AND DEPO != 'İade Deposu' AND DEPO != 'Sabit Kıymet Deposu' AND DEPO != 'Ankara AR-GE Üretim Deposu' AND DEPO != 'Bilgi İşlem Deposu' ")}`;
        const initialOptions = {
            method: 'GET',
            url: initialUrl,
            headers: {
                Authorization: `Bearer ${access_token.access_token}`,
                'Content-Type': 'application/json',
                Accept: 'application/json'
            }
        };

        const initialResponse = await axios(initialOptions);
        let ambar = initialResponse.data.items || [];
        for (const element of ambar) {
            toplamDepo += element['MİKTAR'];

        }
        return toplamDepo;
    } catch (error) {
        console.error(error);

    }

    // return Object.values(toplamDepo);

}
async function ambarDurumOtomatik() {
    try {

        const dataSiparis = await pool.query(`SELECT * FROM p_local_duzenli_siparis`)
        const siparisList = dataSiparis.rows

        for (const element of siparisList) {
            let minAmbar = 9999

            let dataBom = await pool.query(`SELECT * FROM p_target_bom WHERE siparis_urun = '${element.malzeme}'`);
            let bomListe = dataBom.rows;
            for (const bomElement of bomListe) {
                let toplamDepo = await ambarDurumUpdate(bomElement);
                let ihmalData = await pool.query(`SELECT * FROM p_ihmal_product WHERE malzeme_kodu = '${bomElement.kod}'`)
                let varmi = ihmalData.rowCount
                if (varmi > 0) {
                    minAmbar = minAmbar
                } else {
                    minAmbar = minAmbar > toplamDepo ? toplamDepo : minAmbar;
                }

                const updateTargetBomAmbar = await pool.query(`UPDATE p_target_bom SET sum_ambar = ${toplamDepo} WHERE id = ${bomElement.id}`);
            }

            //p_local_duzenli_siparis tablosundaki ürünleri sırayla gezerek p_target_bom tablosunda olanları bulacak sum_ambar miktarı minumum  olanı bulacak ihmal edilen üründe varsa yeni onu minumum kabul etmeyecek liste bittiğinde üretilebilirlik yazacak


            const insertSiparisUretim = await pool.query(`UPDATE p_local_duzenli_siparis SET uretilebilir= ${minAmbar} WHERE id = ${element.id}`)

        }

    } catch (error) {
        console.error(error);
    }
}

function getMonthField(teslim_tarihi) {
    switch (teslim_tarihi) {
        case 'Ocak':
            return 'ay_1';
        case 'Şubat':
            return 'ay_2';
        case 'Mart':
            return 'ay_3';
        case 'Nisan':
            return 'ay_4';
        case 'Mayıs':
            return 'ay_5';
        case 'Haziran':
            return 'ay_6';
        case 'Temmuz':
            return 'ay_7';
        case 'Ağustos':
            return 'ay_8';
        case 'Eylül':
            return 'ay_9';
        case 'Ekim':
            return 'ay_10';
        case 'Kasım':
            return 'ay_11';
        case 'Aralık':
            return 'ay_12';
        case 'ESKİBORC':
            return 'gecmis';
        default:
            // Handle unexpected cases
            throw new Error(`Invalid teslim_tarihi: ${teslim_tarihi}`);
    }
}
const groupAndSumSiparisler = async (siparisler) => {
    const groupedSiparisler = {};
    try {
        const eskiSiparisleriSil = await pool.query(`DELETE FROM p_siparisler `);
    } catch (error) {
        console.error(error)
    }
    siparisler.forEach(async (siparis) => {
        const {
            'CARİ': cari,
            'SİPARİŞ NUMARASI': siparis_no,
            'MALZEME KODU': malzeme_kodu,
            'MALZEME AÇIKLAMASI': malzeme_aciklamasi,
            'SİPARİŞ ADETİ': siparis_adet,
            'AÇIK SİPARİŞ': acik_siparis,
            'SEVKEDİLEN ADET': sevk_adet,
            'TESLİM TARİHİ': teslim_tarih,
            'PROJE': proje
        } = siparis;

        const tarihParcalari = teslim_tarih.split('.');
        const ay = parseInt(tarihParcalari[1], 10);
        const yil = parseInt(tarihParcalari[2], 10);
        let teslim_tarihi
        if ((ay < 12 && yil <= 2023) || (ay <= 12 && yil <= 2022) || (yil < 2024)) {
            teslim_tarihi = "ESKİBORC"
        } else {
            const aylar = [
                'Ocak',
                'Şubat',
                'Mart',
                'Nisan',
                'Mayıs',
                'Haziran',
                'Temmuz',
                'Ağustos',
                'Eylül',
                'Ekim',
                'Kasım',
                'Aralık'
            ];
            teslim_tarihi = aylar[ay - 1]
        }
        try {

            const result = await pool.query(`INSERT INTO p_siparisler (proje, siparis_no, teslim_tarihi, takim, malzeme, malzeme_adi, musteri, miktar, sevk_edilen, acik_siparis) VALUES('${proje}','${siparis_no}','${teslim_tarihi}',''
      ,'${malzeme_kodu}','${malzeme_aciklamasi}','${cari}','${siparis_adet}','${sevk_adet}','${acik_siparis}')`);
            const data = result.rows;

        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }

    });

    return Object.values("data");
};
router.post('/getCariSQLCek', cors(), async (req, res) => {

    try {
        // let veri
        // const depoSiparisCekQuery = await pool.query(`SELECT * 
        //                                                  FROM maliyet_urun_depo mdepo 
        //                                                  `)
        // for (let element of depoSiparisCekQuery.rows) {
        //   await birimFiyatHesapla(element.urun_kodu)
        // }
        // const depoSiparisCekQuery = await pool.query(`SELECT * 
        //                                                  FROM maliyet_urun_depo mdepo WHERE birim_fiyat=0
        //                                                  `)
        // for (let element of depoSiparisCekQuery.rows) {
        //   await urunBomMaliyet(element.urun_kodu)
        // }
        // //  veri = await maliyetCek()
        // const siparisYok = await pool.query(
        //                                     `SELECT * 
        //                                      FROM maliyet_urun_depo mdepo
        //                                     LEFT JOIN maliyet_bom mbom ON mbom.ana_urun = mdepo.urun_kodu
        //                                      WHERE mbom.ana_urun IS NULL 
        //                                         AND mdepo.birim_fiyat IS NULL  
        //                                         AND (mdepo.urun_kodu NOT LIKE '100.%' 
        //                                         AND mdepo.urun_kodu NOT LIKE '800.%' 
        //                                         AND mdepo.urun_kodu NOT LIKE '53%')`
        //                                     )
        // for (let s of siparisYok.rows) {
        //     const bomVar = await pool.query(`SELECT * FROM maliyet_bom WHERE ana_urun ='${s.urun_kodu}'`)
        //     if (bomVar.rowCount == 0) {
        //         console.log(s.urun_kodu)
        //         veri= await bomCek(s.urun_kodu)
        //     }
        // }
        // await gunlukCariCek();
        // console.log("Cari Kontrols Edildi")
        // await ototmatikSatinAlmaSiparisCek();
        // console.log("Satın Alma Sipariş Çekildi")
        // await gunlukCariCek();
        // console.log("Cari Kontrol Edildi")
        // await ototmatikSatinAlmaSiparisCek();
        // console.log("Satın Alma Sipariş Çekildi")
        // await otomatikDepoCek()
        // console.log("Depolar Çekildi")
        // await satisSiparis();
        // await satisSiparisDuzenleme();
        // await ototmatikAmbarCek();
        // await ambarDurumOtomatik();
        await sevkDataCek()
        // console.log("Depolar Çekildi")
        // await satisSiparis();
        // await satisSiparisDuzenleme();
        // await ototmatikAmbarCek();
        // await ambarDurumOtomatik();

        res.status(200).json({ status: 200, data: "başarılı" });
    } catch (error) {

        res.status(500).json({ error: error });
    }
})

setInterval(async () => {
    try {
        await gunlukCariCek();
        console.log("Cari Kontrol Edildi")
        await ototmatikSatinAlmaSiparisCek();
        console.log("Satın Alma Sipariş Çekildi")
        await otomatikDepoCek()
        console.log("Depolar Çekildi")
        await satisSiparis();
        await satisSiparisDuzenleme();
        await ototmatikAmbarCek();
        await ambarDurumOtomatik();
        await sevkDataCek()
        //await calistirSorguyu();

    } catch (error) {
        console.error(error);
    }
}, ikiSaat);
module.exports = router;