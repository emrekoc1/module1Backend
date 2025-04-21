
const pool = require('../db');
const path = require('path');
const transliteration = require('transliteration');
const multer = require('multer');
const taskDokuman = multer.diskStorage({

  destination: (req, file, callBack) => {
    const destinationPath = path.join(__dirname, '..', '..', '..', '..', '..', '..', 'wamp64', 'www', 'assets', 'images', 'duyuru');
    //const destinationPath = path.join(__dirname, '..', 'front end', 'front end', 'src', 'assets', 'docs');
    callBack(null, destinationPath)
  },

  filename: (req, file, callBack) => {
    const bugun = new Date();
    const tarihDamgasi = bugun.toISOString().replace(/[:.]/g, '').substring(0, 10); // Sadece '2023-08-25' bölümü
    const originalnameWithoutExtension = path.parse(file.originalname).name;
    const transliteratedName = transliteration.slugify(originalnameWithoutExtension, { lowercase: false });
    callBack(null, `duyuru_${tarihDamgasi}${transliteratedName}_${path.extname(file.originalname)}`);

  }

})

const uploadDocs = multer({ storage: taskDokuman })
const departmanGetQuery = `SELECT * FROM portal_departman ORDER BY id`
const createDuyuruQuery = `
WITH new_duyuru AS (
    INSERT INTO portal_duyuru (
      duyru_basligi, duyru_aciklama, duyru_oncelik, duyru_birimi, created_date, update_date, is_deleted, is_active
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8
    )
    RETURNING id, duyru_basligi
),
inserted_departments AS (
    INSERT INTO portal_duyuru_departman (department_id, duyuru_id, department_name)
    SELECT (d->'department_id')::int, new_duyuru.id, d->>'department_name'
    FROM jsonb_array_elements($9::jsonb) AS d, new_duyuru
    RETURNING department_id, duyuru_id
)
SELECT new_duyuru.*
FROM new_duyuru;
`;
const updateDuyuruQuery = `
    UPDATE portal_duyuru SET
      duyru_basligi =$1,duyru_aciklama=$2,duyru_oncelik=$3, duyru_birimi=$4,
       update_date=$5,is_deleted = $6,is_active=$7
   WHERE id = $8
     
    RETURNING *;
  `;
const getDuyuruQuery = `
 SELECT (SELECT count(DISTINCT user_id) FROM portal_duyuru_user_read WHERE duyuru_id = du.id) as katilimci,
du.* ,
 (SELECT json_agg(departman) FROM(SELECT * FROM portal_duyuru_departman WHERE du.id= duyuru_id AND is_deleted = false AND is_active = true)departman) departman,
   (SELECT json_agg(dokuman) 
   FROM(SELECT ankDok.* 
          FROM portal_duyuru_dokuman ankDok 
          WHERE ankDok.type=1 AND ankDok.connected_id=du.id)dokuman)dokuman
FROM portal_duyuru du WHERE du.is_deleted= false AND du.is_active = true LIMIT $1 OFFSET $2
`;
const getDuyuruByIdQuery = `
 SELECT (SELECT count(DISTINCT user_id) FROM portal_duyuru_user_read WHERE duyuru_id = du.id) as katilimci,
du.* ,
 (SELECT json_agg(departman) FROM(SELECT * FROM portal_duyuru_departman WHERE du.id= duyuru_id AND is_deleted = false AND is_active = true)departman) departman,
   (SELECT json_agg(dokuman) 
   FROM(SELECT ankDok.* 
          FROM portal_duyuru_dokuman ankDok 
          WHERE ankDok.type=1 AND ankDok.connected_id=du.id)dokuman)dokuman
FROM portal_duyuru du WHERE du.is_deleted= false AND du.is_active = true AND du.id = $1 
`;
const getDuyuruForUserQuery = `
SELECT pd.*, CASE WHEN EXISTS  (SELECT true FROM portal_duyuru_user_read WHERE duyuru_id = pd.id AND user_id=$4) then true else false end as status ,(SELECT json_agg(dokumans) FROM (SELECT * FROM portal_duyuru_dokuman WHERE pd.id = connected_id)dokumans) as dokuman FROM portal_duyuru pd 
	INNER JOIN portal_duyuru_departman pdd ON (pdd.department_id = $1 OR pdd.department_id = 38) AND pdd.duyuru_id = pd.id AND  pdd.is_deleted = false AND pdd.is_active 
WHERE pd.is_deleted = false AND pd.is_active 
ORDER BY pd.created_date 
LIMIT $2 OFFSET $3
  `;
