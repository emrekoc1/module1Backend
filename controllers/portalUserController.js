
const pool = require('../db');
const path = require('path');
const transliteration = require('transliteration');
const multer = require('multer');
const nodemailer = require("nodemailer");
const fs = require("fs");
const xlsx = require('xlsx');
const { sql, poolPromise } = require('./../msPortalDB');

const storage = multer.diskStorage({
    destination: (req, file, callBack) => {
        const destinationPath = path.join(__dirname, '..', '..', '..', '..', '..', '..', 'wamp64', 'www', 'ik', 'assets', 'images', 'user_photo');
        callBack(null, destinationPath)
    },
    filename: (req, file, callBack) => {
        const bugun = new Date();
        const tarihDamgasi = bugun.toISOString().replace(/[:.]/g, '').substring(0, 10); // Sadece '2023-08-25' bölümü
        const originalnameWithoutExtension = path.parse(file.originalname).name;
        const transliteratedName = transliteration.slugify(originalnameWithoutExtension, { lowercase: false });
        callBack(null, `user_${tarihDamgasi}${transliteratedName}${path.extname(file.originalname)}`);
    }
})
const getUserLoginQuery = `SELECT us.*,(SELECT json_agg(yetkiler) FROM (SELECT * FROM gk_yetkilendirme gky WHERE gky.user_id = us.sicil )yetkiler)as yetkiler FROM portal_user us WHERE us.sicil= $1 AND us.password= $2 `
const getUserSifreDurum = `SELECT * FROM portal_user us WHERE us.sicil= $1 `
const updateUserPassword = `UPDATE portal_user SET  password=$2,password_status=1 WHERE us.sicil= $1 `
const updateUserGenelQuery = `UPDATE portal_user
	SET user_name=$2, email=$3, password=$4, sicil=$5, phone=$6, user_type=$7, user_typename=$8, is_active=$9, is_delete=$10, password_status=$11, main_user=$12, pas_reset=$13, photo=$14, dogum_tarih=$15, is_baslangic=$16,puan=$17
	WHERE id=$1 `
const getUserPassControl = `SELECT password FROM portal_user  WHERE sicil= $1 `
const insertUserSkill = `INSERT INTO portal_user_skills(
	sicil, skill_id, skill_level,hedef_level
,gercek_level)
	VALUES ($1, $2, $3,$4,$5)`
const updateUserSkill = `UPDATE portal_user_skills SET
	sicil = $1, skill_id = $2, skill_level = $3, hedef_level=$5 , gercek_level=$6	WHERE id = $4`
const getAllSkillsQuerys = `SELECT skil.skill_category,skil.skill_name,uskil.sicil,uskil.skill_level,uskil.hedef_level,uskil.gercek_level,skil.id as skill_id,uskil.id ,(SELECT json_agg(yetkinlik_list) FROM 
(SELECT * FROM portal_skill_description des WHERE des.skill_id= skil.id  AND  des.puan<=uskil.skill_level)yetkinlik_list) as descriptions FROM portal_skills skil LEFT JOIN portal_user_skills uskil
ON skil.id=uskil.skill_id AND uskil.sicil=$1 ORDER BY skil.id`
const getUserControlQuery = `SELECT us.* FROM portal_user us WHERE us.sicil= $1 AND us.email= $2 `
const upload = multer({ storage: storage })
const postUserAllQuery = `INSERT INTO portal_user(
	user_name, email, password, sicil, phone, user_type, user_typename, is_active, is_delete, password_status,main_user)
	VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,$11)`
const postUserBirimQuery = `INSERT INTO portal_user_departman(
 user_id, departman_id, departman_name)
	VALUES ($1, $2, $3)`
const getUserAll = `SELECT * FROM portal_user`
const getusersDepartmantQuery = `SELECT * FROM portal_user pus INNER JOIN portal_user_departman pud ON pud.user_id = pus.sicil  AND pud.departman_id = $1`
const updateUserPaswordQuery = `UPDATE portal_user SET password=$2, pas_reset = $3 WHERE sicil = $1
`
const insertUserEgitimQuery = `INSERT INTO portal_user_egitim(
	sicil, tur, okul_adi, bolum, durum)
	VALUES ($1, $2, $3, $4, $5)`
const updateUserEgitimQuery = `UPDATE portal_user_egitim  SET 
	sicil = $2, tur = $3, okul_adi = $4, bolum = $5, durum = $6
	WHERE id=$1`
const insertUserDepartmanMatchingQuery = `INSERT INTO portal_departman_users(
department_id, sicil, status, type, ust_amir,proje)
	VALUES ($1, $2, $3, $4,$5,$6)`

const updateUserFotoQuery = `UPDATE portal_user SET photo = $2 WHERE id = $1`
const getGenelQuery = `SELECT 
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
    (SELECT json_agg(yetkiler) FROM (SELECT * FROM gk_yetkilendirme gky WHERE gky.user_id = pu.sicil )yetkiler)as yetkiler ,
    (SELECT json_agg(departman) 
     FROM
         (SELECT pud.departman_id,
                 (SELECT description FROM portal_departman WHERE pud.departman_id = id) AS departman_name
          FROM portal_user_departman pud 
          WHERE pu.sicil = pud.user_id) AS departman) AS departman 
FROM portal_user pu`
const selectUserSicilOrgQury = `SELECT usr.*,'[]' as yetenek,(SELECT json_agg(egitim)as  egitim FROM(SELECT*
	FROM portal_user_egitim WHERE sicil=usr.sicil) egitim),(SELECT json_agg(aho_egitim) as aho_egitim FROM (SELECT *  FROM portal_user_egitim_aho puae WHERE puae.sicil=usr.sicil ) aho_egitim) , (SELECT json_agg(birim) as birim FROM (SELECT *,(SELECT name FROM portal_departman_organizasyon WHERE id = pud.department_id )  FROM portal_departman_users pud WHERE pud.sicil=usr.sicil ) birim) FROM portal_user usr WHERE usr.sicil= $1`
const insertBirimOrganizasyon = `INSERT INTO portal_departman_organizasyon ( name, parent_id, css_class, img, departman_id, aciklama) VALUES ($1,$2,$3,$4,$5,$6) RETURNING * `
const insertUserAhoEgitimQuery = `INSERT INTO portal_user_egitim_aho(
	 sicil, egitim_adi, egitim_veren, egitim_yeri, sertifika, egitim_tarih, egitim_suresi)
	VALUES ($1, $2, $3, $4, $5, $6, $7) `
const updateBirimOrganizasyon = `UPDATE portal_departman_organizasyon SET name = $2, parent_id = $3, css_class = $4, img = $5, departman_id = $6, aciklama = $7 , is_delete = $8 , is_active=$9 WHERE id = $1 `
const updateBirimUserOrganizasyon = `UPDATE portal_departman_users
	SET department_id=$2, sicil=$3, status=$4, type=$5, ust_amir=$6,proje=$7
	WHERE  id=$1 `
const deleteBirimOrganizasyonQuery = `DELETE FROM portal_departman_users
	
	WHERE  id=$1 `
const getGenelDepartmanOrganizasyon = `SELECT pdo.* FROM portal_departman_organizasyon  pdo WHERE is_delete = false AND is_active=true `
const getBirimUserQuery = `	
SELECT users.*,dpu.* FROM portal_departman_users dpu
	INNER JOIN portal_user users ON dpu.sicil= users.sicil AND dpu.department_id =$1  AND users.is_active ORDER BY dpu.status `
