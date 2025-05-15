const express = require('express');
const router = express.Router();

const cors = require('cors');
router.use(cors());

const portalMaliyetControl2 = require('../controllers/portalSatinAlmaController');

router.post("/satinAlmaSiparisHesapla", portalMaliyetControl2.satinAlmaSiparisHesapla)


module.exports = router;