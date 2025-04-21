
const pool = require('../db');
const path = require('path');
const transliteration = require('transliteration');
const multer = require('multer');

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

exports.createHaber = [
    upload.array('files'), // multer middleware
    async (req, res) => {
        const { header, description, total_like, departman } = req.body;
        const files = req.files;

        if (!files || files.length === 0) {
            return res.status(400).json({ message: 'No File' });
        }

        const selectPDF = files.filter(file => file.originalname.endsWith('.pdf'));
        const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif'];

        const selectImg = files.filter(file => {
            const lowerCaseName = file.originalname.toLowerCase();
            return allowedExtensions.some(ext => lowerCaseName.endsWith(ext));
        });

        const photoUrl = selectImg.length > 0 ? `assets/images/haber/${selectImg[0].filename}` : null;
        const pdfUrl = selectPDF.length > 0 ? `assets/images/haber/${selectPDF[0].filename}` : null;

        const query = `
        INSERT INTO portal_haber (header, description, photo, total_like, pdf_url, departman)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;
      `;
        const values = [header, description, photoUrl, total_like || 0, pdfUrl, departman];

        try {
            const result = await pool.query(query, values);
            res.status(201).json({ status: 200, data: result.rows[0] });
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
];
// Haber güncelleme
exports.updateHaberDokuman = [
    upload.array('files'), // multer middleware
    async (req, res) => {
        const { id } = req.body;
        const files = req.files;

        if (!files || files.length === 0) {
            return res.status(400).json({ message: 'No files uploaded' });
        }

        const selectPDF = files.filter(file => file.originalname.endsWith('.pdf'));
        const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif'];

        const selectImg = files.filter(file => {
            const lowerCaseName = file.originalname.toLowerCase();
            return allowedExtensions.some(ext => lowerCaseName.endsWith(ext));
        });

        let photoUrl, pdfUrl;

        if (selectImg.length > 0) {
            photoUrl = `assets/images/haber/${selectImg[0].filename}`; // Dosya yolu
        }
        if (selectPDF.length > 0) {
            pdfUrl = `assets/images/haber/${selectPDF[0].filename}`; // Dosya yolu
        }

        let queryParts = [];
        let values = [];
        let index = 1;

        if (selectImg.length > 0) {
            queryParts.push(`photo = $${index++}`);
            values.push(photoUrl);
        }
        if (selectPDF.length > 0) {
            queryParts.push(`pdf_url = $${index++}`);
            values.push(pdfUrl);
        }

        if (queryParts.length === 0) {
            return res.status(400).json({ message: 'No valid files provided for update' });
        }

        // Güncelleme sorgusunu oluştur
        const query = `UPDATE portal_haber SET ${queryParts.join(', ')} WHERE id = $${index}`;
        values.push(id); // id'yi son parametre olarak ekle

        try {
            const result = await pool.query(query, values);
            if (result.rowCount === 0) {
                return res.status(404).json({ message: 'Haber not found' });
            }
            res.status(200).json({ status: 200, message: 'Update successful', id: id });
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
];
exports.updateHaber = async (req, res) => {
    const { header, description, photo, total_like, pdf_url, departman, id, is_deleted, is_active } = req.body;
    const query = `UPDATE portal_haber 
    SET header = $1, description = $2, total_like = $3, departman = $4, update_date = NOW(),is_deleted = $6,is_active=$7
    WHERE id = $5 RETURNING *;`;
    const values = [header, description, total_like, departman, id, is_deleted, is_active];
    try {
        const result = await pool.query(query, values);
        res.status(200).json({ status: 200, data: result.rows[0] });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};
// Tüm haberleri getirme
exports.getAllHaber = async (req, res) => {
    const { birim } = req.query; // Query parametrelerini alıyoruz
    let query = `SELECT * FROM portal_haber WHERE is_deleted = false`;

    if (birim) {
        query += ` AND departman = ${birim}`;
    }

    try {
        const result = await pool.query(query);
        res.json({ status: 200, data: result.rows });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.userReadHaber = async (req, res) => {
    try {
        const { haber_id, user_id, user_name } = req.body; // Query parametrelerini alıyoruz

        let varmiQuery = `SELECT * FROM portal_haber_user_read WHERE  haber_id = $1 AND user_id = $2`;
        const result = await pool.query(varmiQuery, [haber_id, user_id]);
        if (result.rowCount == 0) {
            let insertQuery = `INSERT INTO portal_haber_user_read(
	 haber_id, user_id, user_name)
	VALUES ($1,$2,$3)`
            const resultInsert = await pool.query(insertQuery, [haber_id, user_id, user_name])
            res.json({ status: 200, data: resultInsert.rows });
        } else {
            res.json({ status: 200, data: result.rows });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


