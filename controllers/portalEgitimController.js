
const pool = require('../db');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
// const { sql, poolPromise } = require('../../msPortalDb'); // MSSQL yapılandırması
const { sql, poolPromise } = require('./../msPortalDB');
const transliteration = require('transliteration');
const multer = require('multer');
const req = require('express/lib/request');
const { log } = require('console');
const taskDokuman = multer.diskStorage({




  destination: (req, file, callBack) => {
    const destinationPath = path.join(__dirname, '..', '..', '..', '..', '..', '..', 'wamp64', 'www', 'assets', 'images', 'egitim');
    //const destinationPath = path.join(__dirname, '..', 'front end', 'front end', 'src', 'assets', 'docs');
    callBack(null, destinationPath)
  },

  filename: (req, file, callBack) => {
    const bugun = new Date();
    const tarihDamgasi = bugun.toISOString().replace(/[:.]/g, '').substring(0, 10); // Sadece '2023-08-25' bölümü
    const originalnameWithoutExtension = path.parse(file.originalname).name;
    const transliteratedName = transliteration.slugify(originalnameWithoutExtension, { lowercase: false });
    callBack(null, `egitim_${tarihDamgasi}${transliteratedName}_${path.extname(file.originalname)}`);

  }

})




exports.orgunEgitimSearch = async (req, res) => {
  try {

    const { user_name, bolum, okul_adi } = req.body
    let userQuery = ''
    let bolumQuery = ''
    let okulAdiQuery = ''
    if (user_name) {
      userQuery = `AND pu.user_name like '%${user_name}%' `

    }
    if (bolum) {
      bolumQuery = `AND pue1.bolum like '%${bolum}%'`
    }
    if (okul_adi) {
      okulAdiQuery = `AND pue1.okul_adi like '%${okul_adi}%'`
    }

    console.log(`SELECT 
     *
	FROM portal_user_egitim pue1 INNER JOIN portal_user pu ON pu.sicil=pue1.sicil
	${userQuery}
	WHERE pue1.tur_aciklama is not null
	${bolumQuery}
	${okulAdiQuery}
	`)
    const videoEgitimCount = await pool.query(`SELECT 
     *
	FROM portal_user_egitim pue1 INNER JOIN portal_user pu ON pu.sicil=pue1.sicil
	${userQuery}
	WHERE pue1.tur_aciklama is not null
	${bolumQuery}
	${okulAdiQuery}
	`)


    res.status(200).json({ status: 200, data: videoEgitimCount.rows });
  } catch (error) {
    console.error('Aktarım hatası:', error);
    res.status(500).json({ status: 500, error: error.message });
  }
};
exports.tumEgitimlerRaporSicil = async (req, res) => {
  try {

    const { tarih, sicil, user_name, egitim_tur, egitim_name } = req.body
    const videoEgitimCount = await pool.query(`SELECT 
	pue.okul_adi,
	pue.bolum,
	pue.tur_aciklama,
	pu.sicil,
	pu.user_name,
	'' as egitim_adi,
	'' as egitim_veren,
	null as egitim_tarih,
	'' as egitim_suresi,
	'' as name,
	CAST(null AS INTEGER) as status,
	null::BOOLEAN as is_end,
	null::DOUBLE PRECISION as video_time,
	null::DOUBLE PRECISION as read_time,
	'okul_bilgisi' as kaynak
FROM portal_user_egitim pue 
INNER JOIN portal_user pu ON pu.sicil = pue.sicil AND pu.sicil = ${sicil}

UNION ALL

SELECT 
	'' as okul_adi,
	'' as bolum,
	'' as tur_aciklama,
	pu.sicil,
	pu.user_name,
	puea.egitim_adi,
	puea.egitim_veren,
	puea.egitim_tarih,
	puea.egitim_suresi,
	'' as name,
	CAST(null AS INTEGER) as status,
	null::BOOLEAN as is_end,
	null::DOUBLE PRECISION as video_time,
	null::DOUBLE PRECISION as read_time,
	'klasik_egitim' as kaynak
FROM portal_user_egitim_aho puea
INNER JOIN portal_user pu ON puea.sicil = pu.sicil AND pu.sicil = ${sicil}
UNION ALL

SELECT 
	'' as okul_adi,
	'' as bolum,
	'' as tur_aciklama,
	pu.sicil,
	pu.user_name,
	'' as egitim_adi,
	'' as egitim_veren,
	null as egitim_tarih,
	'' as egitim_suresi,
	pev.name,
	puea.status,
	puea.is_end,
	puea.video_time,
	puea.read_time,
	'video_egitim' as kaynak
FROM portal_egitim_user puea
INNER JOIN portal_user pu ON puea.user_id = pu.sicil AND pu.sicil = ${sicil}
INNER JOIN portal_egitim_video pev ON pev.id = puea.video_id

`)
    res.status(200).json({ status: 200, data: videoEgitimCount.rows });
  } catch (error) {
    console.error('Aktarım hatası:', error);
    res.status(500).json({ status: 500, error: error.message });
  }
};
exports.videoListGet = async (req, res) => {
  try {

    const videoEgitimCount = await pool.query(`SELECT pev.*,pef.file_uzunluk FROM portal_egitim_video pev INNER JOIN portal_egitim_files pef ON pef.connected_id = pev.id `)
    res.status(200).json({ status: 200, data: videoEgitimCount.rows });
  } catch (error) {
    console.error('Aktarım hatası:', error);
    res.status(500).json({ status: 500, error: error.message });
  }
};
exports.videoListTopluInsert = async (req, res) => {
  try {
    const {user_id,
      video_id,
      created_date,
      update_date,
      status,
      is_end,
      video_time,
      read_time,
      egitim_id} = req.body
      for(let s of user_id){
          const userVarmi=await pool.query(`SELECT *FROM portal_egitim_user WHERE egitim_id = $1 AND video_id= $2 AND user_id = $3`,[egitim_id,video_id,s] )
          if(userVarmi.rowCount==0){
            const insertUserVideo = await pool.query(`INSERT INTO portal_egitim_user (user_id, video_id, created_date, update_date, status, is_end, video_time, read_time, egitim_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[s, video_id, created_date, update_date, status, is_end, video_time, read_time, egitim_id])
          }else{
            const updateUserVideo= await pool.query(`UPDATE portal_egitim_user SET update_date=$1 , video_time=$2,read_time=$3 WHERE id=$4`,[update_date,video_time,read_time,userVarmi.rows[0].id])
          }
      }
    res.status(200).json({ status: 200, data: req.body });
  } catch (error) {
    console.error('Aktarım hatası:', error);
    res.status(500).json({ status: 500, error: error.message });
  }
};
exports.ahoEgitimRapor = async (req, res) => {
  try {

    const { tarih, sicil, user_name, egitim_tur, egitim_name } = req.body
    const videoEgitimCount = await pool.query(`SELECT 
                                              puea2.egitim_adi AS name,
                                              json_agg(
                                                
                                                      (
                                                          SELECT row_to_json(pu)
                                                          FROM portal_user pu 
                                                          WHERE pu.sicil = puea2.sicil
                                                          LIMIT 1)
                                              ) AS user
                                          FROM 
                                              portal_user_egitim_aho puea2
                                          GROUP BY 
                                              puea2.egitim_adi; `)
    res.status(200).json({ status: 200, data: videoEgitimCount.rows });
  } catch (error) {
    console.error('Aktarım hatası:', error);
    res.status(500).json({ status: 500, error: error.message });
  }
};
exports.videoEgitimRapor = async (req, res) => {
  try {

    const { tarih, sicil, user_name, egitim_tur, egitim_name } = req.body
    const videoEgitimCount = await pool.query(`SELECT video.* , 
      (SELECT json_agg(datas) FROM 
      (SELECT * FROM portal_egitim_user eu 
      INNER JOIN portal_user pu ON pu.sicil = eu.user_id WHERE video.id = eu.video_id  )datas) user 
      FROM portal_egitim_video as video WHERE is_deleted = false AND is_active= true`)
    res.status(200).json({ status: 200, data: videoEgitimCount.rows });
  } catch (error) {
    console.error('Aktarım hatası:', error);
    res.status(500).json({ status: 500, error: error.message });
  }
};
exports.tumEgitimlerRapor = async (req, res) => {
  try {
    const { tarih, sicil, user_name, egitim_tur, egitim_name } = req.body
    const orgunEgitimCount = await pool.query(`SELECT 
       pue1.tur_aciklama as name,COUNT(pue1.tur_aciklama) as count,
       (SELECT json_agg(datas) FROM 
      (SELECT * FROM portal_user_egitim pue INNER JOIN portal_user pu ON pu.sicil= pue.sicil WHERE pue.tur_aciklama =pue1.tur_aciklama)datas) user
	FROM portal_user_egitim pue1 where pue1.tur_aciklama is not null 
  GROUP BY pue1.tur_aciklama`)
    const ahoEgitimCount = await pool.query(`SELECT COUNT(*) as count FROM(SELECT COUNT(egitim_adi)
	FROM public.portal_user_egitim_aho
GROUP BY egitim_adi,egitim_veren,sertifika,egitim_tarih,egitim_suresi) datas`)
    const videoEgitimCount = await pool.query(`SELECT COUNT(id) as count FROM portal_egitim_video `)
    const videoEgitimSuresi = await pool.query(`SELECT SUM(sum) as count FROM (SELECT SUM(files.file_uzunluk) FROM portal_egitim_video video INNER JOIN portal_egitim_files files ON video.id=files.connected_id WHERE video.is_deleted = false AND video.is_active = true
GROUP BY files.connected_id) datas`)
    let data = {
      orgun: orgunEgitimCount.rows,
      aho: ahoEgitimCount.rows[0],
      videoCount: videoEgitimCount.rows[0],
      videoSure: videoEgitimSuresi.rows[0]
    }
    res.status(200).json({ status: 200, data: data });
  } catch (error) {
    console.error('Aktarım hatası:', error);
    res.status(500).json({ status: 500, error: error.message });
  }
};
exports.updateExSQL = async (req, res) => {
  try {
    const mssqlPool = await poolPromise;
    const mssqlRequest = mssqlPool.request();
    const egitimlerResult = await mssqlRequest.query(`SELECT * FROM egitim`);

    if (egitimlerResult.recordset.length === 0) {
      return res.status(200).json({ status: 200, message: 'Aktarılacak eğitim bulunamadı.' });
    }

    for (const egitim of egitimlerResult.recordset) {
      const { Name: name, id: egitimId, Video: url } = egitim;

      const existingEgitim = await pool.query(`SELECT * FROM portal_egitim WHERE name = $1`, [name]);

      let insertedEgitimId;
      if (existingEgitim.rowCount === 0) {
        const insertedEgitim = await pool.query(
          `INSERT INTO portal_egitim (name, creator_id, url) VALUES ($1, $2, $3) RETURNING id`,
          [name, 1385, url]
        );
        insertedEgitimId = insertedEgitim.rows[0].id;
      } else {
        insertedEgitimId = existingEgitim.rows[0].id;
      }

      // Videolar
      const videoRequest = mssqlPool.request().input('egitimId', egitimId);
      const videoResult = await videoRequest.query(`SELECT * FROM egitimDetail WHERE Eğitim_id = @egitimId`);

      for (const video of videoResult.recordset) {
        const { Name: videoName, Video: videoUrl, video_uzunluk, id: videoIdMSSQL } = video;

        let videoId;
        const existingVideo = await pool.query(
          `SELECT * FROM portal_egitim_video WHERE egitim_id = $1 AND name = $2`,
          [insertedEgitimId, videoName]
        );

        if (existingVideo.rowCount === 0) {
          const insertedVideo = await pool.query(
            `INSERT INTO portal_egitim_video (egitim_id, name, creator_id, is_deleted, is_active) 
             VALUES ($1, $2, 1385, false, true) RETURNING id`,
            [insertedEgitimId, videoName]
          );
          videoId = insertedVideo.rows[0].id;

          const uzanti = path.extname(videoUrl).toLowerCase().replace('.', '');
          const type = uzanti === 'mp4' ? 2 : 1;
          const fileTypeMap = {
            mp4: 'video/mp4',
            jpg: 'image/jpg',
            png: 'image/png',
            jpeg: 'image/jpeg',
            pdf: 'doc/pdf'
          };
          const file_type = fileTypeMap[uzanti] || '';

          await pool.query(
            `INSERT INTO portal_egitim_files (type, url, file_type, file_boyut, file_uzunluk, is_deleted, is_active, connected_id)
             VALUES ($1, $2, $3, 0, $4, false, true, $5)`,
            [type, videoUrl, file_type, video_uzunluk, videoId]
          );
        } else {
          videoId = existingVideo.rows[0].id;
        }

        // Kullanıcılar
        const userRequest = mssqlPool.request()
          .input('kategoriId', egitimId)
          .input('videoId', videoIdMSSQL);
        const userResult = await userRequest.query(
          `SELECT * FROM egitim_user WHERE kategori_id = @kategoriId AND video_id = @videoId`
        );

        for (const user of userResult.recordset) {
          const { user_id, created_date, updated_date, egitim_suresi, bitirilen_sure } = user;
          const status = (egitim_suresi - bitirilen_sure) > 10 ? 1 : 2;
          const is_end = status === 2;

          const existingUserVideo = await pool.query(
            `SELECT * FROM portal_egitim_user WHERE video_id = $1 AND user_id = $2`,
            [videoId, user_id]
          );

          if (existingUserVideo.rowCount === 0) {
            await pool.query(
              `INSERT INTO portal_egitim_user (user_id, video_id, created_date, update_date, status, is_end, video_time, read_time, egitim_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
              [user_id, videoId, created_date, updated_date, status, is_end, egitim_suresi, bitirilen_sure, insertedEgitimId]
            );
          } else {
            await pool.query(
              `UPDATE portal_egitim_user 
               SET status = $2, is_end = $3, video_time = $4, read_time = $5 
               WHERE id = $1`,
              [existingUserVideo.rows[0].id, status, is_end, egitim_suresi, bitirilen_sure]
            );
          }
        }
      }

      // Departman atamaları
      const departmanResult = await pool.query(`SELECT * FROM portal_departman_organizasyon WHERE is_delete = false AND is_active = true`);

      for (const departman of departmanResult.rows) {
        const { id: departmanId, name: departmanName } = departman;
        const checkDepartman = await pool.query(
          `SELECT * FROM portal_egitim_departman WHERE departman_id = $1 AND egitim_id = $2`,
          [departmanId, insertedEgitimId]
        );

        if (checkDepartman.rowCount === 0) {
          await pool.query(
            `INSERT INTO portal_egitim_departman (egitim_id, departman_id, departman_name) VALUES ($1, $2, $3)`,
            [insertedEgitimId, departmanId, departmanName]
          );
        }
      }
    }

    res.status(200).json({ status: 200, message: 'Aktarım tamamlandı.' });
  } catch (error) {
    console.error('Aktarım hatası:', error);
    res.status(500).json({ status: 500, error: error.message });
  }
};
const uploadDocs = multer({ storage: taskDokuman })



