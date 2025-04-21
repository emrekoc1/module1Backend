const express = require('express');
const router = express.Router();
const categoriesController = require('../controllers/categoriesController');

router.post('/', categoriesController.createCategory);
router.get('/', categoriesController.getCategories);
router.get('/:id', categoriesController.getCategoryById);
router.put('/:id', categoriesController.updateCategory);
router.delete('/:id', categoriesController.deleteCategory);

router.get('/:category_id/assigned-items/count', categoriesController.getAssignedItemCountByCategory);
router.get('/:category_id/items', categoriesController.getItemsByCategory);

module.exports = router;
