const pool = require('../db');
const portal_pool = require('../portal_db');
const { create } = require('xmlbuilder2');
const sql = require('mssql'); // Ensure sql from mssql is imported
const path = require('path');
const transliteration = require('transliteration');
const multer = require('multer');
const { sqls, poolPromise } = require('../msPortalDB'); // MSSQL yapılandırması

const taskDokuman = multer.diskStorage({


  destination: (req, file, callBack) => {
    const destinationPath = path.join(__dirname, '..', '..', '..', '..', '..', '..', 'wamp64', 'www', 'assets', 'images', 'anket');
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
const updateCariToDoQuery = `
UPDATE s_cari_todo SET aciklama = $1,is_delete=$2,status=$3,finish_date=$4,start_date=$5,update_date=$7,is_active=$8 WHERE id=$6
 `
const insertToDoQuery = `
INSERT INTO s_cari_todo (tiger_kod, cari_id, aciklama, is_delete, is_active, user_id, user_name, status, finish_date, start_date) 
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *
`
const insertToDoUserQuery = `
INSERT INTO s_cari_todo_user (s_cari_todo_id, user_name, is_delete, is_active) 
VALUES ($1,$2,$3,$4) RETURNING *
`
const getIsListesiQuery = `
SELECT stodo.*
      FROM s_cari_todo stodo 
      WHERE 
      (select id FROM s_cari WHERE tiger_kod=$1 )= stodo.cari_id 
       AND stodo.is_active=true AND stodo.status != 2 
   `
const updateFlowYorum = `UPDATE tiger_cari_is_list SET firma_yorum= @yorum WHERE tiger_kod=@tiger_kod`
const updateFlowIsListesi = `UPDATE tiger_cari_is_list SET is_listesi= @is_listesi WHERE tiger_kod=@tiger_kod`
const updateToDoUserQuery = `
UPDATE s_cari_todo_user SET s_cari_todo_id=$2, user_name=$3, is_delete=$4, is_active=$5 where id = $1 RETURNING *
`
const searchCariQuery = `SELECT * FROM s_cari sc WHERE sc.tiger_kod like '320%' AND (sc.name LIKE $1 OR sc.tiger_kod LIKE $2)`;
const getCariRaporGkQuery = `
SELECT (SELECT  json_agg(ana_veri ) FROM (SELECT sc.name, SUM(guk.gelen_miktar) as gelen,SUM(guk.kabul) as kabul, SUM(guk.ogk) as sartli, SUM(guk.iade) as iade,SUM(guk.rework) as rework 
FROM gk_urun_kontrol guk INNER JOIN s_cari sc ON guk.cari=sc.id WHERE guk.kalite_tur=$3 AND guk.created_date BETWEEN $1 AND $2 GROUP BY guk.cari,sc.name ORDER BY  gelen DESC)  ana_veri)  as ana_veri,
(SELECT json_agg(mekanik_urun) FROM ((SELECT sc.name, SUM(guk.gelen_miktar) as gelen,SUM(guk.kabul) as kabul, SUM(guk.ogk) as sartli, SUM(guk.iade) as iade,SUM(guk.rework) as rework 
FROM gk_urun_kontrol guk INNER JOIN s_cari sc ON guk.cari=sc.id WHERE guk.kalite_tur=$3 AND guk.created_date BETWEEN $1 AND $2 AND guk.tur=1  GROUP BY guk.cari,sc.name ORDER BY  gelen DESC))mekanik_urun) as mekanik_urun,
(SELECT json_agg(sarf_urun) FROM ((SELECT sc.name, SUM(guk.gelen_miktar) as gelen,SUM(guk.kabul) as kabul, SUM(guk.ogk) as sartli, SUM(guk.iade) as iade,SUM(guk.rework) as rework 
FROM gk_urun_kontrol guk INNER JOIN s_cari sc ON guk.cari=sc.id WHERE guk.kalite_tur=$3 AND guk.created_date BETWEEN $1 AND $2 AND guk.tur=2  GROUP BY guk.cari,sc.name ORDER BY  gelen DESC))sarf_urun) as sarf_urun,
(SELECT json_agg(elektronik) FROM ((SELECT sc.name, SUM(guk.gelen_miktar) as gelen,SUM(guk.kabul) as kabul, SUM(guk.ogk) as sartli, SUM(guk.iade) as iade,SUM(guk.rework) as rework 
FROM gk_urun_kontrol guk INNER JOIN s_cari sc ON guk.cari=sc.id WHERE guk.kalite_tur=$3 AND guk.created_date BETWEEN $1 AND $2 AND guk.tur=3  GROUP BY guk.cari,sc.name ORDER BY  gelen DESC))elektronik) as elektronik,
(SELECT json_agg(optik) FROM ((SELECT sc.name, SUM(guk.gelen_miktar) as gelen,SUM(guk.kabul) as kabul, SUM(guk.ogk) as sartli, SUM(guk.iade) as iade,SUM(guk.rework) as rework 
FROM gk_urun_kontrol guk INNER JOIN s_cari sc ON guk.cari=sc.id WHERE guk.kalite_tur=$3 AND guk.created_date BETWEEN $1 AND $2 AND guk.tur=4  GROUP BY guk.cari,sc.name ORDER BY  gelen DESC))optik) as optik,
(SELECT json_agg(proje_urun) FROM ((SELECT  guk.proje, SUM(guk.gelen_miktar) as gelen,SUM(guk.kabul) as kabul, SUM(guk.ogk) as sartli, SUM(guk.iade) as iade,SUM(guk.rework) as rework 
FROM gk_urun_kontrol guk  WHERE guk.kalite_tur=$3 AND guk.created_date BETWEEN $1 AND $2   GROUP BY guk.proje ORDER BY  gelen DESC))proje_urun) as proje_urun
`;
const selectCariKontrolQuery = `
SELECT 
    SUM(gelen_miktar) AS gelen,
    SUM(kabul) AS kabul,
    SUM(ogk) AS sartli_kabul, 
    SUM(iade) AS iade, 
    SUM(rework) AS rework,
    -- Subquery 1: Stock-based JSON aggregation
    (SELECT json_agg(kontrol_urun) 
     FROM (
         SELECT 
             SUM(gelen_miktar) AS gelen,
             SUM(kabul) AS kabul,
             SUM(ogk) AS sartli_kabul, 
             SUM(iade) AS iade, 
             SUM(rework) AS rework,
             uk.stok_no,
             uk.stok_aciklama 
         FROM gk_urun_kontrol uk  
         WHERE cari = $1 AND uk.kalite_tur =$4
           AND created_date BETWEEN $2 AND $3 
         GROUP BY stok_no, stok_aciklama
     ) kontrol_urun
    ) AS kontrol_urun,
    -- Subquery 2: Date-based JSON aggregation
    (SELECT json_agg(kontrol_urun) 
     FROM (
         SELECT 
             SUM(gelen_miktar) AS gelen,
             SUM(kabul) AS kabul,
             SUM(ogk) AS sartli_kabul, 
             SUM(iade) AS iade, 
             SUM(rework) AS rework,
             created_date::date AS tarih -- Group by date only
         FROM gk_urun_kontrol uk  
         WHERE cari = $1 AND uk.kalite_tur =$4
           AND created_date BETWEEN $2 AND $3 
         GROUP BY created_date::date
     ) kontrol_urun
    ) AS tarih_urun
FROM gk_urun_kontrol 
WHERE cari = $1
  AND created_date BETWEEN $2 AND $3;
`;
const updateToDoCommentQuery = `
UPDATE s_cari_todo_comment
	SET sub_comment_id=$1, s_cari_todo_id=$2, user_id=$3, user_name=$4, comment=$5, is_delete=$6
	WHERE id=$7 RETURNING *
  `
const insertToDoCommentQuery = `
INSERT INTO s_cari_todo_comment (s_cari_todo_id, user_id, user_name, comment,is_delete) 
VALUES ($1,$2,$3,$4,$5) RETURNING *
`
const putCariYorumQuery = `
UPDATE s_cari
	SET  yorum=$3
	WHERE  id=$1 AND tiger_kod=$2
`
const uploadDocs = multer({ storage: taskDokuman })
function jsonToXml(json) {
  const xml = create({ version: '1.0' })
    .ele('root')
    .ele(json)
    .end({ prettyPrint: true });
  return xml;
}

exports.getCariSearch = async (req, res) => {
  const { deger } = req.body;
  
  try {
    // Fetch data from PostgreSQL

    const result = await pool.query(searchCariQuery, [`%${deger}%`, `%${deger}%`]);
    
    res.status(200).json({ status: 200, data: result.rows});

  } catch (error) {
    res.status(400).json({ message: error.message });
  } 
};

exports.getCariRaporGK = async (req, res) => {
  const { start_date,finish_date,kalite_tur } = req.body;
  
  try {
  
    console.log(req.body)
    const startDate = new Date(start_date).toISOString();
    const finishDate = new Date(finish_date).toISOString();
    const result = await pool.query(getCariRaporGkQuery, [startDate, finishDate,kalite_tur]);
    
    res.status(200).json({ status: 200, data: result.rows});

  } catch (error) {
    res.status(400).json({ message: error.message });
  } 
};
exports.selectCariKontrol = async (req, res) => {
  const { cari_id, start_date, finish_date,kalite_tur } = req.body; // Extract parameters from the request body
  
  try {
    // Execute the parameterized query
    console.log(cari_id, start_date, finish_date,kalite_tur)
    const result = await pool.query(selectCariKontrolQuery, [cari_id, start_date, finish_date,kalite_tur]);
    
    // Respond with the query results
    res.status(200).json({ status: 200, data: result.rows });
  } catch (error) {
    // Log and respond with an error
    console.error("Error executing query:", error.message);
    res.status(400).json({ message: error.message });
  }
};
exports.getSingleCari = async (req, res) => {
  const { name } = req.body;

  try {
    // Fetch data from PostgreSQL
    const result = await pool.query(`SELECT * FROM s_cari WHERE name like '%${name}%' AND tiger_kod like '%320.%'`);


    
    res.status(200).json({ status: 200, data: result.rows });
  } catch (error) {
    res.status(400).json({ message: error.message });
  } finally {
    portal_pool.close(); // Close MSSQL connection after operation is complete
  }
};
exports.getAllCari = async (req, res) => {
  const { deger, totalVer } = req.body;

  try {
    // Fetch data from PostgreSQL
    const result = await pool.query(`SELECT * FROM (
      SELECT sc.*, 
        (ROUND(CAST((select SUM(birim_deger) FROM
 (SELECT (AVG(puan)*
		  (SELECT carpan FROm gk_birim_carpan carpan WHERE carpan.birim_id = tp.birim_id))/100 as birim_deger,
  birim_id FROM gk_tedarikci_puan tp WHERE  sc.id = tp.cari_id GROUP BY birim_id) as puan) as NUMERIC) ,2)) AS ortalama,
        (
          SELECT json_agg(todo) 
          FROM (
            SELECT stodo.*,
              (
                SELECT json_agg(todo_aciklama) 
                FROM (
                  SELECT sctc.* 
                  FROM s_cari_todo_comment sctc 
                  WHERE sctc.s_cari_todo_id = stodo.id
                ) todo_aciklama
              ) AS yorum,
              (
                SELECT json_agg(todo_users) 
                FROM (
                  SELECT sctu.* 
                  FROM s_cari_todo_user sctu 
                  WHERE sctu.s_cari_todo_id = stodo.id AND sctu.is_delete = false
                ) todo_users
              ) AS users
            FROM s_cari_todo stodo 
            WHERE sc.id = stodo.cari_id 
            and stodo.is_active=true AND stodo.is_delete=false
            ORDER BY 
              CASE 
                WHEN stodo.status = 1 THEN 1 
                WHEN stodo.status = 0 THEN 2 
                WHEN stodo.status = 2 THEN 3 
                WHEN stodo.status = 3 THEN 4 
                ELSE 5 
              END
          ) todo
        ) AS todos
      FROM s_cari sc 
      ORDER BY ortalama DESC
    ) AS subquery ${deger}`);



    const resultCount = await pool.query(`SELECT count(*) as total_veri FROM s_cari ${totalVer}`);
    res.status(200).json({ status: 200, data: result.rows, total: resultCount.rows[0].total_veri });
  } catch (error) {
    res.status(400).json({ message: error.message });
  } finally {
    portal_pool.close(); // Close MSSQL connection after operation is complete
  }
};
exports.postCariToDo = async (req, res) => {
  const { tiger_kod, cari_id, aciklama, is_delete, is_active, user_id, user_name, status, finish_date, start_date } = req.body
  try {
    const result = await pool.query(insertToDoQuery, [tiger_kod, cari_id, aciklama, is_delete, is_active, user_id, user_name, status, finish_date, start_date])
    res.status(200).json({
      status: 200,
      data: result.rows[0]
    })
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}
exports.putCariYorum = async (req, res) => {
  const { tiger_kod, cari_id, yorum } = req.body
  try {
    const result = await pool.query(putCariYorumQuery, [cari_id, tiger_kod, yorum])
    const mssqlPool = await poolPromise; // MSSQL bağlantısı
    const flowDataGuncelle = mssqlPool.request();

    flowDataGuncelle.input('yorum', yorum);
    flowDataGuncelle.input('tiger_kod', tiger_kod);
    const flowDataGuncelemeResult = await flowDataGuncelle.query(updateFlowYorum);

    res.status(200).json({
      status: 200,
      data: result.rows[0]
    })
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}
exports.putCariToDo = async (req, res) => {
  const { aciklama, is_delete, status, finish_date, start_date, id, update_date, tiger_kod,is_active
   } = req.body
  try {
    console.log(req.body)
    const result = await pool.query(updateCariToDoQuery, [aciklama, is_delete, parseInt(status), finish_date, start_date, id, update_date,is_active])
    const mssqlPool = await poolPromise; // MSSQL bağlantısı
    const resultIsListesiResult = await pool.query(getIsListesiQuery, [tiger_kod])
    let is_listesi=""
    resultIsListesiResult.rows.forEach(element => {
      is_listesi += `${element.aciklama} | ${(element.status == 0 ? "Bekliyor" : (element.status == 1 ? "Devam Ediyor" : "Kapatıldı"))};'\n''\t'`;
    });
    const flowDataGuncelle = mssqlPool.request();
    flowDataGuncelle.input('is_listesi', is_listesi);
    flowDataGuncelle.input('tiger_kod', tiger_kod);
    const flowDataGuncelemeResult = await flowDataGuncelle.query(updateFlowIsListesi);

    res.status(200).json({
      status: 200,
      data: result.rows[0]
    })
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}
exports.putCariToDoUser = async (req, res) => {
  const { s_cari_todo_id, user_name, is_delete, is_active, id } = req.body
  try {
    const result = await pool.query(updateToDoUserQuery, [id, s_cari_todo_id, user_name, is_delete, is_active])
    res.status(200).json({
      status: 200,
      data: result.rows[0]
    })
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}
exports.putCariToDoComment = async (req, res) => {
  const { sub_comment_id, s_cari_todo_id, user_id, user_name, comment, is_delete, id } = req.body
  try {
    const result = await pool.query(updateToDoCommentQuery, [sub_comment_id, s_cari_todo_id, user_id, user_name, comment, is_delete, id])
    res.status(200).json({
      status: 200,
      data: result.rows[0]
    })
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}
exports.postCariToDoUser = async (req, res) => {
  const { s_cari_todo_id, user_name, is_delete, is_active } = req.body
  try {
    console.log(req.body)
    const result = await pool.query(insertToDoUserQuery, [s_cari_todo_id, user_name, is_delete, is_active])
    res.status(200).json({
      status: 200,
      data: result.rows[0]
    })
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}
exports.postCariToDoComment = async (req, res) => {
  const { s_cari_todo_id, user_id, user_name, comment, is_delete } = req.body
  try {
    const result = await pool.query(insertToDoCommentQuery, [s_cari_todo_id, user_id, user_name, comment, is_delete])
    res.status(200).json({
      status: 200,
      data: result.rows[0]
    })
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}
exports.getAllCariByID = async (req, res) => {
  const { id } = req.body
  console.log(req.body)
  try {

    const result = await pool.query(`SELECT sc.*,COALESCE((SELECT AVG(puan)as ortalama FROM s_cari_puan scp WHERE scp.cari_id = sc.id ),0) as ortalama,
  (
    SELECT json_agg(todo) 
    FROM (
      SELECT stodo.*,
        (
          SELECT json_agg(todo_aciklama) 
          FROM (
            SELECT sctc.* 
            FROM s_cari_todo_comment sctc 
            WHERE sctc.s_cari_todo_id = stodo.id
          ) todo_aciklama
        ) AS yorum,
        (
          SELECT json_agg(todo_users) 
          FROM (
            SELECT sctu.* 
            FROM s_cari_todo_user sctu 
            WHERE sctu.s_cari_todo_id = stodo.id AND sctu.is_delete=false
          ) todo_users
        ) AS users
      FROM s_cari_todo stodo 
      WHERE sc.id = stodo.cari_id AND stodo.is_delete=false AND stodo.is_active=true  ORDER BY 
        CASE 
          WHEN stodo.status = 1 THEN 1 
          WHEN stodo.status = 0 THEN 2 
          WHEN stodo.status = 2 THEN 3 
          WHEN stodo.status = 3 THEN 4 
          ELSE 5 
        END
    ) todo
  ) AS todos
FROM s_cari sc where id=${id} `);

    res.status(200).json({ status: 200, data: result.rows });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};


