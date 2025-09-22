const express = require('express');
const db = require('../models/db');
const router = express.Router();

router.get('/', async (req, res) => {
  if (!req.session.user) return res.status(401).send('Unauthorized');
  console.log('Search query:', req.query, 'User ID:', req.session.user.id);
  const { q, user } = req.query;
  const userId = req.session.user.id;
  let query = `
    SELECT a.*, m.url, m.type 
    FROM albums a 
    LEFT JOIN media_files m ON a.id = m.album_id
    WHERE (a.title ILIKE $1 OR a.description ILIKE $1)
  `;
  const params = [`%${q || ''}%`];
  
  if (user === 'true') {
    query += ' AND a.user_id = $2';
    params.push(userId);
  } else {
    query += ' AND (a.is_public = TRUE OR a.user_id = $2)';
    params.push(userId);
  }
  
  query += ' ORDER BY a.upload_date DESC';
  const albums = (await db.query(query, params)).rows;
  console.log('Search results:', albums);
  res.json(albums);
});

module.exports = router;