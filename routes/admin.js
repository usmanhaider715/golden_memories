const express = require('express');
const db = require('../models/db');
const router = express.Router();

router.get('/requests', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).send('Forbidden');
  const requests = (await db.query('SELECT * FROM signup_requests')).rows;
  res.json(requests);
});

router.post('/approve/:id', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).send('Forbidden');
  const { id } = req.params;
  const request = (await db.query('SELECT * FROM signup_requests WHERE id = $1', [id])).rows[0];
  if (request) {
    const hashedPassword = request.password;
    await db.query(
      'INSERT INTO users (username, email, password, approved) VALUES ($1, $2, $3, $4)',
      [request.username, request.email, hashedPassword, true]
    );
    await db.query('DELETE FROM signup_requests WHERE id = $1', [id]);
  }
  res.sendStatus(200);
});

router.post('/reject/:id', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).send('Forbidden');
  const { id } = req.params;
  await db.query('DELETE FROM signup_requests WHERE id = $1', [id]);
  res.sendStatus(200);
});

module.exports = router;