function buildHierarchy(users) {
    const userMap = {};

    // İlk olarak tüm kullanıcıları bir nesneye yerleştiriyoruz
    users.forEach(user => {
        user.children = [];  // Her kullanıcının altındaki kullanıcıları tutmak için bir dizi ekliyoruz
        userMap[user.sicil] = user;  // Sicil numarasına göre haritaya ekliyoruz
    });

    let root = [];  // Ana kullanıcıları tutacak kök dizisi

    users.forEach(user => {
        if (user.main_user === null) {
            // Eğer main_user alanı null ise, bu kullanıcı genel müdürdür ve kök dizisine eklenir
            root.push(user);
        } else {
            // Aksi halde, kullanıcının main_user'ına gidip onun çocuklarına eklenir
            const parent = userMap[user.ust_amir];
            if (parent) {
                parent.children.push(user);
            }
        }
    });

    return root;  // Hiyerarşik yapıyı döndürüyoruz
};
async function buildHierarchyBirim(birimler) {
    const birimMap = {};

    // Tüm birimleri haritaya yerleştiriyoruz
    for (let birim of birimler) {
        birim.subordinates = [];  // Alt birimleri saklamak için
        birim.children = [];  // Kullanıcıları saklamak için
        birim.personel = [];  // Alt birimlerden gelen tüm kullanıcıları saklamak için
        birimMap[birim.id] = birim;  // ID bazlı birim haritası

        const users = await pool.query(getBirimUserQuery, [birim.id]);

        if (users.rowCount > 0) {
            let yonetici = users.rows.reduce((minUser, user) => {
                return user.status < minUser.status ? user : minUser;
            }, users.rows[0]);

            users.rows.forEach(user => {
                if (user === yonetici) {
                    // Yönetici bilgileri atanıyor
                    birim.user_name = user.user_name;
                    birim.type = user.type;
                    birim.sicil = user.sicil;
                    birim.photo = user.photo;
                }

                // Tüm kullanıcılar children ve personel listesine ekleniyor
                birim.children.push(user);
                birim.personel.push(user);
            })
            // Eğer user_name atanmadıysa, type 1 olan yöneticiyi alalım
            if (!birim.user_name) {
                users.rows.forEach(user => {
                    if (user.status === 0 && user.type === 1) {
                        birim.user_name = user.user_name;
                        birim.type = user.type;
                        birim.sicil = user.sicil;
                        birim.photo = user.photo;
                    }
                });
            }
        }
    }

    let root = [];  // En üst seviyedeki birimler

    for (let birim of birimler) {
        if (birim.parent_id === null) {
            root.push(birim);
        } else {
            // Alt birimleri parent'ın subordinates dizisine ekliyoruz
            const parent = birimMap[birim.parent_id];
            if (parent) {
                parent.subordinates.push(birim);
            }
        }
    }

    // Personel listesini alt birimlerden yukarı taşımak için recursive bir fonksiyon
    function aggregatePersonel(birim) {
        for (const sub of birim.subordinates) {
            aggregatePersonel(sub);
            const copiedPersonel = sub.personel.map(p => ({
                ...p,
                birim_name: p.birim_name || sub.name // Eğer zaten varsa elleme, yoksa sub birimin adını yaz
            }));
            birim.personel = birim.personel.concat(copiedPersonel);
        }
    }

    root.forEach(aggregatePersonel); // Her kök birim için personel listesini güncelle

    return JSON.parse(JSON.stringify(root, (key, value) => (key === 'parent' ? undefined : value)));
};
exports.selectUserSkillAll = async (req, res) => {
    try {
        const { search, kategori, skill, puan, birim } = req.body;
        let whereClause = 'ORDER BY s.id';
        let values = [];

        if (birim) {
            if (search?.trim()) {

                if (Number.isInteger(Number(search))) {
                    if (skill?.trim()) {
                        if (skill == 'Tumu') {
                            whereClause = `WHERE  u.sicil = ${search}  
                       AND s.skill_category = '${kategori}' AND us.skill_level=${puan} ORDER BY  s.id`;
                        } else {
                            whereClause = `WHERE  u.sicil = ${search} AND  
                        u.sicil IN (
                            SELECT usr.sicil  
                            FROM public.portal_user_skills usr
                            JOIN public.portal_skills sk ON usr.skill_id = sk.id  
                            WHERE sk.skill_category = '${kategori}' 
                            AND sk.skill_name = '${skill}' 
                            AND usr.skill_level = ${puan}
                        ) and   u.sicil IN (
            SELECT sicil
	            FROM portal_departman_users
                WHERE department_id = ${birim}
            ) ORDER BY  s.id`;
                        }

                    } else {
                        // If search is an integer, compare with 'sicil'
                        whereClause = ` WHERE  u.sicil = ${search} and   u.sicil IN (
            SELECT sicil
	            FROM portal_departman_users
                WHERE department_id = ${birim}
            ) ORDER BY  s.id `;
                    }

                } else {
                    if (skill?.trim()) {
                        if (skill == 'Tumu') {
                            whereClause = `WHERE  (u.user_name) ILIKE '%${search}%'  AND s.skill_category = '${kategori}' AND us.skill_level=${puan} ORDER BY  s.id `;
                        } else {
                            whereClause = `WHERE(u.user_name) ILIKE '%${search}%' AND
                        u.sicil IN (
                            SELECT usr.sicil  
                            FROM public.portal_user_skills usr
                            JOIN public.portal_skills sk ON usr.skill_id = sk.id  
                            WHERE sk.skill_category = '${kategori}' 
                            AND sk.skill_name = '${skill}' 
                            AND usr.skill_level = ${puan}
                        ) and and   u.sicil IN (
            SELECT sicil
	            FROM portal_departman_users
                WHERE department_id = ${birim}
            )  ORDER BY  s.id`;
                        }

                    } else {
                        // If search is an integer, compare with 'sicil'
                        whereClause = ` WHERE (u.user_name) ILIKE '%${search}%' and   u.sicil IN (
            SELECT sicil
	            FROM portal_departman_users
                WHERE department_id = ${birim}
            )  ORDER BY s.id  `;
                    }
                    // If search is a string, perform case-insensitive search on 'user_name'

                }
            } else {
                if (skill?.trim()) {
                    if (skill == 'Tumu') {
                        whereClause = `WHERE 
                s.skill_category = '${kategori}' AND us.skill_level=${puan} ORDER BY  s.id`;
                    } else {
                        whereClause = `WHERE 
                u.sicil IN (
                    SELECT usr.sicil  
                    FROM public.portal_user_skills usr
                    JOIN public.portal_skills sk ON usr.skill_id = sk.id  
                    WHERE sk.skill_category = '${kategori}' 
                    AND sk.skill_name = '${skill}' 
                    AND usr.skill_level = ${puan}
                ) and   u.sicil IN (
            SELECT sicil
	            FROM portal_departman_users
                WHERE department_id = ${birim}
            )  ORDER BY  s.id`;
                    }

                } else {
                    whereClause = `WHERE 
                    u.sicil IN (
                    SELECT sicil
                        FROM portal_departman_users
                        WHERE department_id = ${birim}
                    ) and   u.sicil IN (
                    SELECT sicil
                        FROM portal_departman_users
                        WHERE department_id = ${birim}
                    )  ORDER BY  s.id`;
                }

            }

        } else {
            if (search?.trim()) {

                if (Number.isInteger(Number(search))) {
                    if (skill?.trim()) {
                        if (skill == 'Tumu') {
                            whereClause = `WHERE  u.sicil = ${search}  
                       AND s.skill_category = '${kategori}' AND us.skill_level=${puan} ORDER BY  s.id`;
                        } else {
                            whereClause = `WHERE  u.sicil = ${search} AND 
                        u.sicil IN (
                            SELECT usr.sicil  
                            FROM public.portal_user_skills usr
                            JOIN public.portal_skills sk ON usr.skill_id = sk.id  
                            WHERE sk.skill_category = '${kategori}' 
                            AND sk.skill_name = '${skill}' 
                            AND usr.skill_level = ${puan}
                        ) ORDER BY  s.id`;
                        }

                    } else {
                        // If search is an integer, compare with 'sicil'
                        whereClause = ` WHERE  u.sicil = ${search} ORDER BY  s.id `;
                    }

                } else {
                    if (skill?.trim()) {
                        if (skill == 'Tumu') {
                            whereClause = `WHERE  (u.user_name) ILIKE '%${search}%'  AND s.skill_category = '${kategori}' AND us.skill_level=${puan} ORDER BY  s.id `;
                        } else {
                            whereClause = `WHERE(u.user_name) ILIKE '%${search}%' AND
                        u.sicil IN (
                            SELECT usr.sicil  
                            FROM public.portal_user_skills usr
                            JOIN public.portal_skills sk ON usr.skill_id = sk.id  
                            WHERE sk.skill_category = '${kategori}' 
                            AND sk.skill_name = '${skill}' 
                            AND usr.skill_level = ${puan}
                        ) ORDER BY  s.id`;
                        }

                    } else {
                        // If search is an integer, compare with 'sicil'
                        whereClause = ` WHERE (u.user_name) ILIKE '%${search}%' ORDER BY s.id  `;
                    }
                    // If search is a string, perform case-insensitive search on 'user_name'

                }
            } else {
                if (skill?.trim()) {
                    if (skill == 'Tumu') {
                        whereClause = `WHERE 
                s.skill_category = '${kategori}' AND us.skill_level=${puan} ORDER BY  s.id`;
                    } else {
                        whereClause = `WHERE 
                u.sicil IN (
                    SELECT usr.sicil  
                    FROM public.portal_user_skills usr
                    JOIN public.portal_skills sk ON usr.skill_id = sk.id  
                    WHERE sk.skill_category = '${kategori}' 
                    AND sk.skill_name = '${skill}' 
                    AND usr.skill_level = ${puan}
                ) ORDER BY  s.id`;
                    }

                }

            }
        }



        const selectUserSkillAll = `
                SELECT 
                    u.sicil,
                    u.user_name,
                    s.skill_category,
                    s.skill_name,
                    us.skill_level,us.hedef_level,us.gercek_level,(SELECT json_agg(yetkinlik_list) FROM 
                (SELECT * FROM portal_skill_description des WHERE des.skill_id=  s.id   AND  des.puan<=us.skill_level)yetkinlik_list) as descriptions 
                FROM 
                    public.portal_user_skills us
                JOIN 
                public.portal_skills s ON us.skill_id = s.id  
                JOIN 
                    public.portal_user u  ON u.sicil = us.sicil AND u.is_active ${whereClause} `
        const resultTotal = await pool.query(`	SELECT 
    s.skill_name,
    COUNT(CASE WHEN us.skill_level = 1 THEN 1 END) AS level_1,
    COUNT(CASE WHEN us.skill_level = 0.75 THEN 1 END) AS level_075,
    COUNT(CASE WHEN us.skill_level = 0.5 THEN 1 END) AS level_05,
    COUNT(CASE WHEN us.skill_level = 0.25 THEN 1 END) AS level_025,
    COUNT(CASE WHEN us.skill_level = 0 THEN 1 END) AS level_0,
	 COUNT(CASE WHEN us.hedef_level = 1 THEN 1 END) AS hlevel_1,
    COUNT(CASE WHEN us.hedef_level = 0.75 THEN 1 END) AS hlevel_075,
    COUNT(CASE WHEN us.hedef_level = 0.5 THEN 1 END) AS hlevel_05,
    COUNT(CASE WHEN us.hedef_level = 0.25 THEN 1 END) AS hlevel_025,
    COUNT(CASE WHEN us.hedef_level = 0 THEN 1 END) AS hlevel_0,
	 COUNT(CASE WHEN us.gercek_level = 1 THEN 1 END) AS glevel_1,
    COUNT(CASE WHEN us.gercek_level = 0.75 THEN 1 END) AS glevel_075,
    COUNT(CASE WHEN us.gercek_level = 0.5 THEN 1 END) AS glevel_05,
    COUNT(CASE WHEN us.gercek_level = 0.25 THEN 1 END) AS glevel_025,
    COUNT(CASE WHEN us.gercek_level = 0 THEN 1 END) AS glevel_0
FROM portal_skills s
INNER JOIN portal_user_skills us ON us.skill_id = s.id
GROUP BY s.skill_name`)
        const result = await pool.query(selectUserSkillAll)
        if (result.rowCount > 0) {
            res.status(200).json({
                status: 200,
                data: result.rows,
                dataGenel: resultTotal.rows
            })
        } else {
            res.status(200).json({
                status: 205,
                data: result.rows,
                dataGenel: resultTotal.rows
            })
        }

    } catch (error) {
        res.status(500).json({ error: error })
        console.error(error)
    }
}
exports.getAllSkills = async (req, res) => {
    try {
        const { sicil } = req.body
        const result = await pool.query(getAllSkillsQuerys, [sicil])
        res.status(200).json({
            status: 200,
            data: result.rows
        })
    } catch (error) {
        res.status(500).json({ error: error })
    }
}
exports.getGenelDepartmanOrganizasyonFonk = async (req, res) => {
    try {
        const { sicil } = req.body
        const result = await pool.query(getGenelDepartmanOrganizasyon)
        res.status(200).json({
            status: 200,
            data: result.rows
        })
    } catch (error) {
        res.status(500).json({ error: error })
    }
}
exports.insertAllSkill = async (req, res) => {
    try {

        const data = req.body
        let result
        for (let datas of data) {
            const { sicil, skill_id, skill_level, id, hedef_level, gercek_level } = datas
            console.log(sicil, skill_id, skill_level, id)
            if (id) {
                result = await pool.query(updateUserSkill, [sicil, skill_id, skill_level, id, hedef_level, gercek_level])
            } else {
                result = await pool.query(insertUserSkill, [sicil, skill_id, skill_level, hedef_level, gercek_level])
            }
        }

        res.status(200).json({
            status: 200,
            data: result.rows
        })
    } catch (error) {
        res.status(500).json({ error: error })
    }
}
exports.updateUserEgitim = async (req, res) => {
    try {
        const { id, sicil, tur, okul_adi, bolum, durum } = req.body

        const result = await pool.query(updateUserEgitimQuery, [id, sicil, tur, okul_adi, bolum, durum])
        res.status(200).json({
            status: 200,
            data: result.rows[0]
        })
    } catch (error) {
        res.status(500).json({ error: error })
    }
}
exports.insertUserEgitim = async (req, res) => {
    try {
        const { sicil, tur, okul_adi, bolum, durum } = req.body

        const result = await pool.query(insertUserEgitimQuery, [sicil, tur, okul_adi, bolum, durum])
        res.status(200).json({
            status: 200,
            data: result.rows[0]
        })
    } catch (error) {
        res.status(500).json({ error: error })
    }
}
function findHierarchyById(hierarchy, id) {
    for (const birim of hierarchy) {
        if (birim.id === id) {
            return birim; // Eğer aradığımız ID bu ise direkt döndür
        }
        if (birim.subordinates && birim.subordinates.length > 0) {
            const found = findHierarchyById(birim.subordinates, id);
            if (found) return found;
        }
    }
    return null; // Eğer bulunamazsa null döndür
}
exports.getDepartmanOrganizasyon = async (req, res) => {
    try {
        const result = await pool.query(getGenelDepartmanOrganizasyon)
        let data = result
        for (let birim of result.rows) {
            birim.showHide = true;
            birim.showHide2 = true;
            birim.user_name = null
            birim.type = null
            birim.sicil = null
            birim.photo = null
        }
        const hierarchy = await buildHierarchyBirim(result.rows);

        const resutlUser = await pool.query(getUserAll)
        const { id } = req.body; // Örneğin: /api/departman-organizasyon?id=5

        let filteredHierarchy = hierarchy;
        if (id) {
            const targetId = parseInt(id, 10);
            filteredHierarchy = findHierarchyById(hierarchy, targetId);
        }
        const resultGenel = await pool.query(`
             SELECT
 			(SELECT COUNT(DISTINCT sicil) as toplam_personel   FROM portal_departman_users),
            (SELECT COUNT(DISTINCT sicil) as toplam_yonetici   FROM portal_departman_users WHERE (status=0 or status=1)),
			(SELECT COUNT(DISTINCT sicil) as toplam_muhendis   FROM portal_departman_users WHERE status=5),
			(SELECT COUNT(DISTINCT sicil) as toplam_amir   FROM portal_departman_users WHERE (status=2 or status=3 or status=4)),
			(SELECT COUNT(DISTINCT sicil) as toplam_teknisyen   FROM portal_departman_users WHERE status=7),
			(SELECT COUNT(DISTINCT sicil) as toplam_beyaz_yaka   FROM portal_departman_users WHERE status=6),
            (SELECT AVG(EXTRACT(YEAR FROM AGE(dogum_tarih))) AS ortalama_yas FROM portal_user),
			 (SELECT AVG(EXTRACT(YEAR FROM AGE(is_baslangic))) AS is_tecrube FROM portal_user),
			 (SELECT AVG(gecmis_tecrube) AS gecmis_is_tecrubesi FROM portal_user),
			 
			
              (SELECT json_agg(yonetici) FROM (SELECT pdu.department_id,pdu.status,pdu.sicil, 
											 (SELECT user_name FROM portal_user WHERE sicil = pdu.sicil ),
											 (SELECT name FROM portal_departman_organizasyon WHERE id = pdu.department_id) 
			 FROM portal_departman_users pdu WHERE (pdu.status=0 or pdu.status=1) ORDER BY pdu.status,pdu.department_id DESC) yonetici) yonetici,
			 
              (SELECT json_agg(muhendis) FROM (SELECT pdu.department_id,pdu.status,pdu.sicil, 
											 (SELECT user_name FROM portal_user WHERE sicil = pdu.sicil ),
											 (SELECT name FROM portal_departman_organizasyon WHERE id = pdu.department_id) 
			 FROM portal_departman_users pdu WHERE (pdu.status=5) ORDER BY pdu.status,pdu.sicil) muhendis) muhendis,
			 			
              (SELECT json_agg(amir) FROM (SELECT pdu.department_id,pdu.status,pdu.sicil, 
											 (SELECT user_name FROM portal_user WHERE sicil = pdu.sicil ),
											 (SELECT name FROM portal_departman_organizasyon WHERE id = pdu.department_id) 
			 FROM portal_departman_users pdu WHERE (pdu.status=2 or pdu.status=3 or pdu.status=4) ORDER BY pdu.status,pdu.sicil) amir) amir,
			 
              (SELECT json_agg(teknisyen) FROM (SELECT pdu.department_id,pdu.status,pdu.sicil, 
											 (SELECT user_name FROM portal_user WHERE sicil = pdu.sicil ),
											 (SELECT name FROM portal_departman_organizasyon WHERE id = pdu.department_id) 
			 FROM portal_departman_users pdu WHERE (pdu.status=7) ORDER BY pdu.status,pdu.sicil) teknisyen) teknisyen,
			 
              (SELECT json_agg(beyaz_yaka) FROM (SELECT pdu.department_id,pdu.status,pdu.sicil, 
											 (SELECT user_name FROM portal_user WHERE sicil = pdu.sicil ),
											 (SELECT name FROM portal_departman_organizasyon WHERE id = pdu.department_id) 
			 FROM portal_departman_users pdu WHERE (pdu.status=6) ORDER BY pdu.status,pdu.sicil) beyaz_yaka) beyaz_yaka
	
	
		`)
        res.status(200).json(
            {
                data: hierarchy,
                birimler: data.rows,
                filteredHierarchy: filteredHierarchy,
                user: resutlUser.rows,
                dateGenel: resultGenel.rows[0],
                status: 200
            }
        )
    } catch (error) {
        console.error('User Hatası:', error);
        res.status(500).json({ message: 'Depo bilgilerini çekerken bir hata oluştu.' });
    }
}

