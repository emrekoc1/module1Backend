const pool = require('../db');
const Items = {
  create: async (name, description, unit_id, category_id, barcode, brand, model, specifications) => {
    const result = await pool.query(
      `INSERT INTO Items (name, description, unit_id, category_id, barcode, brand, model, specifications)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [name, description, unit_id, category_id, barcode, brand, model, specifications]
    );
    return result.rows[0];
  },

  getAll: async () => {
    const result = await pool.query('SELECT * FROM Items');
    return result.rows;
  },

  getById: async (id) => {
    const result = await pool.query('SELECT * FROM Items WHERE id = $1', [id]);
    return result.rows[0];
  },

  update: async (id, name, description, unit_id, category_id, barcode, brand, model, specifications) => {
    const result = await pool.query(
      `UPDATE Items SET name = $1, description = $2, unit_id = $3, category_id = $4, 
      barcode = $5, brand = $6, model = $7, specifications = $8 WHERE id = $9 RETURNING *`,
      [name, description, unit_id, category_id, barcode, brand, model, specifications, id]
    );
    return result.rows[0];
  },

  delete: async (id) => {
    await pool.query('DELETE FROM Items WHERE id = $1', [id]);
    return true;
  },

  //Belirli bir kategoriye ait ürünlerin detaylı listesi
  getItemsByCategory: async (category_id) => {
    const result = await pool.query(
      `SELECT Items.id, Items.name, Items.description, Units.name AS unit_name, COUNT(Assignments.id) AS assignment_count
       FROM Items
       LEFT JOIN Units ON Items.unit_id = Units.id
       LEFT JOIN Assignments ON Items.id = Assignments.item_id AND Assignments.status = true
       WHERE Items.category_id = $1
       GROUP BY Items.id, Units.name`,
      [category_id]
    );
    return result.rows;
  },

  //Belirli bir birimde bulunan ürünlerin listesi
  getItemsByUnit: async (unit_id) => {
    const result = await pool.query(
      `SELECT Items.id, Items.name, Items.description, Categories.name AS category_name 
       FROM Items
       LEFT JOIN Categories ON Items.category_id = Categories.id
       WHERE Items.unit_id = $1`,
      [unit_id]
    );
    return result.rows;
  },

  //Bir ürünün zimmet durumu
  getItemAssignmentStatus: async (item_id) => {
    const result = await pool.query(
      `SELECT Assignments.status, Assignments.assignment_level, Users.name AS user_name 
       FROM Assignments
       JOIN Users ON Assignments.user_id = Users.id
       WHERE Assignments.item_id = $1`,
      [item_id]
    );
    return result.rows;
  }
};

module.exports = Items;
