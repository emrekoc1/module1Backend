
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
const getItemsCategoriQuery = `SELECT pzcs.id,pzcs.name as sub , pzc.name FROM portal_zimmet_categories pzc INNER JOIN portal_zimmet_categories_sub pzcs ON pzc.id = pzcs.categori_id`

const getItemsByIDQuery = `SELECT * FROM portal_zimmet_items WHERE id=$1`
const getZimmetHiyerArsi = `SELECT 
    id, 
    user_name, 
    email, 
    password, 
    sicil, 
    phone, 
    user_type, 
    user_typename, 
    is_active, 
    is_delete, 
    password_status, 
    main_user,
	(SELECT json_agg(zimmetler) FROM (SELECT pzi.name as item_name,pzi.barcode, pzi.description, pzi.marka,pzi.model,pzi.specification ,pza.*
 FROM portal_zimmet_assigments pza 
INNER JOIN portal_zimmet_items pzi ON pzi.id = pza.item_id WHERE user_id =pu.sicil AND iade_status !=2 AND pza.onay !=2 WHERE pza.is_delete=false AND pza.is_active=true) zimmetler )as zimmetler,
    (SELECT json_agg(yetkiler) FROM (SELECT * FROM gk_yetkilendirme gky WHERE gky.user_id = pu.sicil )yetkiler)as yetkiler ,
    (SELECT json_agg(departman) 
     FROM
         (SELECT pud.departman_id,
                 (SELECT description FROM portal_departman WHERE pud.departman_id = id) AS departman_name
          FROM portal_user_departman pud 
          WHERE pu.sicil = pud.user_id) AS departman) AS departman 
FROM portal_user pu`
const getUserItemZimmetControlQuery = `SELECT * FROM portal_zimmet_assigments WHERE item_id=$1 AND user_id = $2 AND departman_id = $3 AND status = true AND iade_status !=2 AND is_delete=false AND is_active=true`
const postItemsQuery = `INSERT INTO portal_zimmet_items(
	 name, description,  marka, model, specification,miktar,is_active,categori_id,barcode,yer)
	VALUES ($1, $2, $3, $4, $5,$6,$7,$8,$9,$10) RETURNING *`
const postItemsQueryGecici = `INSERT INTO portal_zimmet_items(
	 name, description,  marka, model, specification,miktar,is_active,categori_id,yer,departman_id,barcode)
	VALUES ($1, $2, $3, $4, $5,$6,$7,$8,$9,$10,$11) RETURNING *`
const postZimmetQuery = `INSERT INTO portal_zimmet_assigments(
	item_id, user_id, status, miktar,departman_id,departman_name,user_name,e_posta, zimmet_veren, zimmet_name, zimmet_email,barkod)
	VALUES ($1, $2, $3, $4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`
const updateZimmetQuery = `Update portal_zimmet_assigments set
	 status = $3, miktar= $4 , update_date = $5 , assigned_date= $6,departman_id = $7,departman_name = $8 ,user_name =$9,onay = $10,onay_date = $11,comments = $12,iade_status = $13, iade_date =$14 , is_active = $15 WHERE item_id = $1 AND user_id = $2
	 RETURNING *`