const getEgitimAdminByIdQuery = `
        SELECT egitim.*,
       (SELECT AVG(read_time) 
        FROM portal_egitim_user 
        WHERE egitim_id = egitim.id) AS avg_read_time,
       
       (SELECT SUM(file_uzunluk) 
        FROM (SELECT pef.file_uzunluk 
              FROM portal_egitim_files pef 
              INNER JOIN portal_egitim_video pev 
              ON pef.connected_id = pev.id 
              WHERE pef.type = 2 AND pev.egitim_id = egitim.id) AS file_lengths) AS total_file_length,
       
       (SELECT json_agg(egitim_data) 
        FROM (SELECT pev.*,
                     (SELECT json_agg(users_data) 
                      FROM (SELECT COUNT(DISTINCT peu.user_id) AS count, 
                                   SUM(peu.read_time) AS sum 
                            FROM portal_egitim_user peu 
                            WHERE peu.video_id = pev.id) AS users_data) AS users,
                     
                     (SELECT json_agg(video_data) 
                      FROM (SELECT pef.* 
                            FROM portal_egitim_files pef 
                            WHERE pef.connected_id = pev.id 
                                  AND pef.type != 1 
                                  AND pef.is_deleted = false 
                                  AND pef.is_active = true) AS video_data) AS video
              FROM portal_egitim_video pev 
              WHERE pev.egitim_id = egitim.id 
                    AND pev.is_deleted = false ORDER BY  id DESC
                    ) AS egitim_data) AS egitim
FROM portal_egitim egitim
        WHERE egitim.id = $1
  `;
