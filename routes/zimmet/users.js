const express = require('express');
const router = express.Router();
const usersController = require('../controllers/usersController');

router.post('/', usersController.createUser);
router.get('/', usersController.getUsers);
router.get('/:id', usersController.getUserById);
router.put('/:id', usersController.updateUser);
router.delete('/:id', usersController.deleteUser);

router.get('/:user_id/assignments/details', usersController.getUserDetailedAssignments);
router.get('/unit/:unit_id', usersController.getUsersByUnit);

module.exports = router;