const getReportGenelQuery = `SELECT 
    COUNT(DISTINCT item_id) as item_count,
    SUM(CASE WHEN iade_status = 1 THEN 1 ELSE 0 END) AS iade_count,
    COUNT(DISTINCT user_id) as user_count,
    (SELECT json_agg(iadeList) FROM (
        SELECT * 
        FROM portal_zimmet_assigments pza 
        INNER JOIN portal_zimmet_items pzi ON pzi.id = pza.item_id 
        WHERE iade_status != 0 AND pza.status=true
    ) iadeList
) iade_list,
    (SELECT json_agg(birim) FROM (
        SELECT 
            pd.*,
            (SELECT json_agg(birimDetail) FROM (
                SELECT 
                    pzi.name as item_name, 
                    pzi.description,
                    pzi.barcode, 
                    pzi.marka,
                    pzi.model,
                    pzi.specification,
                    pza.* 
                FROM portal_zimmet_assigments pza
                INNER JOIN portal_zimmet_items pzi ON pzi.id = pza.item_id 
                WHERE pza.is_delete=false 
                AND pza.is_active=true 
                AND pza.departman_id = pd.id 
                AND pza.status = true
            ) birimDetail
        ) as birimDetail,
        (SELECT SUM(miktar) FROM portal_zimmet_assigments WHERE departman_id = pd.id and status = true) 
        FROM portal_departman pd
    ) birim
) birim,
    (SELECT json_agg(kategori) FROM (
        SELECT 
            pzc.*,
            (SELECT json_agg(kategoriDetail) FROM (
                SELECT 
                    pzi.name as item_name,
                    pzi.barcode, 
                    pzi.description, 
                    pzi.marka,
                    pzi.model,
                    pzi.specification,
                    pza.*,
                    pzcs.name as categori_name,
                    (SELECT name FROM portal_zimmet_categories pzc WHERE pzcs.categori_id = pzc.id) as cat_name
                FROM portal_zimmet_categories_sub pzcs
                INNER JOIN portal_zimmet_items pzi ON pzcs.id = pzi.categori_id
                INNER JOIN portal_zimmet_assigments pza ON pzi.id = pza.item_id 
                    AND pza.status = true 
                    AND pza.is_delete=false 
                    AND pza.is_active=true
                WHERE pzcs.categori_id = pzc.id
            ) kategoriDetail
        ) as kategoriDetail,
        (SELECT COALESCE(SUM(item_count),0) 
        FROM (
            SELECT SUM(pza.miktar) AS item_count
            FROM portal_zimmet_items pzi
            INNER JOIN portal_zimmet_assigments pza ON pza.item_id = pzi.id 
                AND pza.status = true 
                AND pza.is_delete=false 
                AND pza.is_active=true
            INNER JOIN portal_zimmet_categories_sub pzcs ON pzcs.id = pzi.categori_id
            WHERE pzcs.categori_id = pzc.id
        ) AS subquery
       ) AS total_item_count
        FROM portal_zimmet_categories pzc
    ) kategori
) kategori
FROM portal_zimmet_assigments pza 
WHERE pza.status = true 
AND pza.is_delete=false 
AND pza.is_active=true
`
const putItemsQuery = `UPDATE portal_zimmet_items SET
	 name = $1, description = $2,  marka=$3, model=$4, specification=$5,miktar = $6,is_active = $7 , yer =$9,barcode = $10
	WHERE id = $8 RETURNING *`
