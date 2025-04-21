const pool = require('../db');
const Assignments = {
  create: async (item_id, user_id, assignment_level) => {
    const result = await pool.query(
      `INSERT INTO Assignments (item_id, user_id, assignment_level) 
      VALUES ($1, $2, $3) RETURNING *`,
      [item_id, user_id, assignment_level]
    );
    return result.rows[0];
  },

  getAll: async () => {
    const result = await pool.query('SELECT * FROM Assignments');
    return result.rows;
  },

  getById: async (id) => {
    const result = await pool.query('SELECT * FROM Assignments WHERE id = $1', [id]);
    return result.rows[0];
  },

  update: async (id, item_id, user_id, assignment_level, status) => {
    const result = await pool.query(
      `UPDATE Assignments SET item_id = $1, user_id = $2, assignment_level = $3, status = $4
       WHERE id = $5 RETURNING *`,
      [item_id, user_id, assignment_level, status, id]
    );
    return result.rows[0];
  },

  delete: async (id) => {
    await pool.query('DELETE FROM Assignments WHERE id = $1', [id]);
    return true;
  },

  //Bir kişiye kaç adet ürün zimmetli
  getUserAssignmentCount: async (user_id) => {
    const result = await pool.query(
      `SELECT COUNT(*) AS assignment_count 
       FROM Assignments 
       WHERE user_id = $1 AND status = true`,
      [user_id]
    );
    return result.rows[0].assignment_count;
  },

  //Kişi hangi birimde çalışıyor
  getUserUnit: async (user_id) => {
    const result = await pool.query(
      `SELECT DISTINCT Units.id, Units.name, Units.description
       FROM Assignments
       JOIN Items ON Assignments.item_id = Items.id
       JOIN Units ON Items.unit_id = Units.id
       WHERE Assignments.user_id = $1 AND Assignments.status = true
       LIMIT 1`,
      [user_id]
    );
    return result.rows[0];
  },

  //Kişinin ürünlerinin kategorileri
  getUserItemCategories: async (user_id) => {
    const result = await pool.query(
      `SELECT DISTINCT Categories.id, Categories.name, Categories.description
       FROM Assignments
       JOIN Items ON Assignments.item_id = Items.id
       JOIN Categories ON Items.category_id = Categories.id
       WHERE Assignments.user_id = $1 AND Assignments.status = true`,
      [user_id]
    );
    return result.rows;
  },

  //Bir kişiye kaç farklı ürün zimmetli
  getDistinctItemCountByUser: async (user_id) => {
    const result = await pool.query(
      `SELECT COUNT(DISTINCT item_id) AS distinct_item_count 
       FROM Assignments 
       WHERE user_id = $1 AND status = true`,
      [user_id]
    );
    return result.rows[0].distinct_item_count;
  },

  //Bir kişiye zimmetlenen ürün listesi
  getItemsByUser: async (user_id) => {
    const result = await pool.query(
      `SELECT Items.id, Items.name, Items.description, Items.barcode, Categories.name AS category_name, Assignments.assignment_level
       FROM Assignments 
       JOIN Items ON Assignments.item_id = Items.id 
       JOIN Categories ON Items.category_id = Categories.id 
       WHERE Assignments.user_id = $1 AND Assignments.status = true`, 
       [user_id]
      );
    return result.rows;
  },

  //Belirli bir zimmet seviyesine göre ürünlerin listesi
  getItemsByAssignmentLevel: async (assignment_level) =>{
    const result = await pool.query(
      `SELECT Items.id, Items.name, Items.description, Users.name AS user_name
       FROM Assignments 
       JOIN Items ON Assignments.item_id = Items.id 
       JOIN Users ON Assignments.user_id = Users.id 
       WHERE Assignments.assignment_level = $1 AND Assignments.status = true`,
      [assignment_level]
    );
    return result.rows;
  }

};

module.exports = Assignments;
