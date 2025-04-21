const express = require('express');
const router = express.Router();

const cors = require('cors');
router.use(cors());

const portalDuyruController = require('../controllers/portalDuyruController');

router.post("/duyuru", portalDuyruController.createDuyuru)
router.post("/duyuru/update", portalDuyruController.updateDuyuru)
router.post("/duyuru/departman/", portalDuyruController.createdDuyuruDepartman)
router.post("/duyuru/departman/update", portalDuyruController.updateDuyuruDepartman)
router.post("/duyuru/update", portalDuyruController.updateDuyuru)
router.post("/duyuruGet", portalDuyruController.getDuyuru)
router.post("/duyuruForUserGet", portalDuyruController.getDuyuruForUser)
router.post("/postUserNot", portalDuyruController.postUserNot)
router.post("/duyuru/dokuman", portalDuyruController.creatDuyuruDokuman)
router.post("/duyuru/dokuman/update", portalDuyruController.updateDuyuruDokuman)
router.post("/duyuru/singelGet", portalDuyruController.getAnketById)
router.post("/departman", portalDuyruController.getDepartman)
router.post("/duyuru/getRapor", portalDuyruController.getGenelRapor)
router.post("/duyuru/userRead", portalDuyruController.duyurUserRead)

// POST: Haber ekleme

module.exports = router;