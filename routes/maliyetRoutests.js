const express = require('express');
const router = express.Router();

const cors = require('cors');
router.use(cors());

const portalMaliyetControl2 = require('../controllers/maliyetControllerts');

router.get("/depoCekApp2", portalMaliyetControl2.depoCekMaliyet)
router.post("/headerGenelGetir", portalMaliyetControl2.headerGenelGetir)
router.post("/headerBomGetir", portalMaliyetControl2.headerBomGetir)
router.post("/headerDigerGetir", portalMaliyetControl2.headerDigerGetir)
router.post("/getGenelStokVeriLimits", portalMaliyetControl2.getGenelStokVeriLimits)
router.post("/bomMaliyetCalistir", portalMaliyetControl2.bomMaliyetCalistir)

module.exports = router;