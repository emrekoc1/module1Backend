
const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const axios = require('axios');
const nodemailer = require("nodemailer");
const cors = require('cors');
const { format } = require('date-fns');
const http = require('http');
const request = require('request')
router.use(cors());
const pool = require('./db');
const { machine } = require('os');
const multer = require('multer');
const path = require('path');
const transliteration = require('transliteration');
const fs = require("fs");
const moment = require('moment-timezone');
const taskDokuman = multer.diskStorage({

  destination: (req, file, callBack) => {
    const destinationPath = path.join(__dirname, '..', '..', '..', '..', '..', '..', 'wamp64', 'www', 'assets', 'docs');
    //const destinationPath = path.join(__dirname, '..', 'front end', 'front end', 'src', 'assets', 'docs');
    callBack(null, destinationPath)
  },

  filename: (req, file, callBack) => {
    const bugun = new Date();
    const tarihDamgasi = bugun.toISOString().replace(/[:.]/g, '').substring(0, 10); // Sadece '2023-08-25' bölümü
    const originalnameWithoutExtension = path.parse(file.originalname).name;
    const transliteratedName = transliteration.slugify(originalnameWithoutExtension, { lowercase: false });
    callBack(null, `anket_${tarihDamgasi}${transliteratedName}_${path.extname(file.originalname)}`);

  }

})

const uploadDocs = multer({ storage: taskDokuman })


const createAnketQuery = `
WITH new_anket AS (
  INSERT INTO anket (
    title, aciklama, start_date, start_time, finish_date, finish_time, is_deleted, is_active, status, creator_id
  ) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
  )
  RETURNING id
),
inserted_departments AS (
  INSERT INTO anket_birim (department_id, anket_id)
  SELECT department_id, new_anket.id
  FROM unnest($11::int[]) AS department_id, new_anket
  RETURNING department_id, anket_id
)
SELECT DISTINCT  anket_id FROM inserted_departments ;
`;
const createAnketSoruQuery = `
  INSERT INTO anket_sorular (
    title,duration, is_deleted, is_active, soru_type, is_imperative, anket_id
  ) VALUES (
    $1, $2, $3, $4, $5, $6,$7
  )
  RETURNING *;
`;
const createUserCevapQuery = `
WITH new_anket AS (
  INSERT INTO anket_user (
    user_id, anket_id, created_date, update_date
  ) VALUES (
    $1, $2, $3::timestamptz, $4::timestamptz
  )
  RETURNING id
),
inserted_departments AS (
  INSERT INTO anket_user_answer (
    soru_id, anket_user_id, answer, answer_id, created_date, anket_id
  )
  SELECT 
    unnest($5::int[]) AS soru_id,
    new_anket.id,
    unnest($6::text[]) AS answer,
    unnest($7::int[]) AS answer_id,
    unnest($8::timestamptz[]) AS created_date,
    unnest($9::int[]) AS anket_id
  FROM new_anket
  RETURNING anket_id
)
SELECT DISTINCT anket_id FROM inserted_departments;
`;
const updateAnketSoruQuery = `
  UPDATE anket_sorular SET
    title =$1,duration=$8, is_deleted=$2, is_active=$3, soru_type=$4, is_imperative = $5, anket_id=$6
 WHERE id = $7
   
  RETURNING *;
`;
const createAnketSoruSiklariQuery = `
  INSERT INTO anket_soru_siklari (
    is_deleted, is_active, answer, anket_id, soru_id
  ) VALUES (
    $1, $2, $3, $4, $5
  )
  RETURNING *;
`;

const updateDokumanKontrolQuery = `
 UPDATE anket_dokuman SET is_active = false WHERE connected_id = $1 AND type = $2
`;
const updateAnketSoruSiklariQuery = `
 UPDATE anket_soru_siklari SET
    is_deleted=$1, is_active=$2, answer=$3, anket_id=$4, soru_id=$5
     WHERE id=$6
  
  RETURNING *;
`;
const createAnketDokumanQuery = `
  INSERT INTO anket_dokuman (
    type, connected_id, is_deleted, url, is_active
  ) VALUES (
    $1, $2, $3, $4, $5
  )
  RETURNING *;
`;

