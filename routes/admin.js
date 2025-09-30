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

// Get all users (admin only)
router.get('/users', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).send('Forbidden');
  const users = (await db.query('SELECT id, username, email, role, approved FROM users ORDER BY id')).rows;
  res.json(users);
});

// Delete user and all their data (admin only) — allowed anytime
router.delete('/users/:id', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).send('Forbidden');
  const { id } = req.params;
  
  // Don't allow admin to delete themselves
  if (parseInt(id) === req.session.user.id) {
    return res.status(400).send('Cannot delete your own account');
  }
  
  try {
    // Get user's albums to delete their media files
    const albums = (await db.query('SELECT id FROM albums WHERE user_id = $1', [id])).rows;
    
    // Delete media files from disk and database
    for (const album of albums) {
      const media = (await db.query('SELECT url FROM media_files WHERE album_id = $1', [album.id])).rows;
      for (const m of media) {
        try {
          const fs = require('fs');
          const path = require('path');
          const filePath = path.join(__dirname, '..', 'public', m.url);
          fs.unlinkSync(filePath);
        } catch (e) {
          // ignore missing files
        }
      }
    }
    
    // Delete all user data (cascading deletes will handle related records)
    await db.query('DELETE FROM users WHERE id = $1', [id]);
    res.sendStatus(200);
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).send('Failed to delete user');
  }
});

module.exports = router;