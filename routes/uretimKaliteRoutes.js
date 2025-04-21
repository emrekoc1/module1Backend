const express = require('express');
const router = express.Router();

const cors = require('cors');
router.use(cors());

const ureimKaliteControllers = require('../controllers/uretimKaliteController');

// POST: Haber ekleme
router.post('/postUretimKalite', ureimKaliteControllers.postUretimKalite);
router.post('/putUretimKalite', ureimKaliteControllers.putUretimKalite);
router.post('/postUretimKaliteDokuman', ureimKaliteControllers.createKaliteDokuman);
router.post('/putKaliteDokuman', ureimKaliteControllers.putKaliteDokuman);
router.post('/getUretimKalite', ureimKaliteControllers.getUretimKalite);





module.exports = router;