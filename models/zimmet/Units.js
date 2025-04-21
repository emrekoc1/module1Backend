const pool = require('../db');
const Units = {
  create: async (name, description) => {
    const result = await pool.query(
      'INSERT INTO Units (name, description) VALUES ($1, $2) RETURNING *',
      [name, description]
    );
    return result.rows[0];
  },

  getAll: async () => {
    const result = await pool.query('SELECT * FROM Units');
    return result.rows;
  },

  getById: async (id) => {
    const result = await pool.query('SELECT * FROM Units WHERE id = $1', [id]);
    return result.rows[0];
  },

  update: async (id, name, description) => {
    const result = await pool.query(
      'UPDATE Units SET name = $1, description = $2 WHERE id = $3 RETURNING *',
      [name, description, id]
    );
    return result.rows[0];
  },

  delete: async (id) => {
    await pool.query('DELETE FROM Units WHERE id = $1', [id]);
    return true;
  },

  //Bir birimde bulunan ürünlerin sayısı
  getItemCountByUnit: async (unit_id) => {
    const result = await pool.query(
      `SELECT COUNT(*) AS item_count 
       FROM Items 
       WHERE unit_id = $1`,
      [unit_id]
    );
    return result.rows[0].item_count;
  },

  //Bir birimde çalışan kullanıcıların sayısı
  getUserCountByUnit: async (unit_id) => {
    const result = await pool.query(
      `SELECT COUNT(DISTINCT Users.id) AS user_count
       FROM Users
       JOIN Assignments ON Users.id = Assignments.user_id
       JOIN Items ON Assignments.item_id = Items.id
       WHERE Items.unit_id = $1`,
      [unit_id]
    );
    return result.rows[0].user_count;
  }
  
};

module.exports = Units;