const getAnketQuery = `
SELECT an.*,(SELECT json_agg(departman) FROM(SELECT * FROM anket_birim WHERE an.id= anket_id)departman) departman,
(SELECT json_agg(dokuman) 
 FROM(SELECT ankDok.* 
		FROM anket_dokuman ankDok 
		WHERE ankDok.type=0 AND ankDok.connected_id=an.id)dokuman)dokuman,
 (SELECT json_agg(sorular) 
  FROM (SELECT soru.*,
		
		(SELECT json_agg(icAns) 
  FROM (SELECT icerik.*,
		(SELECT json_agg(dokuman) 
			 FROM(SELECT soruDok.* 
				  FROM anket_dokuman soruDok 
				  WHERE soruDok.type=2 AND soruDok.connected_id=icerik.id)dokuman)dokuman
 FROM anket_soru_siklari icerik 
		   WHERE icerik.soru_id = soru.id AND icerik.is_deleted=false AND icerik.is_active = true) icAns)answer, 
		
		
			(SELECT json_agg(dokuman) 
			 FROM(SELECT soruDok.* 
				  FROM anket_dokuman soruDok 
				  WHERE soruDok.type=1 AND soruDok.connected_id=soru.id)dokuman)dokuman
 FROM anket_sorular soru 
		   WHERE anket_id = an.id AND soru.is_deleted=false AND soru.is_active = true) sorular)sorular 
FROM anket an where an.is_deleted = false and is_active = true
`;
const getAnketGenelQuery = `SELECT 
    (SELECT COUNT(id) FROM anket) AS toplam_anket,
    (SELECT COUNT(DISTINCT user_id) FROM anket_user) AS toplam_user `;
const getAnkeRaporQuery = `SELECT '' as user_name, aua.answer as response,user_id,aua.soru_id,
(SELECT asor.title FROM anket_sorular asor WHERE aua.soru_id = asor.id)  as soru_aciklama
FROM anket_user_answer aua 
INNER JOIN anket_user au ON au.id = aua.anket_user_id where aua.anket_id =$1  `;
const getAnkeRaporYuzdeQuery = `SELECT 
    COUNT(aua.answer) AS secilen,
    aua.soru_id, 
    aua.answer,
    (SELECT COUNT(DISTINCT user_id) 
     FROM anket_user au 
     WHERE au.anket_id = aua.anket_id ),
    (SELECT title 
     FROM anket_sorular asor  
     WHERE asor.id = aua.soru_id) 
FROM 
    anket_user_answer aua
WHERE 
    aua.anket_id = $1 
GROUP BY 
    aua.answer, 
    aua.soru_id,
	aua.anket_id; `;

const getAnketByIdQuery = `
SELECT an.*,(SELECT json_agg(departman) FROM(SELECT * FROM anket_birim WHERE an.id= anket_id)departman) departman,
(SELECT json_agg(dokuman) 
 FROM(SELECT ankDok.* 
		FROM anket_dokuman ankDok 
		WHERE ankDok.type=0 AND ankDok.connected_id=an.id)dokuman)dokuman,
 (SELECT json_agg(sorular) 
  FROM (SELECT soru.*,
		
		(SELECT json_agg(icAns) 
  FROM (SELECT icerik.*,
		(SELECT json_agg(dokuman) 
			 FROM(SELECT soruDok.* 
				  FROM anket_dokuman soruDok 
				  WHERE soruDok.type=2 AND soruDok.connected_id=icerik.id)dokuman)dokuman
 FROM anket_soru_siklari icerik 
		   WHERE icerik.soru_id = soru.id AND icerik.is_deleted=false AND icerik.is_active = true ORDER BY icerik.id) icAns)answer, 
		
		
			(SELECT json_agg(dokuman) 
			 FROM(SELECT soruDok.* 
				  FROM anket_dokuman soruDok 
				  WHERE soruDok.type=1 AND soruDok.connected_id=soru.id)dokuman)dokuman
 FROM anket_sorular soru 
		   WHERE anket_id = an.id AND soru.is_deleted=false AND soru.is_active = true ORDER BY soru.id) sorular)sorular  
FROM anket an 
WHERE an.id = $1 AND is_deleted = false`;
const getSorularByAnketIdQuery = `
  SELECT * FROM anket_sorular WHERE anket_id = $1 AND is_deleted = false;
`;
const getSiklarBySoruIdQuery = `SELECT * FROM anket_soru_siklari WHERE soru_id = $1 AND is_deleted = false;`;