const getEgitimDetailUserByIdQuery = `
  SELECT egitim.* ,ped.departman_name,(SELECT AVG(puan) FROM portal_egitim_like WHERE egitim_id = egitim.id  )as puan,
	(SELECT COUNT(DISTINCT eu.user_id) FROM portal_egitim_user eu WHERE eu.egitim_id = egitim.id) as sayilan,
  (SELECT SUM(read_time) FROM portal_egitim_user WHERE egitim_id = egitim.id AND user_id = $4) as toplam_read,
	(SELECT SUM(pef.file_uzunluk) FROM portal_egitim_video pev 
	 INNER JOIN portal_egitim_files pef ON pef.connected_id = pev.id 
   AND pef.type != 1 WHERE pev.egitim_id = egitim.id) total_video_length,
	(SELECT json_agg(detay) FROM (SELECT pev.*,COALESCE(peu.is_end,false)as is_end,peu.status,COALESCE(peu.read_time,0) as bitirlen_sure,peu.update_date,
								  (SELECT json_agg(video) FROM 
                  (SELECT * FROM portal_egitim_files pef 
                  WHERE pef.connected_id = pev.id AND pef.type != 1)video ) video
								  FROM portal_egitim_video pev 
                   LEFT JOIN portal_egitim_user peu ON peu.video_id= pev.id AND peu.user_id = $3 
                   WHERE pev.egitim_id = egitim.id)detay ) as detay
FROM portal_egitim egitim 
INNER JOIN portal_egitim_departman ped 
	ON ped.egitim_id = egitim.id AND (ped.departman_id =$2 or ped.departman_id = 38) WHERE egitim.id = $1
  `;