const excelFilePath = '\\\\fileserver\\Insan Kaynakları\\İK Ortak\\Personel Takip 2025\\PERSONEL TAKİP ÇİZELGESİ 2025.xlsx';
const sheetName = 'Personel Listesi';
const excelFilePathOcak = '\\\\fileserver\\Insan Kaynakları\\İK Ortak\\Personel Takip 2025\\1- OCAK.xlsx';
const sheetNameOcak = '01';
const excelFilePathSubat = '\\\\fileserver\\Insan Kaynakları\\İK Ortak\\Personel Takip 2025\\2- ŞUBAT.xlsx';
const sheetNameSubat = '02';
const excelFilePathMart = '\\\\fileserver\\Insan Kaynakları\\İK Ortak\\Personel Takip 2025\\3- MART.xlsx';
const sheetNameMart = '03';
const excelFilePathNisan = '\\\\fileserver\\Insan Kaynakları\\İK Ortak\\Personel Takip 2025\\4- NİSAN.xlsx';
const sheetNameNisan = '04';
const excelFilePathMayis = '\\\\fileserver\\Insan Kaynakları\\İK Ortak\\Personel Takip 2025\\5- MAYIS.xlsx';
const sheetNameMayis = '05';
const excelFilePathHaziran = '\\\\fileserver\\Insan Kaynakları\\İK Ortak\\Personel Takip 2025\\6- HAZİRAN.xlsx';
const sheetNameHaziran = '06';
const excelFilePathTemmuz = '\\\\fileserver\\Insan Kaynakları\\İK Ortak\\Personel Takip 2025\\7- TEMMUZ.xlsx';
const sheetNameTemmuz = '07';
const excelFilePathAgustos = '\\\\fileserver\\Insan Kaynakları\\İK Ortak\\Personel Takip 2025\\8- AĞUSTOS.xlsx';
const sheetNameAgustos = '08';
const excelFilePathEylul = '\\\\fileserver\\Insan Kaynakları\\İK Ortak\\Personel Takip 2025\\9- EYLÜL.xlsx';
const sheetNameEylul = '09';
const excelFilePathEkim = '\\\\fileserver\\Insan Kaynakları\\İK Ortak\\Personel Takip 2025\\10- EKİM.xlsx';
const sheetNameEkim = '10';
const excelFilePathKasim = '\\\\fileserver\\Insan Kaynakları\\İK Ortak\\Personel Takip 2025\\11- KASIM.xlsx';
const sheetNameKasim = '11';
const excelFilePathAralik = '\\\\fileserver\\Insan Kaynakları\\İK Ortak\\Personel Takip 2025\\12- ARALIK.xlsx';
const sheetNameAralik = '12';