const postUserNotQuery = `
INSERT INTO portal_duyuru_user_read( user_id, duyuru_id,  user_name) VALUES ($1, $2,$3)
  `;
const getDuyuruQueryCount = `
  SELECT an.*
 
  
  FROM portal_duyuru an where an.is_deleted = false and is_active = true 
  `;
const getDuyuruGenelQuery = `
SELECT 
      (SELECT COUNT(id) FROM portal_duyuru) AS toplam_duyuru,
      (SELECT COUNT(DISTINCT user_id) FROM portal_duyuru_user_read) AS toplam_user
       `;
const updateDokumanKontrolQuery = `
   UPDATE portal_duyuru_dokuman SET type=1, connected_id=$1, is_deleted=$2, url=$3, is_active=$4 WHERE id=$5
  `;
const createDuyuruDepartmanQuery = `
    INSERT INTO portal_duyuru_departman (
     duyuru_id, department_id, department_name, is_deleted, is_active
    ) VALUES (
      $1, $2, $3, $4, $5
    )
    RETURNING *;
  `;
const updateDuyuruDepartmanQuery = `
    UPDATE  portal_duyuru_departman SET duyuru_id = $1, department_id = $2, department_name =$3, is_deleted = $4, is_active = $5
   WHERE id = $6
    RETURNING *;
  `;
const createDuyuruDokumanQuery = `
    INSERT INTO portal_duyuru_dokuman (type, connected_id, is_deleted, url, is_active ) VALUES ($1, $2, $3, $4, $5) RETURNING *;
  `;

const getGenelRaporQuery = `
SELECT 
    (SELECT COUNT(id) FROM portal_duyuru WHERE is_deleted = false AND is_active = true) AS yayindaki_duyru,
    (SELECT json_agg(duyuru) FROM (SELECT pd.*,(SELECT json_agg(departman) FROM (SELECT pdur.* FROM portal_duyuru_departman pdur WHERE pdur.duyuru_id = pd.id)departman)departmans ,(SELECT json_agg(users) FROM (SELECT pdur.* FROM portal_duyuru_user_read pdur WHERE pdur.duyuru_id = pd.id)users)user_read FROM portal_duyuru pd)duyuru) AS duyurular,
    (SELECT COUNT(id) FROM portal_duyuru) AS toplam_duyru,
    (SELECT COUNT(DISTINCT user_id) FROM portal_duyuru_user_read) AS duyru_goren
    `

const getDocumentsQuery = `
    SELECT * FROM portal_duyuru_dokuman
    WHERE connected_id = $1 AND is_deleted = false;
  `;