const getDocumentsQuery = `
  SELECT * FROM anket_dokuman
  WHERE connected_id = $1 AND is_deleted = false;
`;
const getAnketByDepartmentIdQuery = `
   SELECT an.*,  (CASE 
     WHEN EXISTS (SELECT 1 FROM anket_user WHERE anket_id = an.id AND user_id = $2) 
     THEN true 
     ELSE false 
   END) as anket_tamamlandi,(SELECT json_agg(departman) FROM(SELECT * FROM anket_birim WHERE an.id= anket_id)departman) departman,
(SELECT json_agg(dokuman) 
 FROM(SELECT ankDok.* 
		FROM anket_dokuman ankDok 
		WHERE ankDok.type=0 AND ankDok.connected_id=an.id)dokuman)dokuman,
 (SELECT json_agg(sorular) 
  FROM (SELECT soru.*,
		
		(SELECT json_agg(icAns) 
  FROM (SELECT icerik.*,
		(SELECT json_agg(dokuman) 
			 FROM(SELECT soruDok.* 
				  FROM anket_dokuman soruDok 
				  WHERE soruDok.type=2 AND soruDok.connected_id=icerik.id)dokuman)dokuman
 FROM anket_soru_siklari icerik 
		   WHERE icerik.soru_id = soru.id AND icerik.is_deleted=false AND icerik.is_active = true ORDER BY icerik.id) icAns)answer, 
		
		
			(SELECT json_agg(dokuman) 
			 FROM(SELECT soruDok.* 
				  FROM anket_dokuman soruDok 
				  WHERE soruDok.type=1 AND soruDok.connected_id=soru.id)dokuman)dokuman
 FROM anket_sorular soru 
		   WHERE anket_id = an.id AND soru.is_deleted=false AND soru.is_active = true ORDER BY soru.id) sorular)sorular  
FROM anket an INNER JOIN anket_birim abirim ON abirim.anket_id = an.id AND abirim.department_id = $1
WHERE  is_deleted = false
`;