const getEgitimUserByIdQuery = `
   	
SELECT pevv.*,COALESCE((SELECT true FROM portal_egitim_like pel WHERE pel.egitim_id = pevv.egitim_id AND pel.user_id = $5),false) as begenildi,(SELECT json_agg(user_time) FROM (select * from portal_egitim_user where video_id = pevv.id AND user_id = $1)user_time )as user_time,
(SELECT AVG(puan)FROM portal_egitim_like pel WHERE pel.egitim_id =pevv.egitim_id),
(SELECT name FROM portal_egitim pe WHERE pe.id = pevv.egitim_id) as kategori,
(SELECT json_agg(video) FROM(SELECT * FROM portal_egitim_files pef WHERE connected_id = pevv.id AND type != 1)video) as video,
  COALESCE((SELECT COUNT(peu.id) as izleyen 
   FROM portal_egitim_video pev 
   INNER JOIN portal_egitim_user peu ON pev.id = peu.video_id 
   WHERE pev.id = pevv.id 
   GROUP BY pev.id
  ),0) as izleyen 
FROM portal_egitim_video pevv INNER JOIN portal_egitim_departman ped ON ped.egitim_id = pevv.egitim_id AND (ped.departman_id =$2 OR ped.departman_id =38)
ORDER BY izleyen DESC LIMIT $3 OFFSET $4; 
  `;

