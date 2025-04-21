
const pool = require('../db');
const path = require('path');
const transliteration = require('transliteration');
const multer = require('multer');
const readline = require('readline');

const nodemailer = require("nodemailer");
const fs = require("fs");
const storage = multer.diskStorage({
    destination: (req, file, callBack) => {
        const destinationPath = path.join(__dirname, '..', '..', '..', '..', '..', '..', 'wamp64', 'www', 'assets', 'images', 'haber');
        callBack(null, destinationPath)
    },
    filename: (req, file, callBack) => {
        const bugun = new Date();
        const tarihDamgasi = bugun.toISOString().replace(/[:.]/g, '').substring(0, 10); // Sadece '2023-08-25' bölümü
        const originalnameWithoutExtension = path.parse(file.originalname).name;
        const transliteratedName = transliteration.slugify(originalnameWithoutExtension, { lowercase: false });
        callBack(null, `haberler_${tarihDamgasi}${transliteratedName}${path.extname(file.originalname)}`);
    }
})

const upload = multer({ storage: storage })
const insertKaliteDokumanQuery = `INSERT INTO m_kalite_dokuman (url, type, bagli_id, file_name, aciklama) VALUES ($1,1,$2,$3,$4) RETURNING *`
const updateKaliteDokumanQuery = `UPDATE m_kalite_dokuman SET url=$1, type=$2, bagli_id=$3, file_name=$4, aciklama=$5,is_delete=$6,is_active=$7 WHERE id=$8`
const insertKaliteQuery = `INSERT INTO m_kalite (urun_kod, lot, siparis_no, machine_id, machine_name, uretim_operator_id,
                        uretim_operator_name, olcen_operator_id, olcen_operator_name, is_emri, olcum_cihaz, olcum_cihaz_name,
                         olcum_miktar, status, type,uretim_islem_id, uretim_islem_name) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING * `
const putKaliteQuery = `UPDATE public.m_kalite
	                                        SET urun_kod=$1, lot=$2, siparis_no=$3, machine_id=$4, machine_name=$5, 
                                                uretim_operator_id=$6, uretim_operator_name=$7, olcen_operator_id=$8,
                                                olcen_operator_name=$9, is_emri=$10, olcum_cihaz=$11, olcum_cihaz_name=$12, olcum_miktar=$13, status=$14, type=$15,
                                             uretim_islem_id=$16, uretim_islem_name=$17 , onay=$19
	                        WHERE  id=$18`
exports.postUretimKalite = async (req, res) => {
    const { urun_kod, lot, siparis_no, machine_id, machine_name, uretim_operator_id,
        uretim_operator_name, olcen_operator_id, olcen_operator_name, is_emri, olcum_cihaz, olcum_cihaz_name,
        olcum_miktar, status, type, uretim_islem_id, uretim_islem_name } = req.body
    try {
        const result = await pool.query(insertKaliteQuery, [urun_kod, lot, siparis_no, machine_id, machine_name, uretim_operator_id,
            uretim_operator_name, olcen_operator_id, olcen_operator_name, is_emri, olcum_cihaz, olcum_cihaz_name,
            olcum_miktar, status, type, uretim_islem_id, uretim_islem_name]);
        res.status(200).json({ status: 200, data: result.rows });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};
exports.putUretimKalite = async (req, res) => {
    const { urun_kod, lot, siparis_no, machine_id, machine_name, uretim_operator_id,
        uretim_operator_name, olcen_operator_id, olcen_operator_name, is_emri, olcum_cihaz, olcum_cihaz_name,
        olcum_miktar, status, type, uretim_islem_id, uretim_islem_name, id, onay } = req.body
    try {
        const result = await pool.query(putKaliteQuery, [urun_kod, lot, siparis_no, machine_id, machine_name, uretim_operator_id,
            uretim_operator_name, olcen_operator_id, olcen_operator_name, is_emri, olcum_cihaz, olcum_cihaz_name,
            olcum_miktar, status, type, uretim_islem_id, uretim_islem_name, id, onay]);
        res.status(200).json({ status: 200, data: result.rows });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};
exports.getUretimKalite = async (req, res) => {
    const { query, limit, ofset } = req.body

    try {
        let dynamicQuery, toplamVeri
        if (query != "") {
            dynamicQuery = `
            SELECT mk.*, 
                (SELECT json_agg(dokuman) 
                 FROM (SELECT * FROM m_kalite_dokuman mkd WHERE mk.id = mkd.bagli_id AND mkd.is_delete = false AND mkd.is_active=true) dokuman
                ) AS dokumanlar 
            FROM m_kalite mk 
            ${query} LIMIT $1 OFFSET $2;
        `;
            toplamVeri = `
            SELECT mk.*, 
                (SELECT json_agg(dokuman) 
                 FROM (SELECT * FROM m_kalite_dokuman mkd WHERE mk.id = mkd.bagli_id AND mkd.is_delete = false AND mkd.is_active=true) dokuman
                ) AS dokumanlar 
            FROM m_kalite mk ${query} `;
        } else {
            dynamicQuery = `
            SELECT mk.*, 
                (SELECT json_agg(dokuman) 
                 FROM (SELECT * FROM m_kalite_dokuman mkd WHERE mk.id = mkd.bagli_id AND mkd.is_delete = false AND mkd.is_active=true) dokuman
                ) AS dokumanlar 
            FROM m_kalite mk 
           LIMIT $1 OFFSET $2;
        `;
            toplamVeri = `
            SELECT mk.*, 
                (SELECT json_agg(dokuman) 
                 FROM (SELECT * FROM m_kalite_dokuman mkd WHERE mk.id = mkd.bagli_id AND mkd.is_delete = false AND mkd.is_active=true) dokuman
                ) AS dokumanlar 
            FROM m_kalite mk `;
        }


        // Log the final query for debugging

        // Execute the query with parameters for limit and offset
        const result = await pool.query(dynamicQuery, [limit, ofset]);
        const ToplamResult = await pool.query(toplamVeri);
        res.status(200).json({ status: 200, data: result.rows, toplamVeri: ToplamResult.rowCount });
    } catch (error) {
        console.log(error)
        res.status(400).json({ message: error });
    }
};
exports.putKaliteDokuman = async(req, res) => {
    const{url, type, bagli_id, file_name, aciklama,is_delete,is_active,id}=req.body
    try {
        const result = await pool.query(updateKaliteDokumanQuery,[url, type, bagli_id, file_name, aciklama,is_delete,is_active,id])
        res.status(200).json({status:200,data:result.rows})
    } catch (error) {
        console.log(error)
        res.status(400).json({ message: error });
    }

}
exports.createKaliteDokuman = [upload.array('files'), async (req, res) => {
    const { bagli_id, type, aciklama } = req.body;
    const files = req.files;
    try {



        if (!files) {
            const error = new Error('No File')
            error.httpStatusCode = 400

            return next(error)
        }
        files.forEach(async element => {
            let belge_url = `assets\\docs\\${element.filename}`

            const insertQuery = await pool.query(insertKaliteDokumanQuery,
                [belge_url, bagli_id, element.filename, aciklama])
        });
        res.status(200).json({ status: 200 });

    } catch (error) {
        res.status(400).json({ status: 400, data: error });
    }
}
];