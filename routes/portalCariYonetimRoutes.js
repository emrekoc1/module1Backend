const express = require('express');
const router = express.Router();

const cors = require('cors');
router.use(cors());
const portalCariYonetimController = require('../controllers/portalCariYonetimController');

router.post("/getAllCari", portalCariYonetimController.getAllCari)
router.post("/getAllCariByID", portalCariYonetimController.getAllCariByID)
router.post("/postCariToDo", portalCariYonetimController.postCariToDo)
router.post("/postCariToDoUser", portalCariYonetimController.postCariToDoUser)
router.post("/postCariToDoComment", portalCariYonetimController.postCariToDoComment)
router.post("/putCariToDo", portalCariYonetimController.putCariToDo)
router.post("/putCariToDoComment", portalCariYonetimController.putCariToDoComment)
router.post("/putCariToDoUser", portalCariYonetimController.putCariToDoUser)
router.post("/putCariYorum", portalCariYonetimController.putCariYorum)
router.post("/getCariSearch", portalCariYonetimController.getCariSearch)
router.post("/selectCariKontrol", portalCariYonetimController.selectCariKontrol)
router.post("/getCariRaporGK", portalCariYonetimController.getCariRaporGK)
router.post("/getSingleCari", portalCariYonetimController.getSingleCari)



// POST: Haber ekleme

module.exports = router;