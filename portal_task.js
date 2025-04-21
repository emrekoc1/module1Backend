
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
    callBack(null, `task${tarihDamgasi}${transliteratedName}_${path.extname(file.originalname)}`);

  }

})

const uploadDocs = multer({ storage: taskDokuman })
router.post('/createdProjeTask', cors(), async (req, res) => {
  try {

    let today = new Date();
    let year = today.getFullYear();
    let month = today.getMonth() + 1; // Aylar 0-11 arasında olduğu için 1 ekliyoruz
    let day = today.getDate();

    let production_dates = `${year}-${month}-${day}T${today.getHours()}:${today.getMinutes()}:${today.getSeconds()}Z`;
    let production_dates2 = `${year}-${month}-${day+3}T${today.getHours()}:${today.getMinutes()}:${today.getSeconds()}Z`;

    const { title, creator, notes, startdate, duedate, completed, starred, important, isdeleted, created_date, updated_date, main_id, users, comments } = req.body
 
    let isler = [
      {
        "departman": 11,
        "is_adi": "Malzeme İhtiyaç Planlama"
      },
      {
        "departman": 11,
        "is_adi": "Stok Kontrolü"
      },
      {
        "departman": 11,
        "is_adi": "İnhouse Üretim Kontrolü"
      },
      {
        "departman": 11,
        "is_adi": "İnhouse Üretim "
      },
      {
        "departman": 11,
        "is_adi": "İnhouse Üretilecek Malzemelerin Dış Proses Taleplerinin Açılması"
      },
      {
        "departman": 11,
        "is_adi": "İnhouse Üretilecek Malzemelerin Sevk İşlemleri"
      },
      {
        "departman": 11,
        "is_adi": "Dış Proses Malzemelerin Hizmet Süreçi ( Kaplama,Kaynak,Boya vb.)"
      },
      {
        "departman": 11,
        "is_adi": "Dış Proses Malzemenin Fabrikaya Sevki"
      },
      {
        "departman": 11,
        "is_adi": "Satın Alma Taleplerinin Açılması"
      },
      {
        "departman": 15,
        "is_adi": "Satın Alma Taleplerinin Atanması"
      },
      {
        "departman": 15,
        "is_adi": "Teklif Süreci (Doküman paylaşılması)"
      },
      {
        "departman": 15,
        "is_adi": "Teklif Değerlendirmesi"
      },
      {
        "departman": 15,
        "is_adi": "Yönetim Onayı Sunulması"
      },
      {
        "departman": 15,
        "is_adi": "Satın Alma Siparisinin Bağlanması"
      },
      {
        "departman": 11,
        "is_adi": "Satın Alma Siparis Listesi Oluşturma"
      },
      {
        "departman": 11,
        "is_adi": "Malzeme Bazlı Firma İle İletisime Geçme"
      },
      {
        "departman": 11,
        "is_adi": "Malzeme Takibi"
      },
      {
        "departman": 11,
        "is_adi": "Malzemelerin Üretilmesi"
      },
      {
        "departman": 11,
        "is_adi": "Malzemelerin Varsa Dış Prosese Gönderilmesi"
      },
      {
        "departman": 11,
        "is_adi": "Malzemelerin Varsa Dış Proses Hizmet Süreci"
      },
      {
        "departman": 11,
        "is_adi": "Malzemelerin Fabrikaya Sevki"
      },
      {
        "departman": 29,
        "is_adi": "Malzeme Kontrolü (Adet,İrsaliye,Kg vb.)"
      },
      {
        "departman": 26,
        "is_adi": "Malzeme Ölçümlerini Yapılması (Cmm,kumpas,kaplama vb.)"
      },
      {
        "departman": 7,
        "is_adi": "Malzemelerin Depoya Sevk Edilmesi"
      },
      {
        "departman": 11,
        "is_adi": "Malzemelerin Üretim Hatlarına Tedariği"
      },
      {
        "is_adi": "Üretim Aşamaları"
      },
      {
        "is_adi": "Üretim Aşamaları"
      },
      {
        "is_adi": "Üretim Aşamaları"
      },
      {
        "is_adi": "Test Aşamaları"
      },
      {
        "is_adi": "Test Aşamaları"
      }
    ]
    const userSorgu = await axios.post('http://10.0.0.35:3212/GetUser', {
      // Göndermek istediğiniz veri burada
      key: 'value'
    });
    let userData = userSorgu.data.postUserNot


    // Gelen veriyi işleyin

    const result = await pool.query(
      `INSERT INTO portal_tasks (
        title, creator, notes, startdate, duedate, completed, starred, important, isdeleted, created_date, updated_date, main_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
      [title, creator, notes, production_dates, production_dates2, completed, starred, important, isdeleted, production_dates, production_dates, main_id]
    );
    const insertMainTodo = result.rows[0].id
    for(let item of isler) {
      let production_dates3 = `${year}-${month}-${day}T${today.getHours()}:${today.getMinutes()}:${today.getSeconds()}Z`;
    let production_dates4 = `${year}-${month}-${day+3}T${today.getHours()}:${today.getMinutes()}:${today.getSeconds()}Z`;
      const insertSubTask = await pool.query(
        `INSERT INTO portal_tasks (
          title, creator, notes, startdate, duedate, completed, starred, important, isdeleted, created_date, updated_date, main_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
        [item.is_adi, creator, notes, production_dates3, production_dates4, completed, starred, important, isdeleted, production_dates, production_dates, insertMainTodo]
      );

      const subtaskId = insertSubTask.rows[0].id
      if(item.departman){
        let filtreUser = userData.filter(user => {
          return item.departman == user.departman
        })
        filtreUser.forEach(async userD => {
          const insertUserTask = await pool.query(
            `INSERT INTO portal_task_user (task_id, user_id, user_name, is_deleted, is_active) VALUES ($1, $2, $3, $4, $5)`,
            [subtaskId, userD.user_id, userD.user_name, false, true]
          );
        })
      }
      

    }
        const select = await pool.query(`SELECT task.*,
           (SELECT json_agg(sub) 
            FROM (SELECT pt.*,
                         (SELECT json_agg(files) 
                          FROM (SELECT * 
                                FROM portal_task_dokuman ptd 
                                WHERE ptd.connected_id = pt.id 
                                  AND ptd.is_delete = false 
                                  AND tur = 1) files) as files,
                         (SELECT json_agg(users) 
                          FROM (SELECT * 
                                FROM portal_task_user ptu 
                                WHERE ptu.task_id = pt.id 
                                  AND ptu.is_deleted = false 
                                  AND ptu.is_active = true) users) as users,
                         (SELECT json_agg(com) 
                          FROM (SELECT ptc.*,
                                       (SELECT json_agg(files) 
                                        FROM (SELECT * 
                                              FROM portal_task_dokuman ptd 
                                              WHERE ptd.connected_id = ptc.id 
                                                AND ptd.is_delete = false 
                                                AND tur = 2) files) as files
                                FROM portal_task_comments ptc 
                                WHERE ptc.task_id = pt.id 
                                  AND ptc.is_deleted = false  
                                ORDER BY ptc.created_date DESC) com) as comment
                  FROM portal_tasks pt 
                  WHERE pt.main_id = task.id
                  GROUP BY pt.id order by pt.id) sub) as subTask,
           (SELECT json_agg(files) 
            FROM (SELECT * 
                  FROM portal_task_dokuman ptd 
                  WHERE ptd.connected_id = task.id 
                    AND ptd.is_delete = false 
                    AND tur = 1) files) as files,
           (SELECT json_agg(users) 
            FROM (SELECT * 
                  FROM portal_task_user ptu 
                  WHERE ptu.task_id = task.id 
                    AND ptu.is_deleted = false 
                    AND ptu.is_active = true) users) as users,
           (SELECT json_agg(com) 
            FROM (SELECT ptc.*,
                         (SELECT json_agg(files) 
                          FROM (SELECT * 
                                FROM portal_task_dokuman ptd 
                                WHERE ptd.connected_id = ptc.id 
                                  AND ptd.is_delete = false 
                                  AND tur = 2) files) as files
                  FROM portal_task_comments ptc 
                  WHERE ptc.task_id = task.id 
                    AND ptc.is_deleted = false 
                  ORDER BY ptc.created_date DESC) com) as comment
    FROM portal_tasks task  
    WHERE task.id = ${result.rows[0].id} `)
    res.status(200).json({ status: 200, data: select.rows[0] });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });

  }
})
router.post('/createdTask', cors(), async (req, res) => {
  try {

    let today = new Date();
    let year = today.getFullYear();
    let month = today.getMonth() + 1; // Aylar 0-11 arasında olduğu için 1 ekliyoruz
    let day = today.getDate();

    let production_dates = `${year}-${month}-${day}T${today.getHours()}:${today.getMinutes()}:${today.getSeconds()}Z`;
    const { title, creator, notes, startdate, duedate, completed, starred, important, isdeleted, created_date, updated_date, main_id, users, comments } = req.body
    const result = await pool.query(
      `INSERT INTO portal_tasks (
        title, creator, notes, startdate, duedate, completed, starred, important, isdeleted, created_date, updated_date, main_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
      [title, creator, notes, startdate, duedate, completed, starred, important, isdeleted, production_dates, production_dates, main_id]
    );

    const select = await pool.query(`SELECT task.*,
       (SELECT json_agg(sub) 
        FROM (SELECT pt.*,
                     (SELECT json_agg(files) 
                      FROM (SELECT * 
                            FROM portal_task_dokuman ptd 
                            WHERE ptd.connected_id = pt.id 
                              AND ptd.is_delete = false 
                              AND tur = 1) files) as files,
                     (SELECT json_agg(users) 
                      FROM (SELECT * 
                            FROM portal_task_user ptu 
                            WHERE ptu.task_id = pt.id 
                              AND ptu.is_deleted = false 
                              AND ptu.is_active = true) users) as users,
                     (SELECT json_agg(com) 
                      FROM (SELECT ptc.*,
                                   (SELECT json_agg(files) 
                                    FROM (SELECT * 
                                          FROM portal_task_dokuman ptd 
                                          WHERE ptd.connected_id = ptc.id 
                                            AND ptd.is_delete = false 
                                            AND tur = 2) files) as files
                            FROM portal_task_comments ptc 
                            WHERE ptc.task_id = pt.id 
                              AND ptc.is_deleted = false  
                            ORDER BY ptc.created_date DESC) com) as comment
              FROM portal_tasks pt 
              WHERE pt.main_id = task.id
              GROUP BY pt.id) sub) as subTask,
       (SELECT json_agg(files) 
        FROM (SELECT * 
              FROM portal_task_dokuman ptd 
              WHERE ptd.connected_id = task.id 
                AND ptd.is_delete = false 
                AND tur = 1) files) as files,
       (SELECT json_agg(users) 
        FROM (SELECT * 
              FROM portal_task_user ptu 
              WHERE ptu.task_id = task.id 
                AND ptu.is_deleted = false 
                AND ptu.is_active = true) users) as users,
       (SELECT json_agg(com) 
        FROM (SELECT ptc.*,
                     (SELECT json_agg(files) 
                      FROM (SELECT * 
                            FROM portal_task_dokuman ptd 
                            WHERE ptd.connected_id = ptc.id 
                              AND ptd.is_delete = false 
                              AND tur = 2) files) as files
              FROM portal_task_comments ptc 
              WHERE ptc.task_id = task.id 
                AND ptc.is_deleted = false 
              ORDER BY ptc.created_date DESC) com) as comment
FROM portal_tasks task  
WHERE task.id = ${result.rows[0].id}`)
    res.status(200).json({ status: 200, data: select.rows[0] });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });

  }
})

router.post('/insertTaskUser', cors(), async (req, res) => {
  try {
    const { id, task_id, user_id, user_name, is_deleted, is_active } = req.body;

    if (id) {
      const comment = await pool.query(
        `UPDATE portal_task_user SET task_id = $1, user_id = $2, user_name = $3, is_deleted = $4, is_active = $5 WHERE id = $6`,
        [task_id, user_id, user_name, is_deleted, is_active, id]
      );
    } else {
      const comment = await pool.query(
        `INSERT INTO portal_task_user (task_id, user_id, user_name, is_deleted, is_active) VALUES ($1, $2, $3, $4, $5)`,
        [task_id, user_id, user_name, false, true]
      );
    }

    res.status(200).json({ status: 200, data: "result" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
router.post('/updateTask', cors(), async (req, res) => {
  try {
    let production_dates = moment().tz("Europe/Istanbul").format('YYYY-MM-DDTHH:mm:ss');
    let {
      title,
      creator,
      notes,
      startdate,
      duedate,
      completed,
      starred,
      important,
      isdeleted,
      created_date,
      updated_date,
      main_id,
      status,
      users,
      comments,
      id,
    } = req.body;

    if (startdate) {
      const selectedDate = new Date(startdate.year, startdate.month - 1, startdate.day + 1);
      startdate = selectedDate.toISOString();

    }

    if (duedate) {

      const selectedDatedue = new Date(duedate.year, duedate.month - 1, duedate.day + 1);
      duedate = selectedDatedue.toISOString();
    }
    if (status == 3) {
      completed = true
    }
    const query = `
      UPDATE portal_tasks SET 
      title = $1, 
      creator = $2, 
      notes = $3, 
      startdate = $4, 
      duedate = $5, 
      completed = $6, 
      starred = $7, 
      important = $8, 
      isdeleted = $9, 
      updated_date = $10, 
      main_id = $11,
      status = $13 
      WHERE id = $12
    `;

    const values = [
      title,
      creator,
      notes,
      startdate,
      duedate,
      completed,
      starred,
      important,
      isdeleted,
      production_dates,
      main_id,
      id,
      status
    ];

    const result = await pool.query(query, values);
    const data = result.rows;

    res.status(200).json({ status: 200, data: data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
router.post('/getTaskUserFiltre', cors(), async (req, res) => {
  try {

    const { filter_user } = req.body
    const result = await pool.query(`
    SELECT task.*,
       (SELECT json_agg(sub) 
        FROM (SELECT pt.*,
                     (SELECT json_agg(files) 
                      FROM (SELECT * 
                            FROM portal_task_dokuman ptd 
                            WHERE ptd.connected_id = pt.id 
                              AND ptd.is_delete = false 
                              AND tur = 1) files) as files,
                     (SELECT json_agg(users) 
                      FROM (SELECT * 
                            FROM portal_task_user ptu 
                            WHERE ptu.task_id = pt.id 
                              AND ptu.is_deleted = false 
                              AND ptu.is_active = true) users) as users,
                     (SELECT json_agg(com) 
                      FROM (SELECT ptc.*,
                                   (SELECT json_agg(files) 
                                    FROM (SELECT * 
                                          FROM portal_task_dokuman ptd 
                                          WHERE ptd.connected_id = ptc.id 
                                            AND ptd.is_delete = false 
                                            AND tur = 2) files) as files
                            FROM portal_task_comments ptc 
                            WHERE ptc.task_id = pt.id 
                              AND ptc.is_deleted = false  
                            ORDER BY ptc.created_date DESC) com) as comment
              FROM portal_tasks pt 
              WHERE pt.main_id = task.id
              GROUP BY pt.id) sub) as subTask,
       (SELECT json_agg(files) 
        FROM (SELECT * 
              FROM portal_task_dokuman ptd 
              WHERE ptd.connected_id = task.id 
                AND ptd.is_delete = false 
                AND tur = 1) files) as files,
       (SELECT json_agg(users) 
        FROM (SELECT * 
              FROM portal_task_user ptu 
              WHERE ptu.task_id = task.id 
                AND ptu.is_deleted = false 
                AND ptu.is_active = true) users) as users,
       (SELECT json_agg(com) 
        FROM (SELECT ptc.*,
                     (SELECT json_agg(files) 
                      FROM (SELECT * 
                            FROM portal_task_dokuman ptd 
                            WHERE ptd.connected_id = ptc.id 
                              AND ptd.is_delete = false 
                              AND tur = 2) files) as files
              FROM portal_task_comments ptc 
              WHERE ptc.task_id = task.id 
                AND ptc.is_deleted = false 
              ORDER BY ptc.created_date DESC) com) as comment
FROM portal_tasks task  
INNER JOIN portal_task_user ptu ON ptu.task_id = task.id  
WHERE ptu.user_id IN (${filter_user}) AND ptu.is_deleted = false AND ptu.is_active = true order by id

`);
    const data = result.rows;
    res.status(200).json({ status: 200, data: data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });

  }
})
router.post('/getTask', cors(), async (req, res) => {
  try {


    const result = await pool.query(`
     SELECT task.*,
       (SELECT json_agg(sub) 
        FROM (SELECT pt.*,
                     (SELECT json_agg(files) 
                      FROM (SELECT * 
                            FROM portal_task_dokuman ptd 
                            WHERE ptd.connected_id = pt.id 
                              AND ptd.is_delete = false 
                              AND tur = 1) files) as files,
                     (SELECT json_agg(users) 
                      FROM (SELECT * 
                            FROM portal_task_user ptu 
                            WHERE ptu.task_id = pt.id 
                              AND ptu.is_deleted = false 
                              AND ptu.is_active = true) users) as users,
                     (SELECT json_agg(com) 
                      FROM (SELECT ptc.*,
                                   (SELECT json_agg(files) 
                                    FROM (SELECT * 
                                          FROM portal_task_dokuman ptd 
                                          WHERE ptd.connected_id = ptc.id 
                                            AND ptd.is_delete = false 
                                            AND tur = 2) files) as files
                            FROM portal_task_comments ptc 
                            WHERE ptc.task_id = pt.id 
                              AND ptc.is_deleted = false  
                            ORDER BY ptc.created_date DESC) com) as comment
              FROM portal_tasks pt 
              WHERE pt.main_id = task.id
              GROUP BY pt.id) sub) as subTask,
       (SELECT json_agg(files) 
        FROM (SELECT * 
              FROM portal_task_dokuman ptd 
              WHERE ptd.connected_id = task.id 
                AND ptd.is_delete = false 
                AND tur = 1) files) as files,
       (SELECT json_agg(users) 
        FROM (SELECT * 
              FROM portal_task_user ptu 
              WHERE ptu.task_id = task.id 
                AND ptu.is_deleted = false 
                AND ptu.is_active = true) users) as users,
       (SELECT json_agg(com) 
        FROM (SELECT ptc.*,
                     (SELECT json_agg(files) 
                      FROM (SELECT * 
                            FROM portal_task_dokuman ptd 
                            WHERE ptd.connected_id = ptc.id 
                              AND ptd.is_delete = false 
                              AND tur = 2) files) as files
              FROM portal_task_comments ptc 
              WHERE ptc.task_id = task.id 
                AND ptc.is_deleted = false 
              ORDER BY ptc.created_date DESC) com) as comment
FROM portal_tasks task  
WHERE task.main_id IS NULL;
`);
    const data = result.rows;
    res.status(200).json({ status: 200, data: data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });

  }
})
router.post('/insertTaskComment', cors(), async (req, res) => {
  try {



    let production_dates = moment().tz("Europe/Istanbul").format('YYYY-MM-DDTHH:mm:ss');
    const { message, user_id, is_deleted, task_id, user_name } = req.body;

    const comment = await pool.query(`
      INSERT INTO public.portal_task_comments(
        message, user_id, is_deleted, task_id, created_date, updated_date, user_name
      ) VALUES($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [message, user_id, is_deleted, task_id, production_dates, production_dates, user_name]
    );
    res.status(200).json({ status: 200, data: comment.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})
router.post('/updateTaskComment', cors(), async (req, res) => {
  try {



    let production_dates = moment().tz("Europe/Istanbul").format('YYYY-MM-DDTHH:mm:ss');
    const { message, user_id, is_deleted, task_id, user_name, id } = req.body;
    const comment = await pool.query(`
      UPDATE public.portal_task_comments SET 
        message =$2, user_id =$3, is_deleted =$4, task_id =$5,  updated_date =$6, user_name =$7
      WHERE id = $1 `,
      [id, message, user_id, is_deleted, task_id, production_dates, user_name]
    );
    res.status(200).json({ status: 200, data: id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})
router.post('/insertTodoDokuman', uploadDocs.array('files'), cors(), async (req, res) => {
  try {
    const files = req.files;
    const { tur, connected_id } = req.body;
    if (!files) {
      return res.status(400).json({ error: 'No File' });
    }

    let results = [];
    for (let file of files) {
      let belge_url = `assets/docs/${file.filename}`;
      const result = await pool.query(
        `INSERT INTO public.portal_task_dokuman(url, tur, connected_id, is_delete) 
         VALUES ($1, $2, $3, false) RETURNING id`,
        [belge_url, tur, connected_id]
      );
      results.push(result.rows[0]);
    }
    res.status(200).json({ status: 200, data: results });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})
router.post('/updateTodoDokuman', cors(), async (req, res) => {
  try {
    const { id, is_delete, connected_id } = req.body
    const result = await pool.query(`UPADETE portal_task_dokuman SET
	 connected_id = $2,is_delete = $3 WHERE id = $1`, [id, connected_id, is_delete]);
    const data = result.rows;
    res.status(200).json({ status: 200, data: data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})
router.post('/getTaskForGant', cors(), async (req, res) => {
  try {

const {task_id} = req.body
    const result = await pool.query(`
    SELECT  * FROM portal_tasks WHERE main_id = $1 `,[task_id]);
    const data = result.rows;
    res.status(200).json({ status: 200, data: data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})
router.post('/getTaskOzet', cors(), async (req, res) => {
  try {


    const result = await pool.query(`
    SELECT  COUNT(CASE WHEN completed = true THEN 1 END) AS tamamlanan, 
  COUNT(id) acilan, 
  (SELECT COUNT(DISTINCT user_id) FROM portal_task_user WHERE is_active = true AND is_deleted = false) as gorevli
 FROM portal_tasks task `);
  const userData = await pool.query(`SELECT DISTINCT user_id, user_name FROM portal_task_user WHERE is_deleted= false AND is_active = true`)

    const data = result.rows;
    res.status(200).json({ status: 200, data: data,user:userData.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})


module.exports = router;