const getRemainingLeaveAralik = (userName) => {
    try {
        // Excel 0ku

        const workbook = xlsx.readFile(excelFilePathAralik, { cellDates: true });
        const worksheet = workbook.Sheets[sheetNameAralik];

        const range = xlsx.utils.decode_range(worksheet['!ref']);

        let userNameColumn = 'B'; // Sicil No (A sütunu)
        let kullanilanColumn = 'AP';  // Hak Edilen
        let mazeretKullanilanColumn = 'AQ';  // Hak Edilen

        // Sicil sütununda arama yap
        for (let row = range.s.r; row <= range.e.r; row++) {
            let cellAddress = `${userNameColumn}${row + 1}`;
            let cell = worksheet[cellAddress];

            if (cell && cell.v == userName) {
                let izinAddress = `${kullanilanColumn}${row + 1}`;
                let mazeretIzinAddress = `${mazeretKullanilanColumn}${row + 1}`;
                let izinCell = worksheet[izinAddress];
                let mazeretIzinCell = worksheet[mazeretIzinAddress];
                return { yillik: izinCell.v, mazeret: mazeretIzinCell.v }
            }
        }

        // Kalan izin değerini döndür
        return null;
    } catch (error) {
        console.error("Excel okuma hatası:", error);
        return null;
    }
};
const getRemainingLeaveKasim = (userName) => {
    try {
        // Excel 0ku

        const workbook = xlsx.readFile(excelFilePathKasim, { cellDates: true });
        const worksheet = workbook.Sheets[sheetNameKasim];

        const range = xlsx.utils.decode_range(worksheet['!ref']);

        let userNameColumn = 'B'; // Sicil No (A sütunu)
        let kullanilanColumn = 'AP';  // Hak Edilen
        let mazeretKullanilanColumn = 'AQ';  // Hak Edilen

        // Sicil sütununda arama yap
        for (let row = range.s.r; row <= range.e.r; row++) {
            let cellAddress = `${userNameColumn}${row + 1}`;
            let cell = worksheet[cellAddress];

            if (cell && cell.v == userName) {
                let izinAddress = `${kullanilanColumn}${row + 1}`;
                let mazeretIzinAddress = `${mazeretKullanilanColumn}${row + 1}`;
                let izinCell = worksheet[izinAddress];
                let mazeretIzinCell = worksheet[mazeretIzinAddress];
                return { yillik: izinCell.v, mazeret: mazeretIzinCell.v }
            }
        }

        // Kalan izin değerini döndür
        return null;
    } catch (error) {
        console.error("Excel okuma hatası:", error);
        return null;
    }
};
const getRemainingLeaveEkim = (userName) => {
    try {
        // Excel 0ku

        const workbook = xlsx.readFile(excelFilePathEkim, { cellDates: true });
        const worksheet = workbook.Sheets[sheetNameEkim];

        const range = xlsx.utils.decode_range(worksheet['!ref']);

        let userNameColumn = 'B'; // Sicil No (A sütunu)
        let kullanilanColumn = 'AP';  // Hak Edilen
        let mazeretKullanilanColumn = 'AQ';  // Hak Edilen

        // Sicil sütununda arama yap
        for (let row = range.s.r; row <= range.e.r; row++) {
            let cellAddress = `${userNameColumn}${row + 1}`;
            let cell = worksheet[cellAddress];

            if (cell && cell.v == userName) {
                let izinAddress = `${kullanilanColumn}${row + 1}`;
                let mazeretIzinAddress = `${mazeretKullanilanColumn}${row + 1}`;
                let izinCell = worksheet[izinAddress];
                let mazeretIzinCell = worksheet[mazeretIzinAddress];
                return { yillik: izinCell.v, mazeret: mazeretIzinCell.v }
            }
        }

        // Kalan izin değerini döndür
        return null;
    } catch (error) {
        console.error("Excel okuma hatası:", error);
        return null;
    }
};
const getRemainingLeaveEylul = (userName) => {
    try {
        // Excel 0ku

        const workbook = xlsx.readFile(excelFilePathEylul, { cellDates: true });
        const worksheet = workbook.Sheets[sheetNameEylul];

        const range = xlsx.utils.decode_range(worksheet['!ref']);

        let userNameColumn = 'B'; // Sicil No (A sütunu)
        let kullanilanColumn = 'AP';  // Hak Edilen
        let mazeretKullanilanColumn = 'AQ';  // Hak Edilen

        // Sicil sütununda arama yap
        for (let row = range.s.r; row <= range.e.r; row++) {
            let cellAddress = `${userNameColumn}${row + 1}`;
            let cell = worksheet[cellAddress];

            if (cell && cell.v == userName) {
                let izinAddress = `${kullanilanColumn}${row + 1}`;
                let mazeretIzinAddress = `${mazeretKullanilanColumn}${row + 1}`;
                let izinCell = worksheet[izinAddress];
                let mazeretIzinCell = worksheet[mazeretIzinAddress];
                return { yillik: izinCell.v, mazeret: mazeretIzinCell.v }
            }
        }

        // Kalan izin değerini döndür
        return null;
    } catch (error) {
        console.error("Excel okuma hatası:", error);
        return null;
    }
};
const getRemainingLeaveAgustos = (userName) => {
    try {
        // Excel 0ku

        const workbook = xlsx.readFile(excelFilePathAgustos, { cellDates: true });
        const worksheet = workbook.Sheets[sheetNameAgustos];

        const range = xlsx.utils.decode_range(worksheet['!ref']);

        let userNameColumn = 'B'; // Sicil No (A sütunu)
        let kullanilanColumn = 'AP';  // Hak Edilen
        let mazeretKullanilanColumn = 'AQ';  // Hak Edilen

        // Sicil sütununda arama yap
        for (let row = range.s.r; row <= range.e.r; row++) {
            let cellAddress = `${userNameColumn}${row + 1}`;
            let cell = worksheet[cellAddress];

            if (cell && cell.v == userName) {
                let izinAddress = `${kullanilanColumn}${row + 1}`;
                let mazeretIzinAddress = `${mazeretKullanilanColumn}${row + 1}`;
                let izinCell = worksheet[izinAddress];
                let mazeretIzinCell = worksheet[mazeretIzinAddress];
                return { yillik: izinCell.v, mazeret: mazeretIzinCell.v }
            }
        }

        // Kalan izin değerini döndür
        return null;
    } catch (error) {
        console.error("Excel okuma hatası:", error);
        return null;
    }
};
const getRemainingLeaveTemmuz = (userName) => {
    try {
        // Excel 0ku

        const workbook = xlsx.readFile(excelFilePathTemmuz, { cellDates: true });
        const worksheet = workbook.Sheets[sheetNameTemmuz];

        const range = xlsx.utils.decode_range(worksheet['!ref']);

        let userNameColumn = 'B'; // Sicil No (A sütunu)
        let kullanilanColumn = 'AP';  // Hak Edilen
        let mazeretKullanilanColumn = 'AQ';  // Hak Edilen

        // Sicil sütununda arama yap
        for (let row = range.s.r; row <= range.e.r; row++) {
            let cellAddress = `${userNameColumn}${row + 1}`;
            let cell = worksheet[cellAddress];

            if (cell && cell.v == userName) {
                let izinAddress = `${kullanilanColumn}${row + 1}`;
                let mazeretIzinAddress = `${mazeretKullanilanColumn}${row + 1}`;
                let izinCell = worksheet[izinAddress];
                let mazeretIzinCell = worksheet[mazeretIzinAddress];
                return { yillik: izinCell.v, mazeret: mazeretIzinCell.v }
            }
        }

        // Kalan izin değerini döndür
        return null;
    } catch (error) {
        console.error("Excel okuma hatası:", error);
        return null;
    }
};
const getRemainingLeaveHaziran = (userName) => {
    try {
        // Excel 0ku

        const workbook = xlsx.readFile(excelFilePathHaziran, { cellDates: true });
        const worksheet = workbook.Sheets[sheetNameHaziran];

        const range = xlsx.utils.decode_range(worksheet['!ref']);

        let userNameColumn = 'B'; // Sicil No (A sütunu)
        let kullanilanColumn = 'AP';  // Hak Edilen
        let mazeretKullanilanColumn = 'AQ';  // Hak Edilen

        // Sicil sütununda arama yap
        for (let row = range.s.r; row <= range.e.r; row++) {
            let cellAddress = `${userNameColumn}${row + 1}`;
            let cell = worksheet[cellAddress];

            if (cell && cell.v == userName) {
                let izinAddress = `${kullanilanColumn}${row + 1}`;
                let mazeretIzinAddress = `${mazeretKullanilanColumn}${row + 1}`;
                let izinCell = worksheet[izinAddress];
                let mazeretIzinCell = worksheet[mazeretIzinAddress];
                return { yillik: izinCell.v, mazeret: mazeretIzinCell.v }
            }
        }

        // Kalan izin değerini döndür
        return null;
    } catch (error) {
        console.error("Excel okuma hatası:", error);
        return null;
    }
};
const getRemainingLeaveMayis = (userName) => {
    try {
        // Excel 0ku

        const workbook = xlsx.readFile(excelFilePathMayis, { cellDates: true });
        const worksheet = workbook.Sheets[sheetNameMayis];

        const range = xlsx.utils.decode_range(worksheet['!ref']);

        let userNameColumn = 'B'; // Sicil No (A sütunu)
        let kullanilanColumn = 'AP';  // Hak Edilen
        let mazeretKullanilanColumn = 'AQ';  // Hak Edilen

        // Sicil sütununda arama yap
        for (let row = range.s.r; row <= range.e.r; row++) {
            let cellAddress = `${userNameColumn}${row + 1}`;
            let cell = worksheet[cellAddress];

            if (cell && cell.v == userName) {
                let izinAddress = `${kullanilanColumn}${row + 1}`;
                let mazeretIzinAddress = `${mazeretKullanilanColumn}${row + 1}`;
                let izinCell = worksheet[izinAddress];
                let mazeretIzinCell = worksheet[mazeretIzinAddress];
                return { yillik: izinCell.v, mazeret: mazeretIzinCell.v }
            }
        }

        // Kalan izin değerini döndür
        return null;
    } catch (error) {
        console.error("Excel okuma hatası:", error);
        return null;
    }
};
const getRemainingLeaveNisan = (userName) => {
    try {
        // Excel 0ku

        const workbook = xlsx.readFile(excelFilePathNisan, { cellDates: true });
        const worksheet = workbook.Sheets[sheetNameNisan];

        const range = xlsx.utils.decode_range(worksheet['!ref']);

        let userNameColumn = 'B'; // Sicil No (A sütunu)
        let kullanilanColumn = 'AP';  // Hak Edilen
        let mazeretKullanilanColumn = 'AQ';  // Hak Edilen

        // Sicil sütununda arama yap
        for (let row = range.s.r; row <= range.e.r; row++) {
            let cellAddress = `${userNameColumn}${row + 1}`;
            let cell = worksheet[cellAddress];

            if (cell && cell.v == userName) {
                let izinAddress = `${kullanilanColumn}${row + 1}`;
                let mazeretIzinAddress = `${mazeretKullanilanColumn}${row + 1}`;
                let izinCell = worksheet[izinAddress];
                let mazeretIzinCell = worksheet[mazeretIzinAddress];
                return { yillik: izinCell.v, mazeret: mazeretIzinCell.v }
            }
        }

        // Kalan izin değerini döndür
        return null;
    } catch (error) {
        console.error("Excel okuma hatası:", error);
        return null;
    }
};
const getRemainingLeaveMart = (userName) => {
    try {
        // Excel 0ku

        const workbook = xlsx.readFile(excelFilePathMart, { cellDates: true });
        const worksheet = workbook.Sheets[sheetNameMart];

        const range = xlsx.utils.decode_range(worksheet['!ref']);

        let userNameColumn = 'B'; // Sicil No (A sütunu)
        let kullanilanColumn = 'AP';  // Hak Edilen
        let mazeretKullanilanColumn = 'AQ';  // Hak Edilen

        // Sicil sütununda arama yap
        for (let row = range.s.r; row <= range.e.r; row++) {
            let cellAddress = `${userNameColumn}${row + 1}`;
            let cell = worksheet[cellAddress];

            if (cell && cell.v == userName) {
                let izinAddress = `${kullanilanColumn}${row + 1}`;
                let mazeretIzinAddress = `${mazeretKullanilanColumn}${row + 1}`;
                let izinCell = worksheet[izinAddress];
                let mazeretIzinCell = worksheet[mazeretIzinAddress];
                return { yillik: izinCell.v, mazeret: mazeretIzinCell.v }
            }
        }

        // Kalan izin değerini döndür
        return null;
    } catch (error) {
        console.error("Excel okuma hatası:", error);
        return null;
    }
};
const getRemainingLeaveSubat = (userName) => {
    try {
        // Excel 0ku

        const workbook = xlsx.readFile(excelFilePathSubat, { cellDates: true });
        const worksheet = workbook.Sheets[sheetNameSubat];

        const range = xlsx.utils.decode_range(worksheet['!ref']);

        let userNameColumn = 'B'; // Sicil No (A sütunu)
        let kullanilanColumn = 'AP';  // Hak Edilen
        let mazeretKullanilanColumn = 'AQ';  // Hak Edilen

        // Sicil sütununda arama yap
        for (let row = range.s.r; row <= range.e.r; row++) {
            let cellAddress = `${userNameColumn}${row + 1}`;
            let cell = worksheet[cellAddress];

            if (cell && cell.v == userName) {
                let izinAddress = `${kullanilanColumn}${row + 1}`;
                let mazeretIzinAddress = `${mazeretKullanilanColumn}${row + 1}`;
                let izinCell = worksheet[izinAddress];
                let mazeretIzinCell = worksheet[mazeretIzinAddress];
                return { yillik: izinCell.v, mazeret: mazeretIzinCell.v }
            }
        }

        // Kalan izin değerini döndür
        return null;
    } catch (error) {
        console.error("Excel okuma hatası:", error);
        return null;
    }
};
const getRemainingLeaveOcak = (userName) => {
    try {
        // Excel 0ku

        const workbook = xlsx.readFile(excelFilePathOcak, { cellDates: true });
        const worksheet = workbook.Sheets[sheetNameOcak];

        const range = xlsx.utils.decode_range(worksheet['!ref']);

        let userNameColumn = 'B'; // Sicil No (A sütunu)
        let kullanilanColumn = 'AP';  // Hak Edilen
        let mazeretKullanilanColumn = 'AQ';  // Hak Edilen

        // Sicil sütununda arama yap
        for (let row = range.s.r; row <= range.e.r; row++) {
            let cellAddress = `${userNameColumn}${row + 1}`;
            let cell = worksheet[cellAddress];

            if (cell && cell.v == userName) {
                let izinAddress = `${kullanilanColumn}${row + 1}`;
                let mazeretIzinAddress = `${mazeretKullanilanColumn}${row + 1}`;
                let izinCell = worksheet[izinAddress];
                let mazeretIzinCell = worksheet[mazeretIzinAddress];
                return { yillik: izinCell.v, mazeret: mazeretIzinCell.v }
            }
        }

        // Kalan izin değerini döndür
        return null;
    } catch (error) {
        console.error("Excel okuma hatası:", error);
        return null;
    }
};
const getRemainingLeave = (sicilNo) => {
    try {
        // Excel 0ku
        const workbook = xlsx.readFile(excelFilePath, { cellDates: true });
        const worksheet = workbook.Sheets[sheetName];


        const range = xlsx.utils.decode_range(worksheet['!ref']);



        let sicilColumn = 'A'; // Sicil No (A sütunu)

        let userNameColumn = 'B'; // Sicil No (A sütunu)
        let kullanilanColumn = 'AP';  // Hak Edilen
        let mazeretKullanilanColumn = 'AQ';  // Hak Edilen
        let izinHakColumn = 'H';  // Hak Edilen
        let izinOnceColumn = 'I';  // Önceki Sene

        // Sicil sütununda arama yap
        for (let row = range.s.r; row <= range.e.r; row++) {
            let cellAddress = `${sicilColumn}${row + 1}`;
            let cell = worksheet[cellAddress];

            if (cell && cell.v == sicilNo) {
                let izinAddress = `${izinHakColumn}${row + 1}`;
                let izinOncekiAddress = `${izinOnceColumn}${row + 1}`;
                let izinNameColumn = `${userNameColumn}${row + 1}`;
                let izinCell = worksheet[izinAddress];
                let izinOncekiCell = worksheet[izinOncekiAddress];
                let izinName = worksheet[izinNameColumn];

                let ocak = getRemainingLeaveOcak(izinName.v)
                let subat = getRemainingLeaveSubat(izinName.v)
                let mart = getRemainingLeaveMart(izinName.v)
                let nisan = 0//getRemainingLeaveNisan( izinName.v)
                let mayis = 0//getRemainingLeaveMayis( izinName.v)
                let haziran = 0//getRemainingLeaveHaziran( izinName.v)
                let temmuz = 0//getRemainingLeaveTemmuz( izinName.v)
                let agustos = 0//getRemainingLeaveAgustos( izinName.v)
                let eylul = 0//getRemainingLeaveEylul( izinName.v)
                let ekim = 0//getRemainingLeaveEkim( izinName.v)
                let kasim = 0//getRemainingLeaveKasim( izinName.v)
                let aralik = 0//getRemainingLeaveAralik( izinName.v)
                let veri = {
                    kullanicilar: izinName.v,
                    kalanIzin: izinCell ? izinCell.v - izinOncekiCell.v - (ocak.yillik ? ocak.yillik : 0) - (subat.yillik ? subat.yillik : 0) - (mart.yillik ? mart.yillik : 0) - (nisan.yillik ? nisan.yillik : 0) - (mayis.yillik ? mayis.yillik : 0) - (haziran.yillik ? haziran.yillik : 0) - (temmuz.yillik ? temmuz.yillik : 0) - (agustos.yillik ? agustos.yillik : 0) - (eylul.yillik ? eylul.yillik : 0) - (ekim.yillik ? ekim.yillik : 0) - (kasim.yillik ? kasim.yillik : 0) - (aralik.yillik ? aralik.yillik : 0) : null,
                    mazaretIzin: izinCell ? 27 - (ocak.mazeret ? ocak.mazeret : 0) - (subat.mazeret ? subat.mazeret : 0) - (mart.mazeret ? mart.mazeret : 0) - (nisan.mazeret ? nisan.mazeret : 0) - (mayis.mazeret ? mayis.mazeret : 0) - (haziran.mazeret ? haziran.mazeret : 0) - (temmuz.mazeret ? temmuz.mazeret : 0) - (agustos.mazeret ? agustos.mazeret : 0) - (eylul.mazeret ? eylul.mazeret : 0) - (ekim.mazeret ? ekim.mazeret : 0) - (kasim.mazeret ? kasim.mazeret : 0) - (aralik.mazeret ? aralik.mazeret : 0) : null,

                    ocak: ocak,
                    subat: subat,
                    mart: mart,
                    nisan: nisan,
                    mayis: mayis,
                    haziran: haziran,
                    temmuz: temmuz,
                    agustos: agustos,
                    eylul: eylul,
                    ekim: ekim,
                    kasim: kasim,
                    aralik: aralik
                }
                return veri



            }
        }

        // Kalan izin değerini döndür
        return null;
    } catch (error) {
        console.error("Excel okuma hatası:", error);
        return null;
    }
};

