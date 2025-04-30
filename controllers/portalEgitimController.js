
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

exports.updateExSQL = async (req, res) => {
  
  try {
    const mssqlPool = await poolPromise; 
    const poolRequest = mssqlPool.request();
    const egitimler = await poolRequest.query(`SELECT * FROM egitim`);
    if(egitimler.rowsAffected>0){
      for(let data of egitimler.recordsets[0]){
        const egitimKatalogVarMi=await pool.query(`SELECT * FROM portal_egitim WHERE name = ${data.Name}`)
        if(egitimKatalogVarMi.rowCount>0){

        }else{
          const insertEgitim=await pool.query(`INSERT INTO portal_egitim (name,creator_id,url) VALUES($1,$2,$3) RETURNING *`,[data.Name,1385,data.Video])
          const insertEgitimID = insertEgitim.rows[0].id
          const videolar = await poolRequest.query(`SELECT * FROM egitimDetail WHERE Eğitim_id = $1`,[data.id]);
          if(videolar.rowsAffected>0){
            for(let egitim of videolar.recordsets[0]){
                const videoVarmi= await pool.query(`SELECT * FROM portal_egitim_video WHERE egitim_id=$1 AND name = $2`,[insertEgitimID,egitim.Name])
                if(videoVarmi.rowCount==0){
                  const insertEgitimVideo= await pool.query(`INSERT INTO portal_egitim_video (egitim_id, name, creator_id, is_deleted, is_active) VALUES ($1,$2,1385,false,true) RETUNING * `,[insertEgitimID,egitim.Name])
                  if(insertEgitimVideo.rowCount>0){
                    const uzanti = egitim.Video.split('.').pop();
                    const type = uzanti === 'mp4' ?2 : 
                                uzanti === 'jpg' ? 1 : 1;
                    const file_type = uzanti === 'mp4' ?'video/mp4' : 
                                uzanti === 'jpg' ? 'image/jpg' : 
                                uzanti === 'png' ? 'image/png' :  uzanti === 'jpeg' ? 'image/jpeg' : uzanti === 'pdf' ? 'doc/pdf' :  '';
                   const egitimVideoKaydet= await pool.query(`INSERT INTO portal_egitim_files( type, url, file_type, file_boyut, file_uzunluk, is_deleted, is_active, connected_id)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING*`,[type,egitim.Video,file_type,0,egitim.video_uzunluk,false,true,1385])   
                  }
                }
            }
          }

        }
      }
    }

    res.status(200).json({
      status: 200,
      // data: query.rows
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
 
  const {  user_id, video_id,  egitim_suresi, bitirilen_sure, kategori_id } = req.body
  try {
// gelen user daha önce izlemişmi onu kontrol edeceğiz

// yoksa insert edilecek
// varsa update edilecek
const bugun = new Date();
				
    const userVarmi = await pool.query(egitimDetailUserByIDKontrolQuery,[user_id,video_id,kategori_id])
    const status = (egitim_suresi - bitirilen_sure) > 10 ? 1 : 2;
    const is_end = status === 2 ? true : false;
    let result 
    if(userVarmi.rowCount>0){
    
      const query = await pool.query(putEgitimDetailUserByIdQuery, [bugun,  status, is_end, egitim_suresi, bitirilen_sure,  userVarmi.rows[0].id])
      result = query.rows
    }else{
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
    const {user_id,departman_id,limit,ofset} = req.body
    console.log(req.body)
    const egitimGet = await pool.query(getEgitimUserByIdQuery, [user_id,departman_id,limit,ofset,user_id])

    res.status(200).json({ status: 200, data: egitimGet.rows });

  } catch (error) {
    res.json({
      status: 400, data: error
    })
  }
}
exports.getEgitimDetailUserById = async (req, res) => {
  try {
    const {egitim_id,departman_id,user_id,ofset} = req.body
    const egitimGet = await pool.query(getEgitimDetailUserByIdQuery, [egitim_id,departman_id,user_id,user_id])

    res.status(200).json({ status: 200, data: egitimGet.rows });

  } catch (error) {
    res.json({
      status: 400, data: error
    })
  }
}
exports.postEgitimPaunUserById = async (req, res) => {
  try {
    const {egitim_id,user_id,puan} = req.body

    const sorgula = await pool.query(getEgitimPaunUserByIdQuery, [egitim_id,user_id])
    let egitimGet
    if(sorgula.rowCount>0){
       egitimGet = await pool.query(putEgitimPaunUserByIdQuery, [egitim_id,user_id,puan,sorgula.rows[0].id])
    }else{
       egitimGet = await pool.query(postEgitimPaunUserByIdQuery, [egitim_id,user_id,puan])
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
