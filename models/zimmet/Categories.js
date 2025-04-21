const pool = require('../db');
const Categories = {
  create: async (name, description) => {
    const result = await pool.query(
      'INSERT INTO Categories (name, description) VALUES ($1, $2) RETURNING *',
      [name, description]
    );
    return result.rows[0];
  },

  getAll: async () => {
    const result = await pool.query('SELECT * FROM Categories');
    return result.rows;
  },

  getById: async (id) => {
    const result = await pool.query('SELECT * FROM Categories WHERE id = $1', [id]);
    return result.rows[0];
  },

  update: async (id, name, description) => {
    const result = await pool.query(
      'UPDATE Categories SET name = $1, description = $2 WHERE id = $3 RETURNING *',
      [name, description, id]
    );
    return result.rows[0];
  },

  delete: async (id) => {
    await pool.query('DELETE FROM Categories WHERE id = $1', [id]);
    return true;
  },

  //Bir kategorideki zimmetli ürün sayısı
  getAssignedItemCountByCategory: async (category_id) => {
    const result = await pool.query(
      `SELECT COUNT(Assignments.id) AS assigned_count
       FROM Items
       LEFT JOIN Assignments ON Items.id = Assignments.item_id AND Assignments.status = true
       WHERE Items.category_id = $1`,
      [category_id]
    );
    return result.rows[0].assigned_count;
  },

  //Bir kategorideki ürünlerin listesi
  getItemsByCategory: async (category_id) => {
    const result = await pool.query(
      `SELECT Items.id, Items.name, Items.description 
       FROM Items 
       WHERE category_id = $1`,
      [category_id]
    );
    return result.rows;
  }
};

module.exports = Categories;
