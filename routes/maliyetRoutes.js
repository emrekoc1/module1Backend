const express = require('express');
const router = express.Router();

const cors = require('cors');
router.use(cors());
const portalMaliyetControl = require('../controllers/maliyetController');
// const portalMaliyetControl2 = require('../controllers/maliyetControllerts');
router.post("/indexInsert", portalMaliyetControl.maliyetIndexInsert)
router.post("/depoCekApp", portalMaliyetControl.depoCek)
// router.post("/depoCekApp2", portalMaliyetControl2.depoCek)
router.post("/tekilUrunBirimFiyatUpdate", portalMaliyetControl.maliyetGuncelle)
router.post("/eskiKartEsle", portalMaliyetControl.eskiKartlar)
router.post("/stokGetir", portalMaliyetControl.stokGetir)
router.post("/depoToplamMaliyet", portalMaliyetControl.depoToplamMaliyet)
router.post("/depolarMaliyet", portalMaliyetControl.depolarMaliyet)
router.post("/depoBOMmaliyet", portalMaliyetControl.depoBOMmaliyet)
router.post("/depoBOMHammaddemaliyet", portalMaliyetControl.depoBOMHammaddemaliyet)
router.post("/bomYariMamulMaliyetGet", portalMaliyetControl.bomYariMamulMaliyetGet)
router.post("/depoBOMSarfmaliyet", portalMaliyetControl.depoBOMSarfmaliyet)
router.post("/depoOzelMaliyet", portalMaliyetControl.depoOzel)
router.post("/depoSecilenMaliyet", portalMaliyetControl.depoSecilenMaliyet)
router.post("/bomListesiGetir", portalMaliyetControl.bomListesiGetir)
router.post("/sonHareketBulApp", portalMaliyetControl.sonHareketBulApp)
router.post("/satisUrunGirisi", portalMaliyetControl.satisUrunGirisi)
router.post("/depoHareketAnalizi",portalMaliyetControl.depoHareketAnalizi)
router.post("/depoHareketAnaliziUrunTur",portalMaliyetControl.depoHareketAnaliziUrunTur)
module.exports = router;