const express = require('express');
const { pool } = require('../db');
const { validateEmployee } = require('../validate');

const router = express.Router();

// GET /api/employees -> list all employees, newest first
router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, first_name, last_name, email, phone, department, designation,
              DATE_FORMAT(date_of_joining, '%Y-%m-%d') AS date_of_joining, created_at
         FROM employees
        ORDER BY created_at DESC, id DESC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/employees -> create an employee
router.post('/', async (req, res, next) => {
  try {
    const { errors, data } = validateEmployee(req.body || {});
    if (errors.length) {
      return res.status(400).json({ errors });
    }

    const [result] = await pool.execute(
      `INSERT INTO employees
         (first_name, last_name, email, phone, department, designation, date_of_joining)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [data.first_name, data.last_name, data.email, data.phone || null,
       data.department, data.designation, data.date_of_joining]
    );

    res.status(201).json({ id: result.insertId, ...data });
  } catch (err) {
    // ER_DUP_ENTRY = MySQL error for a UNIQUE violation (duplicate email)
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ errors: ['An employee with this email already exists.'] });
    }
    next(err);
  }
});

// DELETE /api/employees/:id -> remove an employee
router.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ errors: ['Invalid employee id.'] });
    }
    const [result] = await pool.execute('DELETE FROM employees WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ errors: ['Employee not found.'] });
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
