const pool = require('../db');

const Users = {
  create: async (name, email) => {
    const result = await pool.query(
      'INSERT INTO Users (name, email) VALUES ($1, $2) RETURNING *',
      [name, email]
    );
    return result.rows[0];
  },

  getAll: async () => {
    const result = await pool.query('SELECT * FROM Users');
    return result.rows;
  },

  getById: async (id) => {
    const result = await pool.query('SELECT * FROM Users WHERE id = $1', [id]);
    return result.rows[0];
  },

  update: async (id, name, email) => {
    const result = await pool.query(
      'UPDATE Users SET name = $1, email = $2 WHERE id = $3 RETURNING *',
      [name, email, id]
    );
    return result.rows[0];
  },

  delete: async (id) => {
    await pool.query('DELETE FROM Users WHERE id = $1', [id]);
    return true;
  },

  //Bir kullanıcının zimmetli ürünlerinin detaylı listesi
  getUserDetailedAssignments: async (user_id) => {
    const result = await pool.query(
      `SELECT Items.id, Items.name, Items.description, Units.name AS unit_name, Categories.name AS category_name
       FROM Assignments
       JOIN Items ON Assignments.item_id = Items.id
       JOIN Units ON Items.unit_id = Units.id
       JOIN Categories ON Items.category_id = Categories.id
       WHERE Assignments.user_id = $1 AND Assignments.status = true`,
      [user_id]
    );
    return result.rows;
  },

  //Belirli birimde çalışanların listesi
  getUsersByUnit: async (unit_id) => {
    const result = await pool.query(
      `SELECT DISTINCT Users.id, Users.name, Users.email
       FROM Users
       JOIN Assignments ON Users.id = Assignments.user_id
       JOIN Items ON Assignments.item_id = Items.id
       WHERE Items.unit_id = $1`,
      [unit_id]
    );
    return result.rows;
  }
};


module.exports = Users;