const Units = require('../models/zimmet/Units');

const createUnit = async (req, res) => {
  const { name, description } = req.body;
  try {
    const unit = await Units.create(name, description);
    res.status(201).json(unit);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getUnits = async (req, res) => {
  try {
    const units = await Units.getAll();
    res.status(200).json(units);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getUnitById = async (req, res) => {
  const { id } = req.params;
  try {
    const unit = await Units.getById(id);
    res.status(200).json(unit);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const updateUnit = async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  try {
    const unit = await Units.update(id, name, description);
    res.status(200).json(unit);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const deleteUnit = async (req, res) => {
  const { id } = req.params;
  try {
    await Units.delete(id);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getItemCountByUnit = async (req, res) => {
  const { unit_id } = req.params;
  try {
    const count = await Units.getItemCountByUnit(unit_id);
    res.status(200).json({ count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getUserCountByUnit = async (req, res) => {
  const { unit_id } = req.params;
  try {
    const count = await Units.getUserCountByUnit(unit_id);
    res.status(200).json({ count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  createUnit,
  getUnits,
  getUnitById,
  updateUnit,
  deleteUnit,
  getItemCountByUnit,
  getUserCountByUnit
};