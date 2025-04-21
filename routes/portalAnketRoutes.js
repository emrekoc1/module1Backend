const express = require('express');
const router = express.Router();

const cors = require('cors');
router.use(cors());
const portalAnketController = require('../controllers/portalAnketController');

router.post("/anket", portalAnketController.createAnket)
router.post("/anket/soru", portalAnketController.createAnketSoru)
router.post("/anket/update", portalAnketController.updateAnket)
router.post("/anket/user", portalAnketController.createuserAnketSoru)
router.post("/anket/soru/update", portalAnketController.updateAnketSoru)
router.post("/anket/soru/siklar", portalAnketController.createAnketSoruSiklari)
router.post("/anket/soru/siklar/update", portalAnketController.updateAnketSoruSiklari)
router.post("/anket/dokuman", portalAnketController.createAnketDokuman)
router.post("/anket/singelGet", portalAnketController.getAnketById)
router.post("/anket/departman/update", portalAnketController.updateAnketDepartman)
router.post("/anket/departman/insert", portalAnketController.insertAnketDepartman)
router.post("/anket/getAnket", portalAnketController.getAnket)
router.post("/anket/getAnketRapor", portalAnketController.getAnketRapor)
router.post("/anket/getAnketRaporYuzde", portalAnketController.getAnketRaporYuzde)
router.post("/anket/department", portalAnketController.getAnketByDepartmentId)


// POST: Haber ekleme

module.exports = router;