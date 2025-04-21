const express = require('express');
const router = express.Router();
const itemsController = require('../controllers/itemsController');

router.post('/', itemsController.createItem);
router.get('/', itemsController.getItems);
router.get('/:id', itemsController.getItemById);
router.put('/:id', itemsController.updateItem);
router.delete('/:id', itemsController.deleteItem);

router.get('/category/:category_id', itemsController.getItemsByCategory);
router.get('/unit/:unit_id', itemsController.getItemsByUnit);
router.get('/:item_id/status', itemsController.getItemAssignmentStatus);

module.exports = router;
