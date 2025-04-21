const Assignments = require('../models/zimmet/Assignments');

const createAssignment = async (req, res) => {
  const { item_id, user_id, assignment_level } = req.body;
  try {
    const assignment = await Assignments.create(item_id, user_id, assignment_level);
    res.status(201).json(assignment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getAssignments = async (req, res) => {
  try {
    const assignments = await Assignments.getAll();
    res.status(200).json(assignments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getAssignmentById = async (req, res) => {
  const { id } = req.params;
  try {
    const assignment = await Assignments.getById(id);
    res.status(200).json(assignment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const updateAssignment = async (req, res) => {
  const { id } = req.params;
  const { item_id, user_id, assignment_level, status } = req.body;
  try {
    const assignment = await Assignments.update(id, item_id, user_id, assignment_level, status);
    res.status(200).json(assignment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const deleteAssignment = async (req, res) => {
  const { id } = req.params;
  try {
    await Assignments.delete(id);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getUserAssignmentCount = async (req, res) => {
  const { user_id } = req.params;
  try {
    const count = await Assignments.getUserAssignmentCount(user_id);
    res.status(200).json({ count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getUserUnit = async (req, res) => {
  const { user_id } = req.params;
  try {
    const unit = await Assignments.getUserUnit(user_id);
    res.status(200).json(unit);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


const getUserItemCategories = async (req, res) => {
  const { user_id } = req.params;
  try {
    const categories = await Assignments.getUserItemCategories(user_id);
    res.status(200).json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getDistinctItemCountByUser = async (req, res) => {
  const { user_id } = req.params;
  try {
    const count = await Assignments.getDistinctItemCountByUser(user_id);
    res.status(200).json({ count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getItemsByUser = async (req, res) => {
  const { user_id } = req.params;
  try {
    const items = await Assignments.getItemsByUser(user_id);
    res.status(200).json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getItemsByAssignmentLevel = async (req, res) => {
  const { assignment_level } = req.params;
  try {
    const items = await Assignments.getItemsByAssignmentLevel(assignment_level);
    res.status(200).json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


module.exports = {
  createAssignment,
  getAssignments,
  getAssignmentById,
  updateAssignment,
  deleteAssignment,
  getUserAssignmentCount,
  getUserUnit,
  getUserItemCategories,
  getDistinctItemCountByUser,
  getItemsByUser,
  getItemsByAssignmentLevel
};