const getEgitimAdminQuery = `
  	  SELECT egitim.*,(SELECT AVG(read_time) 
        FROM portal_egitim_user 
        WHERE egitim_id = egitim.id) AS avg_read_time,
       
       (SELECT SUM(file_uzunluk) 
        FROM (SELECT pef.file_uzunluk 
              FROM portal_egitim_files pef 
              INNER JOIN portal_egitim_video pev 
              ON pef.connected_id = pev.id 
              WHERE pef.type = 2 AND pev.egitim_id = egitim.id) AS file_lengths) AS sum_time,
			(SELECT json_agg(resim) FROM(SELECT * FROM portal_egitim_files pef WHERE pef.connected_id = egitim.id AND pef.type = 1 AND pef.is_deleted = false AND pef.is_active = true)resim) files,
			
			
					
			(SELECT COUNT(DISTINCT peu.user_id) FROM portal_egitim_user  peu WHERE peu.egitim_id =egitim.id) as count_user,
			
			(SELECT json_agg(likeUser) FROM(SELECT AVG(puan),count(user_id) FROM portal_egitim_like WHERE egitim_id = egitim.id) likeUser) like_user
			
			
FROM portal_egitim egitim where egitim.is_deleted = false 
  `;

const createdEgitimQuery = `WITH new_egitim AS (
    INSERT INTO portal_egitim (
      name, is_deleted, is_active, creator_id
    ) VALUES (
     $1,false, $2, $3
    )
    RETURNING id, name
),
inserted_departments AS (
    INSERT INTO portal_egitim_departman (departman_id, egitim_id, departman_name)
    SELECT (d->'id')::int, new_egitim.id, d->>'description'
    FROM jsonb_array_elements($4::jsonb) AS d, new_egitim
    RETURNING departman_id, egitim_id
)
SELECT new_egitim.*
FROM new_egitim
`
const createdEgitimVideoQuery = `
    INSERT INTO portal_egitim_video (
      name, is_deleted, is_active, creator_id,egitim_id
    ) VALUES (
     $1,false, $2, $3,$4
    )
    RETURNING id, name
`
const postEgitimDetailUserByIdQuery = `
 INSERT INTO portal_egitim_user(
    user_id, video_id, status, is_end, video_time, read_time, egitim_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
`
const putEgitimDetailUserByIdQuery = `
UPDATE portal_egitim_user
	SET update_date=$1, status=$2, is_end=$3, video_time=$4, read_time=$5
	WHERE  id=$6 RETURNING *
`
const egitimDetailUserByIDKontrolQuery = `
SELECT * FROM portal_egitim_user peu WHERE user_id = $1 AND video_id = $2 AND egitim_id =$3
`
const updateEgitimVideoQuery = `
      UPDATE portal_egitim_video SET name = $1 , is_deleted = $2, is_active = $3 
      WHERE id = $4 RETURNING*
`
// 1 assets/images/egitim/egitim_2024-10-09BMC---Excel-2024-08-05-14-18-29_.mp4 video/mp4 8833165 Promise { <pending> } false false 20
const postEgitimPaunUserByIdQuery = `
INSERT INTO portal_egitim_like(
	egitim_id, user_id, puan)
	VALUES ($1, $2, $3) RETURNING*
`;
const putEgitimPaunUserByIdQuery = `
UPDATE portal_egitim_like SET 
	egitim_id = $1, user_id =$2, puan =$3 WHERE id = $4 RETURNING*

`;
const getEgitimPaunUserByIdQuery = `
SELECT * FROM portal_egitim_like WHERE egitim_id = $1 AND user_id =$2

`;
const createdEgitimDokumanQuery = `
INSERT INTO portal_egitim_files(
type, url, file_type, file_boyut, file_uzunluk, is_deleted, is_active, connected_id)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
`;