const createAnket = (req, res) => {
  const {
    title,
    aciklama,
    start_date,
    start_time,
    finish_date,
    finish_time,
    status,
    creator_id,
    departments,
  } = req.body;

  pool.query(
    createAnketQuery,
    [
      title,
      aciklama,
      start_date,
      start_time,
      finish_date,
      finish_time,
      false,
      true,
      status,
      creator_id,
      departments,
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
const createAnketSoru = (req, res) => {
  const { title, duration, is_deleted, is_active, soru_type, is_imperative, anket_id } =
    req.body;
  pool.query(
    createAnketSoruQuery,
    [
      title,
      duration,
      is_deleted || false,
      is_active || true,
      soru_type,
      is_imperative,
      anket_id,
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
const createuserAnketSoru = (req, res) => {
  const anketData = req.body;

  const user_id = anketData.user_id;
  const anket_id = anketData.anket_id;
  const today = new Date();
  const production_dates = today.toISOString();  // ISO formatına çeviriyoruz
  
  const soru_ids = anketData.answer.map(a => a.soru_id);
  const answers = anketData.answer.map(a => a.answer);
  const answer_ids = anketData.answer.map(a => a.answer_id);
  const created_dates = Array(anketData.answer.length).fill(production_dates);
  const anket_ids = anketData.answer.map(a => a.anket_id);
  
  const params = [
    user_id,
    anket_id,
    production_dates,
    production_dates,
    soru_ids,
    answers,
    answer_ids,
    created_dates,
    anket_ids
  ];
  pool.query(
    createUserCevapQuery,
    params,
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
const updateAnketSoru = (req, res) => {
  const { title, duration, is_deleted, is_active, soru_type, is_imperative, anket_id, id } =
    req.body;

  pool.query(
    updateAnketSoruQuery,
    [
      title,
      is_deleted || false,
      is_active || true,
      soru_type,
      is_imperative || false,
      anket_id,
      id,
      duration
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

const updateAnketSoruSiklari = (req, res) => {
  const { is_deleted, is_active, answer, anket_id, soru_id, id } = req.body;

  pool.query(
    updateAnketSoruSiklariQuery,
    [is_deleted || false, is_active || true, answer, anket_id, soru_id, id],
    (error, results) => {
      if (error) {
        console.error("Error executing query", error.stack);
        res.status(500).send("Error creating survey question answer");
        return;
      }
      res.status(201).json({ status: 200, data: results.rows[0] });
    }
  );
};
const getAnketRapor = async (req, res) => {
  const { anket_id } = req.body;

  pool.query(
    getAnkeRaporQuery,
    [ anket_id],
    async (error, results) => {
      if (error) {
        console.error("Error executing query", error.stack);
        res.status(500).send("Error creating survey question answer");
        return;
      }
     const ankets = results.rows
     for (const item of ankets) {
      if (item.user_name === "") {
        try {
          const response = await axios.post('http://10.0.0.35:3212/getUserSingleID', { user_id: item.user_id });
          const users = response.data.data;
          let user_name = users.user_name;

          ankets.forEach(degistir => {
            if (degistir.user_id === item.user_id) {
              degistir.user_name = user_name;
            }
          });
        } catch (apiError) {
          console.error("Error fetching user data", apiError);
        }
      }
    }
   
      res.status(201).json({ status: 200, data: results.rows });
    }
 
);
};
const getAnketRaporYuzde = async (req, res) => {
  const { anket_id } = req.body;


   
    pool.query(
      getAnkeRaporYuzdeQuery,
      [ anket_id],
      async (error, result) => {
        if (error) {
          console.error("Error executing query", error.stack);
          res.status(500).send("Error creating survey question answer");
          return;
        }
       const yuzdeResults = result.rows
      res.status(201).json({ status: 200, data: yuzdeResults });
    }
  );
}


const createAnketSoruSiklari = (req, res) => {
  const { is_deleted, is_active, answer, anket_id, soru_id } = req.body;
  pool.query(
    createAnketSoruSiklariQuery,
    [is_deleted || false, is_active || true, answer, anket_id, soru_id],
    (error, results) => {
      if (error) {
        console.error("Error executing query", error.stack);
        res.status(500).send("Error creating survey question answer");
        return;
      }
      res.status(201).json({ status: 200, data: results.rows[0] });
    }
  );
};

const createAnketDokuman = async (req, res) => {
  const { type, connected_id, is_deleted, is_active } = req.body;
  const files = req.files;

  if (!files) {
    return res.status(400).json({ error: 'No File' });
  }
  let url = `assets/docs/${files[0].filename}`;

  const updateDokuman = await pool.query(updateDokumanKontrolQuery, [parseInt(connected_id), parseInt(type)])

  const result = await pool.query(createAnketDokumanQuery, [
    parseInt(type),
    parseInt(connected_id),
    is_deleted || false,
    url,
    is_active || true,
  ]);

  res.status(201).json(result.rows[0]);
  if (result.rowCount === 0) {
    throw new Error("Invalid connected_id for the given type");
  }
};
const getAnketById = async (req, res) => {
  const { id } = req.body;
  try {
    //Get the anket
    const anketResult = await pool.query(getAnketByIdQuery, [id]);

    if (anketResult.rowCount === 0) {
      return res.status(404).send("No survey found with this id");
    }

    const anket = anketResult.rows;

    //Get questions, options, and documents for the survey
    const { sorular, documents: anketDocuments } = await getSorularByAnketId(
      id
    );
    anket.sorular = sorular;
    anket.documents = anketDocuments;

    res.status(200).json({ status: 200, data: anket });
  } catch (error) {
    console.error(
      "Error retrieving survey, questions, options, and documents",
      error.stack
    );
    res.status(500).send("Error retrieving survey");
  }
};
const getAnket = async (req, res) => {
  const { id } = req.body;
  try {
    //Get the anket
    const anketResult = await pool.query(getAnketQuery);
    const anketGenel = await pool.query(getAnketGenelQuery);

    if (anketResult.rowCount === 0) {
      return res.status(404).send("No survey found with this id");
    }

    const anket = anketResult.rows;

    //Get questions, options, and documents for the survey
    const { sorular, documents: anketDocuments } = await getSorularByAnketId(
      id
    );
    anket.sorular = sorular;
    anket.documents = anketDocuments;

    res.status(200).json({ status: 200, data: anket, genel:anketGenel.rows[0] });
  } catch (error) {
    console.error(
      "Error retrieving survey, questions, options, and documents",
      error.stack
    );
    res.status(500).send("Error retrieving survey");
  }
};

const getSorularByAnketId = async (anket_id) => {
  try {
    // Get questions related to the survey
    const sorularResult = await pool.query(getSorularByAnketIdQuery, [
      anket_id,
    ]);
    const sorular = sorularResult.rows;

    //For each question, get its options and documents
    for (let soru of sorular) {
      //Get options
      const siklarResult = await pool.query(getSiklarBySoruIdQuery, [soru.id]);
      soru.siklar = siklarResult.rows;

      //Get documents for this question
      soru.documents = await getDocuments(soru.id);
    
    }

    // Get documents for the survey itself
    const anketDocuments = await getDocuments(anket_id);

    return { sorular, documents: anketDocuments };
  } catch (error) {
    console.error(
      "Error retrieving questions, options, and documents",
      error.stack
    );
    throw error;
  }
};

const getSiklarBySoruId = (soru_id) => {
  return new Promise((resolve, reject) => {
    pool.query(getSiklarBySoruIdQuery, [soru_id], (error, results) => {
      if (error) {
        return reject(error);
      }
      resolve(results.rows);
    });
  });
};

const getDocuments = async (connected_id) => {
  try {
    const result = await pool.query(getDocumentsQuery, [connected_id]);
    return result.rows;
  } catch (error) {
    console.error("Error retrieving documents", error.stack);
    throw error;
  }
};

const getAnketByDepartmentId = async (req, res) => {
  const { department_id, user_id } = req.body;
  try {
    const anketIdsResult = await pool.query(getAnketByDepartmentIdQuery, [
      department_id, user_id
    ]);

    if (anketIdsResult.rowCount === 0) {
      return res.status(404).send("No surveys found for this department");
    }

    res.status(200).json({ status: 200, data: anketIdsResult.rows });
  } catch (error) {
    console.error("Error retrieving surveys for department", error.stack);
    res.status(500).send("Error retrieving surveys for department");
  }
};

const fetchAnketWithDocumentsOnly = async (id) => {
  try {
    const anketResult = await pool.query(getAnketByIdQuery, [id]);
    if (anketResult.rowCount === 0) {
      return null;
    }

    const anket = anketResult.rows[0];
    const anketDocuments = await getDocuments(id);
    anket.documents = anketDocuments;

    return anket;
  } catch (error) {
    console.error("Error retrieving survey", error.stack);
    throw error;
  }
};



router.post("/anket", createAnket)
router.post("/anket/soru", createAnketSoru)
router.post("/anket/user", createuserAnketSoru)
router.post("/anket/soru/update", updateAnketSoru)
router.post("/anket/soru/siklar", createAnketSoruSiklari)
router.post("/anket/soru/siklar/update", updateAnketSoruSiklari)
router.post("/anket/dokuman", uploadDocs.array('files'), createAnketDokuman)
router.post("/anket/singelGet", getAnketById)
router.post("/anket/getAnket", getAnket)
router.post("/anket/getAnketRapor", getAnketRapor)
router.post("/anket/getAnketRaporYuzde", getAnketRaporYuzde)
router.post("/anket/department", getAnketByDepartmentId)

module.exports = router;
