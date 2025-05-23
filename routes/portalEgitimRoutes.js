const express = require('express');
const router = express.Router();

const cors = require('cors');
router.use(cors());
const portalEgitimController = require('../controllers/portalEgitimController');

// router.post("/egitim", portalEgitimController.createAnket)
router.post("/egitim/orgunEgitimSearch", portalEgitimController.orgunEgitimSearch)
router.post("/egitim/tumEgitimlerRapor", portalEgitimController.tumEgitimlerRapor)
router.post("/egitim/videoListGet", portalEgitimController.videoListGet)
router.post("/egitim/videoListTopluInsert", portalEgitimController.videoListTopluInsert)
router.post("/egitim/tumEgitimlerRaporSicil", portalEgitimController.tumEgitimlerRaporSicil)
router.post("/egitim/videoEgitimRapor", portalEgitimController.videoEgitimRapor)
router.post("/egitim/ahoEgitimRapor", portalEgitimController.ahoEgitimRapor)
router.post("/egitim/updateExSQL", portalEgitimController.updateExSQL)
router.post("/egitim/egitimAdminGet", portalEgitimController.getEgitimAdmin)
router.post("/egitim/createdEgitimAdmin", portalEgitimController.createdEgitim)
router.post("/egitim/getEgitimAdminById", portalEgitimController.getEgitimAdminById)
router.post("/egitim/getEgitimUserById", portalEgitimController.getEgitimUserById)
router.post("/egitim/getEgitimDetailUserById", portalEgitimController.getEgitimDetailUserById)
router.post("/egitim/postEgitimDetailUserById", portalEgitimController.postEgitimDetailUserById)
router.post("/egitim/postEgitimPaunUserById", portalEgitimController.postEgitimPaunUserById)



router.post("/egitim/createdEgitimVideoAdmin", portalEgitimController.createdEgitimVideo) // inserteğitim detail
router.post("/egitim/updateEgitimVideoAdmin", portalEgitimController.updateEgitimVideo)// update eğitim detail 
router.post("/egitim/createdEgitimDokuman", portalEgitimController.createdEgitimDokuman) // inseert egitim deokuman file
router.post("/egitim/updateEgitimDokuman", portalEgitimController.updateEgitimDokuman)  // update egitim dokuman file



// POST: Haber ekleme

module.exports = router;