const getZimmetUserByQuery = `SELECT pzi.name as item_name,pzi.barcode, pzi.description, pzi.marka,pzi.model,pzi.specification ,pza.*
 FROM portal_zimmet_assigments pza 
INNER JOIN portal_zimmet_items pzi ON pzi.id = pza.item_id WHERE user_id =$1 AND iade_status !=2 AND pza.onay !=2 AND  pza.is_delete=false AND pza.is_active=true`
const getZimmetOnayRaporQuery = `select * from portal_zimmet_assigments pza INNER JOIN portal_zimmet_items pzi ON pza.item_id = pzi.id WHERE pza.onay !=1 AND pza.status = true AND  pza.is_delete=false AND pza.is_active=true`
exports.postItemZimmet = async (req, res) => {
    const { name, description, marka, model, specification, miktar, is_active, categori_id, barcode, yer } = req.body
    try {

        const result = await pool.query(postItemsQuery, [name, description, marka, model, JSON.stringify(specification), miktar, is_active, categori_id, barcode, yer]);
        res.status(200).json({ status: 200, data: result.rows });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};
function buildHierarchy(users,sicil) {
    const userMap = {};

    // İlk olarak tüm kullanıcıları bir nesneye yerleştiriyoruz
    users.forEach(user => {
        user.children = [];  // Her kullanıcının altındaki kullanıcıları tutmak için bir dizi ekliyoruz
        userMap[user.sicil] = user;  // Sicil numarasına göre haritaya ekliyoruz
    });

    let root = [];  // Ana kullanıcıları tutacak kök dizisi

    users.forEach(user => {
        if (user.sicil === sicil) {
            // Eğer main_user alanı null ise, bu kullanıcı genel müdürdür ve kök dizisine eklenir
            root.push(user);
        } else {
            // Aksi halde, kullanıcının main_user'ına gidip onun çocuklarına eklenir
            const parent = userMap[user.main_user];
            if (parent) {
                parent.children.push(user);
            }
        }
    });

    return root;  // Hiyerarşik yapıyı döndürüyoruz
};
exports.getGenelHiyerArsiAll = async (req, res) => {
    try {
        console.log(req.body)
        const {sicil}=req.body
        const result = await pool.query(getZimmetHiyerArsi)
        const hierarchy = buildHierarchy(result.rows,sicil);
        res.status(200).json(
            {
            data:hierarchy,
            status:200}
        )
    } catch (error) {
        console.error('Depo çekme sırasında hata:', error);
        res.status(500).json({ message: 'Depo bilgilerini çekerken bir hata oluştu.' });
    }
}
exports.postZimmet = async (req, res) => {
    const { item_id, user_id, status, miktar, departman_id, departman_name, user_name, e_posta, zimmet_veren, zimmet_name, zimmet_email, urun_name,
        urun_aciklama, barkod } = req.body
    try {
        const result = await pool.query(postZimmetQuery, [item_id, user_id, status, miktar, departman_id, departman_name, user_name, e_posta, zimmet_veren, zimmet_name, zimmet_email, barkod]);
        let tableRows = `
        <tr style="border: 1px solid #ddd;">
          <th style="border: 1px solid #ddd; padding: 8px;">Ürün Adı</th>
          <th style="border: 1px solid #ddd; padding: 8px;">Ürün Açıklama</th>
          <th style="border: 1px solid #ddd; padding: 8px;">Miktar</th>
          <th style="border: 1px solid #ddd; padding: 8px;">Zimmet Yapan</th>
          <th style="border: 1px solid #ddd; padding: 8px;">Zimmet Alan</th>
          <th style="border: 1px solid #ddd; padding: 8px;">Zimmet Birimi</th>
               <th style="border: 1px solid #ddd; padding: 8px;">Git</th>
        </tr>`;


        tableRows += `
            <tr style="border: 1px solid #ddd;">
              <td style="border: 1px solid #ddd; padding: 8px;">${urun_name}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${urun_aciklama}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${miktar}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${zimmet_name}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${user_name}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${departman_name}</td>
                            <td style="border: 1px solid #ddd; padding: 8px;"><button><a href="http://ik.aho.com/#/zimmet-durum"> Zimmet Onayına Git </a></button></td>

            </tr>`;

        let transporter = nodemailer.createTransport({
            host: '20.0.0.20',
            port: 25,
            secure: false,

            auth: {
                user: 'bilgi@aho.com',
                pass: 'Bilgi5858!'
            },
            tls: {
                rejectUnauthorized: false
            }
        });
        let mailOptions = {
            from: 'bilgi@aho.com',
            to: `${e_posta}`,
            cc: `${zimmet_email},ik@aho.com`,
            subject: `Zimmet Onayı`,
            html: `<p>Sayın İlgili,</p>
    <p>${zimmet_name} Tarafından aşağıda belirtilen ürün için tarafınıza zimmet onayı gönderilmiştir.</p> 
Zimmet listesi .
    <table>${tableRows}</table>`


        };
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log(error);
            } else {
                console.log('Email sent: ' + info.response);
            }
        });
        res.status(200).json({ status: 200, data: result.rows });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};
