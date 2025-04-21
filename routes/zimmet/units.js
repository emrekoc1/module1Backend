const express = require('express');
const router = express.Router();
const unitsController = require('../controllers/unitsController');

router.post('/', unitsController.createUnit);
router.get('/', unitsController.getUnits);
router.get('/:id', unitsController.getUnitById);
router.put('/:id', unitsController.updateUnit);
router.delete('/:id', unitsController.deleteUnit);

router.get('/:unit_id/items/count', unitsController.getItemCountByUnit);
router.get('/:unit_id/users/count', unitsController.getUserCountByUnit);

module.exports = router;
