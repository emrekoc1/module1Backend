const express = require('express');
const router = express.Router();

const cors = require('cors');
router.use(cors());

const portalHaberController = require('../controllers/portalHaberController');

// POST: Haber ekleme
router.post('/haber', portalHaberController.createHaber);

// PUT: Haber güncelleme
router.post('/haber/updateDokuman', portalHaberController.updateHaberDokuman);
router.post('/haber/update', portalHaberController.updateHaber);
router.post('/haber/userRead', portalHaberController.userReadHaber);

// GET: Tüm haberleri getirme
router.get('/haber', portalHaberController.getAllHaber);

module.exports = router;