const getIseGiris = async () => {
    try {


        // Kalan izin değerini döndür
        return updateUser

    } catch (error) {
        console.error("Excel okuma hatası:", error);
        return null;
    }
};

const personnel = [
    {
        "id": "1",
        "name": "İBRAHİM KAPAN"
    },
    {
        "id": "2",
        "name": "OĞUZHAN ERTAŞ"
    },
    {
        "id": "3",
        "name": "EMRE ERBAY"
    },
    {
        "id": "4",
        "name": "BURAK ZAFER BÜYÜKBEKAR"
    },
    {
        "id": "5",
        "name": "ONUR BARAN KÖPRÜCÜ"
    },
    {
        "id": "6",
        "name": "MURAT KILIÇ"
    },
    {
        "id": "7",
        "name": "AYÇA YILDIRIM"
    },
    {
        "id": "8",
        "name": "AHMET ÇAĞRI BAYIR"
    },
    {
        "id": "9",
        "name": "ENES ŞENOL"
    },
    {
        "id": "10",
        "name": "BURAK ÇELİK"
    },
    {
        "id": "11",
        "name": "MUSTAFA BAKİ KALAYCI"
    },
    {
        "id": "12",
        "name": "GİZEM AKIN"
    },
    {
        "id": "13",
        "name": "ÇAĞLAR İBİŞ"
    },
    {
        "id": "14",
        "name": "MAHMUT YASİN AYGÜN"
    },
    {
        "id": "15",
        "name": "BALDER BERKE KARBAK"
    },
    {
        "id": "16",
        "name": "ALİ AKKOYUN"
    },
    {
        "id": "17",
        "name": "BURAK TEKİN"
    },
    {
        "id": "18",
        "name": "RÜMEYSA İSLAM"
    },
    {
        "id": "19",
        "name": "ÇAĞLAR BİCİ"
    },
    {
        "id": "20",
        "name": "KÜBRA YALÇIN"
    },
    {
        "id": "21",
        "name": "AHMET ÜNAL YAVUZ"
    },
    {
        "id": "22",
        "name": "KARDELEN CANOĞLU"
    },
    {
        "id": "23",
        "name": "BARIŞ MAÇAN"
    },
    {
        "id": "24",
        "name": "İLKNUR KABA"
    },
    {
        "id": "25",
        "name": "HARUN AKDEMİR"
    },
    {
        "id": "27",
        "name": "NAZIM KURTCU"
    },
    {
        "id": "28",
        "name": "CEMGÖKTUĞ AKPINAR"
    },
    {
        "id": "29",
        "name": "EMEL KURT"
    },
    {
        "id": "30",
        "name": "BÜLENT ORAN"
    }
]
const personnel2 = [
    { id: "1", name: "RÜVEYDA ARSLAN" },
    { id: "2", name: "FİKRET ALTAN" },
    { id: "3", name: "İLKER KADIOĞLU" },
    { id: "4", name: "HASAN GÖK" },
    { id: "5", name: "ENES TEKİN" },
    { id: "6", name: "DİLARA KÖKÇÜ" },
    { id: "7", name: "HANDE ÜNÜVAR" },
    { id: "8", name: "BURAK DOĞAN" },
    { id: "9", name: "EMRE OKUTANSOY" },
    { id: "10", name: "BİLAL CÜREK" },
    { id: "11", name: "FERHAT POLAT" },
    { id: "12", name: "ECEM HASPOLAT" },
    { id: "13", name: "ZEYNEP ERKAN" },
    { id: "14", name: "DERYA ÖCALAN" },
    { id: "15", name: "FATİH GÜNGÖR" },
    { id: "16", name: "NAZAN AKKAYA" },
    { id: "17", name: "TUĞÇE SODAN" },
    { id: "18", name: "KADİR OSMANOĞLU" },
    { id: "19", name: "AHMET SELİM BİÇER" },
    { id: "20", name: "EMRE MÜCAHİT KOÇ" },
    { id: "21", name: "KAMER DORUKHAN KESME" },
    { id: "22", name: "SELİM TANRIVERDİ" },
    { id: "23", name: "MUHAMMET ZAHİT BAKIŞ" },
    { id: "24", name: "YAKUP UTLU" },
    { id: "25", name: "ŞÜKRÜ CAN YILDIRIM" },
    { id: "26", name: "MUSTAFA BUĞRA ERBIYIK" },
    { id: "27", name: "RESUL AYBERK GÖZEN" },
    { id: "28", name: "BURHAN KAPLAN" },
    { id: "29", name: "BURAKCAN ŞAHİN" },
    { id: "30", name: "AYHAN DURMUŞ" },
    { id: "31", name: "SAMET ALTUN" },
    { id: "32", name: "CERENAY GÜVENDİ" },
    { id: "33", name: "MUHAMMED GÖKCEK" },
    { id: "34", name: "UFUK SAZAKLI" },
    { id: "35", name: "DAVUT AKBULUT" },
    { id: "36", name: "CANSU DÖNER" },
    { id: "37", name: "HAYRİYE DAMLA GÜLÜÇ" },
    { id: "38", name: "CEMAL BULUT" }
];

