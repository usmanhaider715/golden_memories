const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../models/db');
const router = express.Router();

router.post('/signup', async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const existingUser = await db.query('SELECT * FROM signup_requests WHERE username = $1 OR email = $2', [username, email]);
    const existingApproved = await db.query('SELECT * FROM users WHERE username = $1 OR email = $2', [username, email]);
    if (existingUser.rows.length > 0 || existingApproved.rows.length > 0) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    const hashed = bcrypt.hashSync(password, 10);
    await db.query('INSERT INTO signup_requests (username, email, password) VALUES ($1, $2, $3)', [username, email, hashed]);
    res.json({ message: 'Signup request sent' });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = (await db.query('SELECT * FROM users WHERE username = $1 AND approved = TRUE', [username])).rows[0];
  if (user && bcrypt.compareSync(password, user.password)) {
    req.session.user = { id: user.id, role: user.role, username: user.username };
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

router.get('/user', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ id: req.session.user.id, username: req.session.user.username, role: req.session.user.role });
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

module.exports = router;