exports.updateZimmet = async (req, res) => {
    const { item_id, user_id, status, miktar, departman_id, departman_name, user_name, onay, onay_date, assigned_date
        , comments, iade_status, iade_date,is_active } = req.body
    try {
        let dateNow = new Date()
        const result = await pool.query(updateZimmetQuery, [item_id, user_id, status, miktar, dateNow, assigned_date, departman_id, departman_name, user_name, onay, onay_date, JSON.stringify(comments), iade_status, iade_date,is_active]);
        res.status(200).json({ status: 200, data: result.rows });
    } catch (error) {
        console.log(error)
        res.status(400).json({ message: error.message });
    }
};
exports.getUserItemZimmetControl = async (req, res) => {
    const { item_id, user_id, status, departman_id } = req.body
    try {
        const result = await pool.query(getUserItemZimmetControlQuery, [item_id, user_id, departman_id]);
        res.status(200).json({ status: 200, data: result.rows });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};
exports.putItemZimmet = async (req, res) => {
    const { name, description, marka, model, specification, miktar, id, is_active,yer,barcode } = req.body
    try {
console.log(req.body)
        const result = await pool.query(putItemsQuery, [name, description, marka, model, JSON.stringify(specification), miktar, is_active, id,yer,barcode]);
        res.status(200).json({ status: 200, data: result.rows });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};
exports.getItemZimmet = async (req, res) => {
    try {
        const { sorgu } = req.body
        const getItemsQuery = `SELECT pzi.*,pzc.name as categori_name , pzcs.name as categori_sub_name,
COALESCE((SELECT SUM(pza.miktar) as zimmetli FROM portal_zimmet_assigments pza WHERE pzi.id = pza.item_id AND pza.status = true and pza.is_delete=false AND pza.is_active=true ),0) as zimmetli,
(SELECT json_agg(zimmetler) FROM
 (SELECT * FROM portal_zimmet_assigments pza WHERE pzi.id = pza.item_id AND pza.status = true)zimmetler) as zimmetler 
 FROM portal_zimmet_items pzi 
 INNER JOIN portal_zimmet_categories_sub pzcs ON pzcs.id=pzi.categori_id 
 INNER JOIN portal_zimmet_categories pzc ON pzc.id = pzcs.categori_id
  ${sorgu}`
        const totalVeri = await pool.query(`SELECT COUNT(*) FROM portal_zimmet_items`)
        const result = await pool.query(getItemsQuery);
        res.status(200).json({ status: 200, data: result.rows, totalVeri:totalVeri.rows[0].count });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};
exports.getItemZimmetlerDetail = async (req, res) => {
    try {
        const { item_id } = req.body
        const getItemsQuery = `SELECT * FROM portal_zimmet_assigments pza WHERE $1 = pza.item_id AND pza.status = true AND pza.is_active=true AND pza.is_delete=false`
        const result = await pool.query(getItemsQuery,[item_id]);
        res.status(200).json({ status: 200, data: result.rows });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};
exports.getZimmetOnayRapor = async (req, res) => {
    try {
        const result = await pool.query(getZimmetOnayRaporQuery, []);
        res.status(200).json({ status: 200, data: result.rows });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};
exports.postMailZimmetReplay = async (req, res) => {
    try {
        const { e_posta, zimmet_email, name, description, miktar, zimmet_name, user_name, departman_name } = req.body
        let tableRows = `
        <tr style="border: 1px solid #ddd;">
          <th style="border: 1px solid #ddd; padding: 8px;">Ürün Adı</th>
          <th style="border: 1px solid #ddd; padding: 8px;">Ürün Açıklama</th>
          <th style="border: 1px solid #ddd; padding: 8px;">Miktar</th>
          <th style="border: 1px solid #ddd; padding: 8px;">Zimmet Yapan</th>
          <th style="border: 1px solid #ddd; padding: 8px;">Zimmet Alan</th>
          <th style="border: 1px solid #ddd; padding: 8px;">Zimmet Birimi</th>
          <th style="border: 1px solid #ddd; padding: 8px;">Git</th>
        </tr>`;


        tableRows += `
            <tr style="border: 1px solid #ddd;">
              <td style="border: 1px solid #ddd; padding: 8px;">${name}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${description}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${miktar}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${zimmet_name}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${user_name}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${departman_name}</td>
              <td style="border: 1px solid #ddd; padding: 8px;"><button><a href="http://ik.aho.com/#/zimmet-durum"> Git </a></button></td>
            </tr>`;

        let transporter = nodemailer.createTransport({
            host: '20.0.0.20',
            port: 25,
            secure: false,

            auth: {
                user: 'bilgi@aho.com',
                pass: 'Bilgi5858!'
            },
            tls: {
                rejectUnauthorized: false
            }
        });
        let mailOptions = {
            from: 'bilgi@aho.com',
            to: `${e_posta}`,
            cc: `${zimmet_email},ik@aho.com`,
            subject: `Zimmet Onayı Hatırlatma`,
            html: `<p>Sayın İlgili,</p>
    <p>${zimmet_name} Tarafından aşağıda belirtilen ürün için tarafınıza zimmet onayı gönderilmiştir. Onay süreci tamamlanması için hatırlatma yapılmıştır.</p> 
Zimmet listesi .
    <table>${tableRows}</table>    `


        };
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log(error);
            } else {
                console.log('Email sent: ' + info.response);
            }
        });
        res.status(200).json({ status: 200, data: result.rows });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};
exports.getZimmetUserBy = async (req, res) => {
    try {
        const { user_id } = req.body 
        console.log(user_id)
        const result = await pool.query(getZimmetUserByQuery, [user_id]);
        res.status(200).json({ status: 200, data: result.rows });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};
exports.getItemCategori = async (req, res) => {
    try {
        const result = await pool.query(getItemsCategoriQuery, []);
        res.status(200).json({ status: 200, data: result.rows });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};
exports.getItemZimmetByID = async (req, res) => {
    const { urun_id } = req.body
    try {
        const result = await pool.query(getItemsByIDQuery, [urun_id]);
        res.status(200).json({ status: 200, data: result.rows });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};
exports.getReportGenel = async (req, res) => {
    const { urun_id } = req.body
    try {
        const result = await pool.query(getReportGenelQuery);
        res.status(200).json({ status: 200, data: result.rows });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};
exports.geciciMailOkuma = async (req, res) => {
   
        fs.readFile('Onur Akalın.txt', 'utf8', async (err, data) => {
            if (err) {
              console.error('Dosya okunamadı:', err);
              return;
            }
          
            // Kimden, Gönderme Tarihi, Bilgi (Kime) ve Konu'yu ayıklama
            const regex = /Kimden:\s*(.+)\s*Gönderme Tarihi:\s*(.+)\s*Kime:\s*(.+)\s*Konu:\s*(.+)/g;
            let match;
            try {
                while ((match = regex.exec(data)) !== null) {
                const sender = match[1].trim();
                const sentDate = match[2].trim();
                const recipient = match[3].trim();
                const subject = match[4].trim();
          
                // Veritabanına ekleme
                await pool.query(
                  'INSERT INTO mail_oku (sender, sent_date, recipient, subject) VALUES ($1, $2, $3, $4)',
                  [sender, sentDate, recipient, subject]
                );
          
              }
            } catch (error) {
              console.error('Hata oluştu:', error);
            } finally {
              pool.end(); // Veritabanı bağlantısını kapatma
            }
          });
      
};
exports.geciciEnvanterGiris = async (req, res) => {
    try {
        // otomatikDepoCek fonksiyonunu çağırıyoruz

        fs.readFile('envanter.json', 'utf8', async (err, data) => {
            if (err) {
                console.error('Dosya okuma hatası:', err);
                return;
            }

            try {
                const envanter = JSON.parse(data); // JSON verisini objeye çeviriyoruz

                // Envanter içindeki her bir öğeyi işliyoruz
                for (const element of envanter) { // ambar yerine envanter kullanıldı
                    // Miktarı doğru formata çeviriyoruz (virgülü noktaya çeviriyoruz)
                    let specification = [{
                        name: element["ACIKLAMA"]
                    }];
                    // Veritabanında mevcut depoyu kontrol ediyoruz
                    const result = await pool.query(postItemsQueryGecici, [
                        element["MALZEMENİN_ADI"],
                        element["ACIKLAMA"],
                        "", "", JSON.stringify(specification),
                        1, true, element["KATEGORI"], element["YER"], element["BIRIM_ID"],
                        element["BARKOD"]]);
                }

                res.json({ status: 200 });
            } catch (parseError) {
                console.error('JSON parse hatası:', parseError);
            }
        });

        // İşlem başarılı olduğunda istemciye bir yanıt gönderiyoruz
    } catch (error) {
        // Hata durumunda istemciye hata mesajı döndürüyoruz
        console.error('Depo çekme sırasında hata:', error);
        res.status(500).json({ message: 'Depo bilgilerini çekerken bir hata oluştu.' });
    }
};