/* duyuru ekle*/
exports.createDuyuru = (req, res) => {
  const {
    duyru_basligi, duyru_aciklama, duyru_oncelik, duyru_birimi, created_date, update_date, is_deleted, is_active, departments
  } = req.body;

  pool.query(
    createDuyuruQuery,
    [
      duyru_basligi, duyru_aciklama, duyru_oncelik, duyru_birimi, created_date, update_date, is_deleted, is_active, JSON.stringify(departments)
    ],
    (error, results) => {
      if (error) {
        console.error("Error executing query", error.stack);
        res.status(500).send("Error creating survey");
        return;
      }
      res.status(200).json({ status: 200, data: results.rows[0] });
    }
  );
};
/* departman get*/
exports.getDepartman = async (req, res) => {
  try {
    //Get the anket
    const anketResult = await pool.query(departmanGetQuery);

    if (anketResult.rowCount === 0) {
      return res.status(404).send("No survey found with this id");
    }

    const anket = anketResult.rows;

    res.status(200).json({ status: 200, data: anket });
  } catch (error) {
    console.error(
      "Error retrieving survey, questions, options, and documents",
      error.stack
    );
    res.status(500).send("Error retrieving survey");
  }
};
exports.getGenelRapor= async (req, res) => {
  try {
    //Get the anket
    const anketResult = await pool.query(getGenelRaporQuery);

    if (anketResult.rowCount === 0) {
      return res.status(404).send("No survey found with this id");
    }

    const anket = anketResult.rows;

    res.status(200).json({ status: 200, data: anket });
  } catch (error) {
    console.error(
      "Error retrieving survey, questions, options, and documents",
      error.stack
    );
    res.status(500).send("Error retrieving survey");
  }
};
/* duyru get single*/
exports.getAnketById = async (req, res) => {
  const { id } = req.body;
  try {
    //Get the anket
    const anketResult = await pool.query(getDuyuruByIdQuery, [id]);

    if (anketResult.rowCount === 0) {
      return res.status(404).send("No survey found with this id");
    }

    const anket = anketResult.rows;

    //Get questions, options, and documents for the survey

    res.status(200).json({ status: 200, data: anket });
  } catch (error) {
    console.error(
      "Error retrieving survey, questions, options, and documents",
      error.stack
    );
    res.status(500).send("Error retrieving survey");
  }
};
/* update duyuru*/
exports.updateDuyuru = (req, res) => {
  const { duyru_basligi,
    duyru_aciklama,
    duyru_oncelik,
    duyru_birimi,
    update_date
    , is_deleted,
    is_active,
    id } =
    req.body;
  pool.query(
    updateDuyuruQuery,
    [
      duyru_basligi,
      duyru_aciklama,
      duyru_oncelik,
      duyru_birimi,
      update_date
      , is_deleted,
      is_active,
      id

    ],
    (error, results) => {
      if (error) {
        console.error("Error executing query", error.stack);
        res.status(500).send("Error creating survey question");
        return;
      }
      res.status(201).json({ status: 200, data: results.rows[0] });
    }
  );
};
/* duyru get*/
exports.postUserNot = async (req, res) => {
  const { user_id, duyuru_id,  user_name } = req.body;
  try {
    //Get the anket
   
    const anketResult = await pool.query(postUserNotQuery, [user_id, duyuru_id,  user_name]);
    

   
    const anket = anketResult.rows;


    res.status(200).json({ status: 200, data: anket});
  } catch (error) {
    console.error(
      "Error retrieving survey, questions, options, and documents",
      error.stack
    );
    res.status(500).send("Error retrieving survey");
  }
};
exports.getDuyuruForUser = async (req, res) => {
  const { departman_id,user_id, limit, ofset } = req.body;
  try {
    //Get the anket
   
    const anketResult = await pool.query(getDuyuruForUserQuery, [departman_id,limit, ofset,user_id]);
    

    if (anketResult.rowCount === 0) {
      return res.status(404).send("No survey found with this id");
    }

    const anket = anketResult.rows;


    res.status(200).json({ status: 200, data: anket});
  } catch (error) {
    console.error(
      "Error retrieving survey, questions, options, and documents",
      error.stack
    );
    res.status(500).send("Error retrieving survey");
  }
};
exports.getDuyuru = async (req, res) => {
  const { id, limit, ofset } = req.body;
  try {
    //Get the anket
   
    const anketResult = await pool.query(getDuyuruQuery, [limit, ofset]);
    const anketResultCount = await pool.query(getDuyuruQueryCount);
    const anketGenel = await pool.query(getDuyuruGenelQuery);



    const anket = anketResult.rows;


    res.status(200).json({ status: 200, data: anket, genel: anketGenel.rows[0], toplamsatir: anketResultCount.rowCount });
  } catch (error) {
    return res.status(404).send("No survey found with this id");
  }
};
exports.createdDuyuruDepartman = async (req, res) => {
  const {
    duyuru_id, department_id, department_name, is_deleted, is_active
  } = req.body;
if(department_id == 38){
  const queryUpdate = pool.query(`UPDATE portal_duyuru_departman SET  is_deleted = true , is_active=false WHERE duyuru_id = ${duyuru_id}`)
}else{
  const selectQuery = pool.query(`SELECT * FROM portal_duyuru_departman WHERE duyuru_id=${duyuru_id} AND is_deleted = false AND is_active=true AND department_id = 38`)
  const queryUpdate = pool.query(`UPDATE portal_duyuru_departman SET  is_deleted = true , is_active=false WHERE duyuru_id = ${duyuru_id}  AND department_id = 38`)

}
  pool.query(
    createDuyuruDepartmanQuery,
    [
      duyuru_id, department_id, department_name, is_deleted, is_active
    ],
    (error, results) => {
      if (error) {
        console.error("Error executing query", error.stack);
        res.status(500).send("Error creating survey");
        return;
      }
      res.status(200).json({ status: 200, data: results.rows });
    }
  );
};
exports.updateDuyuruDepartman = (req, res) => {
  const {
    duyuru_id, department_id, department_name, is_deleted, is_active, id
  } = req.body;

  pool.query(
    updateDuyuruDepartmanQuery,
    [
      duyuru_id, department_id, department_name, is_deleted, is_active, id
    ],
    (error, results) => {
      if (error) {
        console.error("Error executing query", error.stack);
        res.status(500).send("Error creating survey");
        return;
      }
      res.status(200).json({ status: 200, data: results.rows });
    }
  );
};

