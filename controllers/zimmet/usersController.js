const Users = require('../models/zimmet/Users');

const createUser = async (req, res) => {
  const { name, email } = req.body;
  try {
    const user = await Users.create(name, email);
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getUsers = async (req, res) => {
  try {
    const users = await Users.getAll();
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getUserById = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await Users.getById(id);
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const updateUser = async (req, res) => {
  const { id } = req.params;
  const { name, email } = req.body;
  try {
    const user = await Users.update(id, name, email);
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    await Users.delete(id);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getUserDetailedAssignments = async (req, res) => {
  const { user_id } = req.params;
  try {
    const assignments = await Users.getUserDetailedAssignments(user_id);
    res.status(200).json(assignments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getUsersByUnit = async (req, res) => {
  const { unit_id } = req.params;
  try {
    const users = await Users.getUsersByUnit(unit_id);
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  getUserDetailedAssignments,
  getUsersByUnit
};
