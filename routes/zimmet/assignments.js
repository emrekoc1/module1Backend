const express = require('express');
const router = express.Router();
const assignmentsController = require('../controllers/assignmentsController');

router.post('/', assignmentsController.createAssignment);
router.get('/', assignmentsController.getAssignments);
router.get('/:id', assignmentsController.getAssignmentById);
router.put('/:id', assignmentsController.updateAssignment);
router.delete('/:id', assignmentsController.deleteAssignment);

router.get('/user/:user_id/count', assignmentsController.getUserAssignmentCount);
router.get('/user/:user_id/unit', assignmentsController.getUserUnit);
router.get('/user/:user_id/categories', assignmentsController.getUserItemCategories);
router.get('/user/:user_id/distinct-items', assignmentsController.getDistinctItemCountByUser);
router.get('/user/:user_id/items', assignmentsController.getItemsByUser);
router.get('/level/:assignment_level/items', assignmentsController.getItemsByAssignmentLevel);

module.exports = router;