const getVideoLength = (filePath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        return reject(err);
      }
      const duration = metadata.format.duration; // saniye cinsinden uzunluk
      resolve(duration);
    });
  });
};

const reduceVideoResolution = (inputPath, outputPath, resolution) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .output(outputPath)
      .videoCodec('libx264')
      .size(resolution) // Çözünürlüğü parametre ile belirle
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(err))
      .run();
  });
};

exports.updateEgitimDokuman = [uploadDocs.array('files'), async (req, res) => {
  const { type, is_deleted, is_active, connected_id } = req.body;
  const files = req.files;

  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'Dosya yüklenmedi' });
  }
  const updateDokuman = await pool.query(`UPDATE portal_egitim_files SET is_deleted = true WHERE connected_id = ${connected_id}`)
  const fileProcessingPromises = files.map(async (file) => {
    const url = `assets/images/egitim/${file.filename}`;
    const file_type = file.mimetype;
    const file_boyut = file.size;
    const file_uzunluk = file_type.startsWith('video') ? await getVideoLength(file.path) : null;


    // Orijinal dosya için kayıt
    await pool.query(createdEgitimDokumanQuery, [
      type,
      url,
      file_type,
      file_boyut,
      file_uzunluk,
      is_deleted,
      is_active,
      connected_id
    ]);

    if (file_type.startsWith('video')) {
      // İlk çözünürlük: 640x?
      const reducedFilePath640 = path.join(path.dirname(file.path), `reduced_640_${file.filename}`);
      await reduceVideoResolution(file.path, reducedFilePath640, '640x?');
      const reducedFileStats640 = fs.statSync(reducedFilePath640);

      await pool.query(createdEgitimDokumanQuery, [
        3, // type 3 düşük çözünürlük için
        `assets/images/egitim/reduced_640_${file.filename}`,
        file_type,
        reducedFileStats640.size,
        file_uzunluk,
        is_deleted,
        is_active,
        connected_id
      ]);

      // İkinci çözünürlük: 320x?
      const reducedFilePath320 = path.join(path.dirname(file.path), `reduced_320_${file.filename}`);
      await reduceVideoResolution(file.path, reducedFilePath320, '320x?');
      const reducedFileStats320 = fs.statSync(reducedFilePath320);

      await pool.query(createdEgitimDokumanQuery, [
        4, // type 4 ikinci düşük çözünürlük için
        `assets/images/egitim/reduced_320_${file.filename}`,
        file_type,
        reducedFileStats320.size,
        file_uzunluk,
        is_deleted,
        is_active,
        connected_id
      ]);
    }
  });

  try {
    await Promise.all(fileProcessingPromises);
    res.status(200).json({ message: 'Dosyalar başarıyla yüklendi ve kaydedildi.' });
  } catch (error) {
    console.error('Hata:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}];
exports.createdEgitimDokuman = [uploadDocs.array('files'), async (req, res) => {
  const { type, is_deleted, is_active, connected_id } = req.body;
  const files = req.files;

  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'Dosya yüklenmedi' });
  }

  const fileProcessingPromises = files.map(async (file) => {
    const url = `assets/images/egitim/${file.filename}`;
    const file_type = file.mimetype;
    const file_boyut = file.size;
    const file_uzunluk = file_type.startsWith('video') ? await getVideoLength(file.path) : null;


    // Orijinal dosya için kayıt
    await pool.query(createdEgitimDokumanQuery, [
      type,
      url,
      file_type,
      file_boyut,
      file_uzunluk,
      is_deleted,
      is_active,
      connected_id
    ]);

    if (file_type.startsWith('video')) {
      // İlk çözünürlük: 640x?
      const reducedFilePath640 = path.join(path.dirname(file.path), `reduced_640_${file.filename}`);
      await reduceVideoResolution(file.path, reducedFilePath640, '640x?');
      const reducedFileStats640 = fs.statSync(reducedFilePath640);

      await pool.query(createdEgitimDokumanQuery, [
        3, // type 3 düşük çözünürlük için
        `assets/images/egitim/reduced_640_${file.filename}`,
        file_type,
        reducedFileStats640.size,
        file_uzunluk,
        is_deleted,
        is_active,
        connected_id
      ]);

      // İkinci çözünürlük: 320x?
      const reducedFilePath320 = path.join(path.dirname(file.path), `reduced_320_${file.filename}`);
      await reduceVideoResolution(file.path, reducedFilePath320, '320x?');
      const reducedFileStats320 = fs.statSync(reducedFilePath320);

      await pool.query(createdEgitimDokumanQuery, [
        4, // type 4 ikinci düşük çözünürlük için
        `assets/images/egitim/reduced_320_${file.filename}`,
        file_type,
        reducedFileStats320.size,
        file_uzunluk,
        is_deleted,
        is_active,
        connected_id
      ]);
    }
  });

  try {
    await Promise.all(fileProcessingPromises);
    res.status(200).json({ message: 'Dosyalar başarıyla yüklendi ve kaydedildi.' });
  } catch (error) {
    console.error('Hata:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}];


exports.updateEgitimVideo = async (req, res) => {
  const { name, is_active, is_deleted, id } = req.body
  try {
    console.log(req.body)
    const query = await pool.query(updateEgitimVideoQuery, [name, is_deleted, is_active, id])

    res.status(200).json({
      status: 200,
      data: query.rows
    })
  } catch (error) {
    console.error(error)
    res.status(400).json({
      status: 200,
      data: error
    })
  }

}


exports.postEgitimDetailUserById = async (req, res) => {

  const { user_id, video_id, egitim_suresi, bitirilen_sure, kategori_id } = req.body
  try {
    // gelen user daha önce izlemişmi onu kontrol edeceğiz

    // yoksa insert edilecek
    // varsa update edilecek
    const bugun = new Date();

    const userVarmi = await pool.query(egitimDetailUserByIDKontrolQuery, [user_id, video_id, kategori_id])
    const status = (egitim_suresi - bitirilen_sure) > 10 ? 1 : 2;
    const is_end = status === 2 ? true : false;
    let result
    if (userVarmi.rowCount > 0) {

      const query = await pool.query(putEgitimDetailUserByIdQuery, [bugun, status, is_end, egitim_suresi, bitirilen_sure, userVarmi.rows[0].id])
      result = query.rows
    } else {
      const query = await pool.query(postEgitimDetailUserByIdQuery, [user_id, video_id, status, is_end, egitim_suresi, bitirilen_sure, kategori_id])
      result = query.rows

    }

    res.status(200).json({
      status: 200,
      data: result
    })
  } catch (error) {
    console.error(error)
    res.status(400).json({
      status: 200,
      data: error
    })
  }

}
exports.createdEgitimVideo = async (req, res) => {
  const { name, is_active, creator_id, egitim_id } = req.body
  try {

    const query = await pool.query(createdEgitimVideoQuery, [name, is_active, creator_id, egitim_id])

    res.status(200).json({
      status: 200,
      data: query.rows
    })
  } catch (error) {
    console.error(error)
    res.status(400).json({
      status: 200,
      data: error
    })
  }

}
exports.createdEgitim = async (req, res) => {
  const { name, is_active, creator_id, departman } = req.body
  try {

    const query = await pool.query(createdEgitimQuery, [name, is_active, creator_id, JSON.stringify(departman)])

    res.status(200).json({
      status: 200,
      data: query.rows
    })
  } catch (error) {
    console.error(error)
    res.status(400).json({
      status: 200,
      data: error
    })
  }

}

exports.getEgitimAdmin = async (req, res) => {
  try {
    const egitimGet = await pool.query(getEgitimAdminQuery)

    res.status(200).json({ status: 200, data: egitimGet.rows });

  } catch (error) {
    res.json({
      status: 400, data: error
    })
  }
}
exports.getEgitimAdminById = async (req, res) => {
  try {
    const egitimGet = await pool.query(getEgitimAdminByIdQuery, [req.body.egitim_id])

    res.status(200).json({ status: 200, data: egitimGet.rows });

  } catch (error) {
    res.json({
      status: 400, data: error
    })
  }
}
exports.getEgitimUserById = async (req, res) => {
  try {
    const { user_id, departman_id, limit, ofset } = req.body
    console.log(req.body)
    const egitimGet = await pool.query(getEgitimUserByIdQuery, [user_id, departman_id, limit, ofset, user_id])

    res.status(200).json({ status: 200, data: egitimGet.rows });

  } catch (error) {
    res.json({
      status: 400, data: error
    })
  }
}
exports.getEgitimDetailUserById = async (req, res) => {
  try {
    const { egitim_id, departman_id, user_id, ofset } = req.body
    const egitimGet = await pool.query(getEgitimDetailUserByIdQuery, [egitim_id, departman_id, user_id, user_id])

    res.status(200).json({ status: 200, data: egitimGet.rows });

  } catch (error) {
    res.json({
      status: 400, data: error
    })
  }
}
exports.postEgitimPaunUserById = async (req, res) => {
  try {
    const { egitim_id, user_id, puan } = req.body

    const sorgula = await pool.query(getEgitimPaunUserByIdQuery, [egitim_id, user_id])
    let egitimGet
    if (sorgula.rowCount > 0) {
      egitimGet = await pool.query(putEgitimPaunUserByIdQuery, [egitim_id, user_id, puan, sorgula.rows[0].id])
    } else {
      egitimGet = await pool.query(postEgitimPaunUserByIdQuery, [egitim_id, user_id, puan])
    }

    res.status(200).json({ status: 200, data: egitimGet.rows });

  } catch (error) {
    res.json({
      status: 400, data: error
    })
  }
}

// exports.createAnketDokuman = [uploadDocs.array('files'), async (req, res) => {
//   const { type, connected_id, is_deleted, is_active } = req.body;
//   const files = req.files;


//   let url = `assets/images/anket/${files[0].filename}`;
//   console.log(req.body)
//   const updateDokuman = await pool.query(getAnketByDepartmentIdQuery, [parseInt(connected_id), parseInt(type)])

//   const result = await pool.query(getAnketByDepartmentIdQuery, [
//     parseInt(type),
//     parseInt(connected_id),
//     is_deleted || false,
//     url,
//     is_active ? true : false,
//   ]);

//   res.status(201).json(result.rows[0]);
//   if (result.rowCount === 0) {
//     throw new Error("Invalid connected_id for the given type");
//   }
// }
// ];
// exports.getAnketById = async (req, res) => {
//   const { id } = req.body;
//   try {
//     //Get the anket
//     const anketResult = await pool.query(getAnketByDepartmentIdQuery, [id]);

//     if (anketResult.rowCount === 0) {
//       return res.status(404).send("No survey found with this id");
//     }

//     const anket = anketResult.rows;

//     anket.sorular = sorular;
//     anket.documents = anketDocuments;

//     res.status(200).json({ status: 200, data: anket });
//   } catch (error) {
//     console.error(
//       "Error retrieving survey, questions, options, and documents",
//       error.stack
//     );
//     res.status(500).send("Error retrieving survey");
//   }
// };
