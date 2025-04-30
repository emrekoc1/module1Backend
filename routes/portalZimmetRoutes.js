const express = require('express');
const router = express.Router();

const cors = require('cors');
router.use(cors());

const portalZimmetController = require('../controllers/portalZimmetController');

// POST: Haber ekleme
router.post('/getItems', portalZimmetController.getItemZimmet);
router.post('/postItems', portalZimmetController.postItemZimmet);
router.post('/getItemZimmetByID', portalZimmetController.getItemZimmetByID);
router.post('/putItemZimmet', portalZimmetController.putItemZimmet);
router.post('/postZimmet', portalZimmetController.postZimmet);
router.post('/updateZimmet', portalZimmetController.updateZimmet);
router.post('/getUserItemZimmetControl', portalZimmetController.getUserItemZimmetControl);
router.post('/getItemCategori', portalZimmetController.getItemCategori);
router.post('/getReportGenel', portalZimmetController.getReportGenel);
router.post('/getZimmetUserBy', portalZimmetController.getZimmetUserBy);
router.post('/getZimmetOnayRapor', portalZimmetController.getZimmetOnayRapor);
router.post('/postMailZimmetReplay', portalZimmetController.postMailZimmetReplay);
router.post('/geciciEnvanterGiris', portalZimmetController.geciciEnvanterGiris);
router.post('/geiciMail', portalZimmetController.geciciMailOkuma);
router.post('/birimAltZimmet', portalZimmetController.getGenelHiyerArsiAll);
router.post('/getItemZimmetlerDetail', portalZimmetController.getItemZimmetlerDetail);




module.exports = router;