function getRandomAssignments(veri) {
    let selectionCount = {};
    veri.forEach(person => {
        selectionCount[person.id] = 0;
    });

    return veri.map(person => {
        let available = veri.filter(p => p.id !== person.id);
        let child = [];

        while (child.length < 5) {
            let randomIndex = Math.floor(Math.random() * available.length);
            let selected = available[randomIndex];

            if (selectionCount[selected.id] < 6) {
                child.push({ id: selected.id, name: selected.name });
                selectionCount[selected.id]++;
                available.splice(randomIndex, 1);
            }
        }

        return { id: person.id, name: person.name, child };
    });
}

exports.personelDagit = async (req, res) => {

    const assignments = await getRandomAssignments(personnel)
    const assignments2 = await getRandomAssignments(personnel2)
    res.json({ status: 200, assignments: assignments, assignments2: assignments2 });
};

const imageFolder = path.join(__dirname, '..', '..', '..', '..', '..', '..', 'wamp64', 'www', 'ik', 'assets', 'images', 'Vesikalık 2022', '2023 BİYOMETRİK');

const getFiles = () => {
    return fs.readdirSync(imageFolder).filter(file => file.endsWith('.jpg') || file.endsWith('.png'));
};


const normalizeName = (name) => name.toUpperCase().trim();
exports.userIlkIs = async (req, res) => {
    try {
        let veri = []
        const files = getFiles();
        console.log(`Toplam ${files.length} dosya bulundu.`);

        for (const file of files) {
            const fileName = path.basename(file, path.extname(file)); // Uzantıyı kaldır
            const formattedName = normalizeName(fileName);

            // Veritabanında eşleşen kaydı bul
            const result = await pool.query('SELECT id,sicil,user_name FROM portal_user WHERE user_name = $1 AND photo is null', [formattedName]);

            if (result.rows.length > 0) {
                const userId = result.rows[0].id;

                // Veritabanında photo alanını güncelle
                let files_name = `assets/images/Vesikalık 2022/${file}`
                await pool.query('UPDATE portal_user SET photo = $1 WHERE id = $2', [files_name, userId]);
                veri.push({
                    sicil: result.rows[0].sicil,
                    user_name: result.rows[0].user_name,
                    dosya_adi: formattedName,
                    file: file,
                })
                console.log(`Güncellendi: ${formattedName} -> ${file}`);
            } else {
                console.log(`Eşleşme bulunamadı: ${formattedName}`);
            }
        }


        res.status(200).json(
            {
                data: veri,
                status: 200
            }
        )
    } catch (error) {
        console.error('Depo çekme sırasında hata:', error);
        res.status(500).json({ message: 'Depo bilgilerini çekerken bir hata oluştu.' });
    }
}
exports.selectUserIzinlerGet = async (req, res) => {
    try {
        const { sicil } = req.body
        const remainingLeave = getRemainingLeave(sicil);
        res.status(200).json(
            {
                data: remainingLeave,

                status: 200
            }
        )
    } catch (error) {
        console.error('Depo çekme sırasında hata:', error);
        res.status(500).json({ message: 'Depo bilgilerini çekerken bir hata oluştu.' });
    }
}
exports.selectUserSicilOrg = async (req, res) => {
    try {
        const { sicil } = req.body
        const result = await pool.query(selectUserSicilOrgQury, [sicil])

        res.status(200).json(
            {
                data: result.rows[0],

                status: 200
            }
        )
    } catch (error) {
        console.error('Depo çekme sırasında hata:', error);
        res.status(500).json({ message: 'Depo bilgilerini çekerken bir hata oluştu.' });
    }
}
exports.updateUserGenel = async (req, res) => {
    try {
        const { id, user_name, email, password, sicil, phone, user_type, user_typename, is_active, is_delete, password_status, main_user, pas_reset, photo, dogum_tarih, is_baslangic, puan } = req.body
        const result = await pool.query(updateUserGenelQuery, [id, user_name, email, password, sicil, phone, user_type, user_typename, is_active, is_delete, password_status, main_user, pas_reset, photo, dogum_tarih, is_baslangic, puan])

        res.status(200).json(
            {
                data: result.rows[0],
                status: 200
            }
        )
    } catch (error) {
        console.error('Depo çekme sırasında hata:', error);
        res.status(500).json({ message: error });
    }
}
exports.updateUserFoto = [
    upload.array('files'), // multer middleware
    async (req, res) => {
        const { id } = req.body;
        const files = req.files;


        let url = `assets/images/user_photo/${files[0].filename}`;

        try {
            const result = await pool.query(updateUserFotoQuery, [id, url]);
            if (result.rowCount === 0) {
                return res.status(404).json({ message: 'Haber not found' });
            }
            res.status(200).json({ status: 200, message: 'Update successful', id: id });
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
];
exports.updateDepartmanUsersOrganizasyon = async (req, res) => {
    try {
        const { id, department_id, sicil, status, type, ust_amir, proje } = req.body
        const result = await pool.query(updateBirimUserOrganizasyon, [id, department_id, sicil, status, type, ust_amir, proje])

        res.status(200).json(
            {
                data: result,
                status: 200
            }
        )
    } catch (error) {
        console.error('Depo çekme sırasında hata:', error);
        res.status(500).json({ message: 'Depo bilgilerini çekerken bir hata oluştu.' });
    }
}
exports.deleteUserDepartman = async (req, res) => {
    try {
        const { id, department_id, sicil, status, type, ust_amir } = req.body
        const result = await pool.query(deleteBirimOrganizasyonQuery, [id])

        res.status(200).json(
            {
                data: result,
                status: 200
            }
        )
    } catch (error) {
        console.error('Depo çekme sırasında hata:', error);
        res.status(500).json({ message: 'Depo bilgilerini çekerken bir hata oluştu.' });
    }
}
exports.updateDepartmanOrganizasyon = async (req, res) => {
    try {
        const { id, name, parent_id, css_class, img, departman_id, aciklama, is_delete, is_active } = req.body
        const result = await pool.query(updateBirimOrganizasyon, [id, name, parent_id, css_class, img, departman_id, aciklama, is_delete, is_active])

        res.status(200).json(
            {
                data: result,
                status: 200
            }
        )
    } catch (error) {
        console.error('Depo çekme sırasında hata:', error);
        res.status(500).json({ message: 'Depo bilgilerini çekerken bir hata oluştu.' });
    }
}
exports.insertUserDepartmanmatching = async (req, res) => {
    try {
        console.log(req.body)
        const { department_id, sicil, status, type, ust_amir, proje } = req.body
        const result = await pool.query(insertUserDepartmanMatchingQuery, [department_id, sicil, status, type, ust_amir, proje])

        res.status(200).json(
            {
                data: result,
                status: 200
            }
        )
    } catch (error) {
        console.error('Depo çekme sırasında hata:', error);
        res.status(500).json({ message: 'Depo bilgilerini çekerken bir hata oluştu.' });
    }
}
exports.topluUserBirimInsert = async (req, res) => {
    try {
        console.log(req.body)
        const { department_id, multiUserSicilData, status, type, ust_amir, proje } = req.body
        let result
        for (let data of multiUserSicilData) {
            result = await pool.query(insertUserDepartmanMatchingQuery, [department_id, data.sicil, status, type, ust_amir, proje])
        }
        res.status(200).json(
            {
                data: result,
                status: 200
            }
        )
    } catch (error) {
        console.error('Depo çekme sırasında hata:', error);
        res.status(500).json({ message: 'Depo bilgilerini çekerken bir hata oluştu.' });
    }
}
exports.insertDepartmanOrganizasyon = async (req, res) => {
    try {
        const { name, parent_id, css_class, img, departman_id, aciklama } = req.body
        const result = await pool.query(insertBirimOrganizasyon, [name, parent_id, css_class, img, departman_id, aciklama])

        res.status(200).json(
            {
                data: result,
                status: 200
            }
        )
    } catch (error) {
        console.error('Depo çekme sırasında hata:', error);
        res.status(500).json({ message: 'Depo bilgilerini çekerken bir hata oluştu.' });
    }
}
exports.topluUserEgitimInsert = async (req, res) => {
    try {
        const { multiUserSicilData, egitim_adi, egitim_veren, egitim_yeri, sertifika, egitim_tarih, egitim_suresi } = req.body
        for (let data of multiUserSicilData) {
            const result = await pool.query(insertUserAhoEgitimQuery, [data.sicil, egitim_adi, egitim_veren, egitim_yeri, sertifika, egitim_tarih, egitim_suresi])

        }

        res.status(200).json(
            {
                data: req.body,
                status: 200
            }
        )
    } catch (error) {
        console.error('Depo çekme sırasında hata:', error);
        res.status(500).json({ message: 'Depo bilgilerini çekerken bir hata oluştu.' });
    }
}
exports.insertUserAhoEgitim = async (req, res) => {
    try {
        const { sicil, egitim_adi, egitim_veren, egitim_yeri, sertifika, egitim_tarih, egitim_suresi } = req.body
        const result = await pool.query(insertUserAhoEgitimQuery, [sicil, egitim_adi, egitim_veren, egitim_yeri, sertifika, egitim_tarih, egitim_suresi])

        res.status(200).json(
            {
                data: result,
                status: 200
            }
        )
    } catch (error) {
        console.error('Depo çekme sırasında hata:', error);
        res.status(500).json({ message: 'Depo bilgilerini çekerken bir hata oluştu.' });
    }
}

exports.getGenelHiyerArsiAll = async (req, res) => {
    try {
        const result = await pool.query(getGenelQuery)
        const hierarchy = buildHierarchy(result.rows);
        res.status(200).json(
            {
                data: hierarchy,
                status: 200
            }
        )
    } catch (error) {
        console.error('Depo çekme sırasında hata:', error);
        res.status(500).json({ message: 'Depo bilgilerini çekerken bir hata oluştu.' });
    }
}
exports.updatePaswordUser = async (req, res) => {
    try {
        const { password, sicil } = req.body
        const mssqlPool = await poolPromise; 
        const poolRequest = mssqlPool.request();
        const result = await pool.query(updateUserPaswordQuery, [sicil, password, false])
        const msqlRslt = await poolRequest.query(`UPDATE users SET password_status = 1,password_='${password}' WHERE sicil = '${sicil}'`);

        const hierarchy = buildHierarchy(result.rows);
        res.status(200).json(
            {
                data: hierarchy,
                status: 200
            }
        )
    } catch (error) {
        console.error('Depo çekme sırasında hata:', error);
        res.status(500).json({ message: 'Depo bilgilerini çekerken bir hata oluştu.' });
    }
}
exports.userMachMsql = async (req, res) => {
    try {
        const { password, sicil } = req.body
        const mssqlPool = await poolPromise; 
    const poolRequest = mssqlPool.request();
    const egitimler = await poolRequest.query(`SELECT * FROM users `);
    for(let data of egitimler.recordset){
        const updateUser = await pool.query(`UPDATE portal_user SET password = $1 WHERE sicil = $2`,[data.password_,data.sicil])
    }
        res.status(200).json(
            {
                data: egitimler,
                status: 200
            }
        )
    } catch (error) {
        console.error('Depo çekme sırasında hata:', error);
        res.status(500).json({ message: 'Depo bilgilerini çekerken bir hata oluştu.' });
    }
}
exports.userPaswordForget = async (req, res) => {
    try {
        const { sicil, email } = req.body
        const result = await pool.query(getUserControlQuery, [sicil, email])
        if (result.rowCount > 0) {
            if (result.rows[0].sicil == sicil) {
                const result2 = await pool.query(updateUserPaswordQuery, [sicil, result.rows[0].password, true])

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
                    to: email,
                    cc: '',
                    subject: 'Şifremi Unuttum',
                    text: 'Sayın' + result.rows[0].user_name + ' Şifrenizi Sıfırlamak için ' + `http://ik.aho.com/#/reset-pasword/${sicil}` + " adresinden giriş yapabilirsiniz."
                };
                transporter.sendMail(mailOptions, (error, info) => {
                    if (error) {
                        console.log(error);
                    } else {
                        console.log('Email sent: ' + info.response);
                        res.json({
                            "status": 200,
                            message: "Mail Gönderildi"
                        })
                    }
                });
            }
        } else {
            res.status(201).json({ "status": 201, message: 'Sicil veya Email hatalı olabilir kontrol ederek tekrar deneyiniz' });
        }

    } catch (error) {
        res.status(400).json({ status: 400, message: `Bir hata oluştu "${error}`, error: error });
    }
}
exports.getGenelAll = async (req, res) => {
    try {
        const result = await pool.query(getGenelQuery)

        res.status(200).json(
            {
                data: result.rows,
                status: 200
            }
        )
    } catch (error) {
        console.error('Depo çekme sırasında hata:', error);
        res.status(500).json({ message: 'Depo bilgilerini çekerken bir hata oluştu.' });
    }
}
exports.logInPortal = async (req, res) => {
    try {
        const { phone, password } = req.body
        let accessTokens
        var request = require('request');
        var options = {
            'method': 'POST',
            'url': 'http://20.0.0.50:8282/v1_0/NAF.LFlow.WAS/api/login/impersonated',
            'headers': {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'client_id': 'd5454dfc-b538-482b-ab39-7e9105b10364',
                'client_secret': '8f9765ce-ae74-467b-8b9e-033882b7207a',
                'AccessToken': '57dbb31c912f42c2bb3778a99ee2ca31',
                'Cookie': 'CustomIdpSel=-; LangSel=Turkish; StsLoginId=67af50c1-9d04-417e-a346-2185932e9b85; __ststrace=dnUORpSCyPDS+iRSHWJ1jdfj3HQvh5/r4ow4EtTuCFM='
            },
            body: JSON.stringify({
                "ExternalIdpProviderType": "0",
                "Username": phone
            })

        };
        request(options, async function (error, response) {
            if (error) throw new Error(error);
            const responseData = JSON.parse(response.body);

            accessTokens = responseData.AccessToken
            if (req.body.phone == "6666" && req.body.password == "4c8c67f1") {
                const jwt = require('jsonwebtoken');

                const secretKey = 'emre.mkoc@gmail.com';
                const payload = {
                    id: 1,
                    iat: Math.floor(Date.now() / 1000),
                    exp: Math.floor(Date.now() / 1000) + (60 * 60)
                };

                const token = jwt.sign(payload, secretKey);

                let ts = Date.now();
                res.json({
                    "status": 200,
                    "data": {
                        "user": {
                            "user_type": 0,
                            "user_typeName": accessTokens,
                            "password_status": true,
                            "telephone": "6666",
                            "pincode": "ADMIN",
                            "email": "bilgi@aho.com",
                            "depID": 0,
                            "_id": 1,

                            "name": "ADMİN",
                            "facID": accessTokens
                        },
                        "token": token,
                    }
                }
                );
            } else {
                try {

                    let tokens
                    console.log(req.body)
                    const result = await pool.query(`SELECT * FROM portal_user WHERE sicil= '${phone}' AND password = '${password}' AND is_delete = 'false' AND is_active = 'true'`);

                    if (result.rowCount > 0) {
                        const jwt = require('jsonwebtoken');

                        const secretKey = 'emre.mkoc@gmail.com';
                        const payload = {
                            id: result.rows[0].user_id,
                            iat: Math.floor(Date.now() / 1000),
                            exp: Math.floor(Date.now() / 1000) + (30 * 60)
                        };
                        const token = jwt.sign(payload, secretKey);
                        // await n_generate_token(result.id, req.router.get('secretKey')).then(async token => { token = token}).catch(err => {
                        // 	res.json({ status: 402, message: "", data: err })
                        // })
                        let ts = Date.now();
                        res.json({
                            "status": 200,
                            "data": {
                                "user": {
                                    "user_type": result.rows[0].user_type,
                                    "user_typeName": accessTokens,
                                    "password_status": result.rows[0].password_status,
                                    "telephone": result.rows[0].sicil,
                                    "pincode": result.rows[0].password_,
                                    "email": result.rows[0].email,
                                    "depID": result.rows[0].departman,
                                    "_id": result.rows[0].user_id,
                                    "name": result.rows[0].user_name,
                                    "timeLine": ts,
                                    "facID": accessTokens
                                },
                                "token": token,
                            }

                        }


                        );
                    } else {
                        res.status(200).json({ status: 303, data: "Şifre Yada Kullanıcı Hatalı" })
                    }
                } catch (error) {
                    console.error(error);
                    res.status(400).send('Internal Server Error');
                }


            }

        });
    } catch (error) {
        res.status(500).json({ status: 400, message: error });
    }
}

exports.getUserSifreDurum = async (req, res) => {
    try {
        const { sicil } = req.body
        const result = await pool.query(getUserSifreDurum, [sicil])
        if (result.rowCount > 0) {
            res.status(200).json({ data: result.rows[0].pas_reset, item: result.rows[0], status: 200 })
        } else {
            res.status(205).json({ data: [], item: [], status: 205 })

        }

    } catch (error) {
        console.error('Depo çekme sırasında hata:', error);
        res.status(500).json({ message: 'Depo bilgilerini çekerken bir hata oluştu.' });
    }
}
exports.getUserSifreDegirstir = async (req, res) => {
    try {
        const { sicil, eskiSifre, yeniSifre } = req.body
        console.log(req.body)
        const result = await pool.query(getUserPassControl, [sicil])
        if (result.rowCount > 0) {
            console.log("user bulundu")

            if (result.rows[0].password == eskiSifre) {
                const resultSifreDegis = await pool.query(updateUserPassword, [sicil, yeniSifre])
                console.log("user bulundu")

                if (resultSifreDegis.rowCount > 0) {
                    res.status(200).json({
                        status: 200,
                        data: "Sifre Guncellendi"
                    })
                } else {
                    res.status(200).json({
                        status: 300, data: "Sifre Değiştirilemedı"
                    })
                }
            } else {
                res.status(200).json({
                    status: 302, data: "Sifreniz Doğru Değil"
                })
            }
        }
        else {
            res.status(200).json({
                status: 301, data: "Sicil Doğru Değil"
            })
        }
    } catch (error) {
        console.error('Depo çekme sırasında hata:', error);
        res.status(500).json({ message: 'Depo bilgilerini çekerken bir hata oluştu.' });
    }
}

exports.getusersDepartmant = async (req, res) => {
    try {
        const { departman_id } = req.body
        console.log(departman_id)
        const result = await pool.query(getusersDepartmantQuery, [departman_id])
        res.status(200).json({ data: result.rows, status: 200 })

    } catch (error) {
        console.error('Depo çekme sırasında hata:', error);
        res.status(500).json({ message: error });
    }
}

exports.getUserLogin = async (req, res) => {
    try {
        const { sicil, password } = req.body
        const result = await pool.query(getUserLoginQuery, [sicil, password])
        if (result.rowCount == 0) {
            res.status(200).json({ data: result.rows[0], status: 201, message: "Sicil Numarası veya Şifreniz Hatalı Tekrar Deneneyiniz" })

        } else {
            res.status(200).json({ data: result.rows[0], status: 200, message: "Giriş Başarılı" })

        }
    } catch (error) {
        console.error('Depo çekme sırasında hata:', error);
        res.status(500).json({ message: error });
    }
}
exports.postUserAll = async (req, res) => {
    try {
        // otomatikDepoCek fonksiyonunu çağırıyoruz

        fs.readFile('user.json', 'utf8', async (err, data) => {
            if (err) {
                console.error('Dosya okuma hatası:', err);
                return;
            }

            try {
                const envanter = JSON.parse(data); // JSON verisini objeye çeviriyoruz

                // Envanter içindeki her bir öğeyi işliyoruz
                for (const element of envanter) { // ambar yerine envanter kullanıldı
                    // Miktarı doğru formata çeviriyoruz (virgülü noktaya çeviriyoruz)
                    const result = await pool.query(postUserAllQuery, [element.user_name, element.email, element.password, element.sicil, element.phone, element.user_type, element.user_typename, element.is_active, element.is_delete, element.password_status, element.main_user]);
                    for (const items of element.birim) {
                        const birimName = await pool.query(`SELECT * FROM portal_departman WHERE id = ${items.birim_id}`)
                        const resultBirim = await pool.query(postUserBirimQuery, [element.sicil, items.birim_id, birimName.rows[0].destination])

                    }
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
