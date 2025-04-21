const Categories = require('../models/zimmet/Categories');

const createCategory = async (req, res) => {
  const { name, description } = req.body;
  try {
    const category = await Categories.create(name, description);
    res.status(201).json(category);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getCategories = async (req, res) => {
  try {
    const categories = await Categories.getAll();
    res.status(200).json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getCategoryById = async (req, res) => {
  const { id } = req.params;
  try {
    const category = await Categories.getById(id);
    res.status(200).json(category);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const updateCategory = async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  try {
    const category = await Categories.update(id, name, description);
    res.status(200).json(category);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const deleteCategory = async (req, res) => {
  const { id } = req.params;
  try {
    await Categories.delete(id);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getAssignedItemCountByCategory = async (req, res) => {
  const { category_id } = req.params;
  try {
    const count = await Categories.getAssignedItemCountByCategory(category_id);
    res.status(200).json({ count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getItemsByCategory = async (req, res) => {
  const { category_id } = req.params;
  try {
    const items = await Categories.getItemsByCategory(category_id);
    res.status(200).json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  getAssignedItemCountByCategory,
  getItemsByCategory
};