exports.creatDuyuruDokuman = [uploadDocs.array('files'), async (req, res) => {
  const { type, connected_id, is_deleted, is_active } = req.body;
  const files = req.files;

  if (!files) {
    return res.status(400).json({ error: 'No File' });
  }
  let url = `assets/images/duyuru/${files[0].filename}`;


  const result = await pool.query(createDuyuruDokumanQuery, [
    1, connected_id, is_deleted, url, is_active

  ]);

  res.status(201).json({ status: 200, data: result.rows[0] });
  if (result.rowCount === 0) {
    throw new Error("Invalid connected_id for the given type");
  }
}
];
exports.updateDuyuruDokuman = [uploadDocs.array('files'), async (req, res) => {
  const { type, connected_id, is_deleted, is_active, id } = req.body;
  const files = req.files;

  if (!files) {
    return res.status(400).json({ error: 'No File' });
  }
  let url = `assets/images/duyuru/${files[0].filename}`;

  const updateDokuman = await pool.query(updateDokumanKontrolQuery,
    [connected_id, is_deleted, url, is_active, id])



  res.status(201).json({ status: 200, data: updateDokuman.rows[0] });
  if (updateDokuman.rowCount === 0) {
    throw new Error("Invalid connected_id for the given type");
  }
}
];
exports.getAnketById = async (req, res) => {
  const { id } = req.body;
  try {
    //Get the anket
    const anketResult = await pool.query(getDuyuruByIdQuery, [id]);

    if (anketResult.rowCount === 0) {
      return res.status(404).send("No survey found with this id");
    }

    const anket = anketResult.rows;

    //Get questions, options, and documents for the survey

    res.status(200).json({ status: 200, data: anket });
  } catch (error) {
    console.error(
      "Error retrieving survey, questions, options, and documents",
      error.stack
    );
    res.status(500).send("Error retrieving survey");
  }
};
exports.duyurUserRead = async (req, res) => {
  try {
    const { duyuru_id, user_id, user_name } = req.body; // Query parametrelerini alıyoruz

        let varmiQuery = `SELECT * FROM portal_duyuru_user_read WHERE  duyuru_id = $1 AND user_id = $2`;
        const result = await pool.query(varmiQuery, [duyuru_id, user_id]);
        if (result.rowCount == 0) {
            let insertQuery = `INSERT INTO portal_duyuru_user_read(
	 duyuru_id, user_id, user_name)
	VALUES ($1,$2,$3)`
            const resultInsert = await pool.query(insertQuery, [duyuru_id, user_id, user_name])
            res.json({ status: 200, data: resultInsert.rows });
        } else {
            res.json({ status: 200, data: result.rows });
        }
  } catch (error) {
  
    res.status(500).send(error.stack);
  }
};

exports.getDocuments = async (connected_id) => {
  try {
    const result = await pool.query(getDocumentsQuery, [connected_id]);
    return result.rows;
  } catch (error) {
    console.error("Error retrieving documents", error.stack);
    throw error;
  }
};



