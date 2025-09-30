const express = require('express');
const db = require('../models/db');
const router = express.Router();

router.get('/', async (req, res) => {
  if (!req.session.user) return res.status(401).send('Unauthorized');
  console.log('Search query:', req.query, 'User ID:', req.session.user.id);
  const { q, user } = req.query;
  const userId = req.session.user.id;

  // Build query based on whether we have a search term
  let query, params;
  
  if (q && q.trim()) {
    // Has search term
    const searchParam = `%${q}%`;
    if (user === 'true') {
      // Profile view: search in user's albums only
      params = [searchParam, userId];
      query = `
        SELECT a.id, a.user_id, a.title, a.description, a.upload_date, a.is_public,
               c.cover_url, c.cover_type,
               COALESCE((SELECT COUNT(*)::int FROM media_files mf WHERE mf.album_id = a.id), 0) AS media_count
        FROM albums a
        LEFT JOIN LATERAL (
          SELECT url AS cover_url, type AS cover_type
          FROM media_files m
          WHERE m.album_id = a.id
          ORDER BY m.id ASC
          LIMIT 1
        ) c ON true
        WHERE (a.title ILIKE $1 OR a.description ILIKE $1) AND a.user_id = $2
        ORDER BY a.upload_date DESC
      `;
    } else {
      // Dashboard view: search in all albums
      params = [searchParam];
      query = `
        SELECT a.id, a.user_id, a.title, a.description, a.upload_date, a.is_public,
               c.cover_url, c.cover_type,
               COALESCE((SELECT COUNT(*)::int FROM media_files mf WHERE mf.album_id = a.id), 0) AS media_count
        FROM albums a
        LEFT JOIN LATERAL (
          SELECT url AS cover_url, type AS cover_type
          FROM media_files m
          WHERE m.album_id = a.id
          ORDER BY m.id ASC
          LIMIT 1
        ) c ON true
        WHERE (a.title ILIKE $1 OR a.description ILIKE $1)
        ORDER BY a.upload_date DESC
      `;
    }
  } else {
    // No search term
    if (user === 'true') {
      // Profile view: show user's albums only
      params = [userId];
      query = `
        SELECT a.id, a.user_id, a.title, a.description, a.upload_date, a.is_public,
               c.cover_url, c.cover_type,
               COALESCE((SELECT COUNT(*)::int FROM media_files mf WHERE mf.album_id = a.id), 0) AS media_count
        FROM albums a
        LEFT JOIN LATERAL (
          SELECT url AS cover_url, type AS cover_type
          FROM media_files m
          WHERE m.album_id = a.id
          ORDER BY m.id ASC
          LIMIT 1
        ) c ON true
        WHERE a.user_id = $1
        ORDER BY a.upload_date DESC
      `;
    } else {
      // Dashboard view: show all albums
      params = [];
      query = `
        SELECT a.id, a.user_id, a.title, a.description, a.upload_date, a.is_public,
               c.cover_url, c.cover_type,
               COALESCE((SELECT COUNT(*)::int FROM media_files mf WHERE mf.album_id = a.id), 0) AS media_count
        FROM albums a
        LEFT JOIN LATERAL (
          SELECT url AS cover_url, type AS cover_type
          FROM media_files m
          WHERE m.album_id = a.id
          ORDER BY m.id ASC
          LIMIT 1
        ) c ON true
        ORDER BY a.upload_date DESC
      `;
    }
  }

  const albums = (await db.query(query, params)).rows;
  console.log('Search results:', albums);
  res.json(albums);
});

// Public: list media items for an album (if viewer is owner or album is public)
router.get('/album/:albumId/media', async (req, res) => {
  if (!req.session.user) return res.status(401).send('Unauthorized');
  const albumId = req.params.albumId;
  const albumRes = await db.query('SELECT * FROM albums WHERE id = $1', [albumId]);
  const album = albumRes.rows[0];
  if (!album) return res.status(404).send('Album not found');
  // Enforce password if set and user is not owner/admin
  if (album.album_password && !(req.session.user.role === 'admin' || req.session.user.id === album.user_id || req.session.allowedAlbums?.includes(album.id))) {
    return res.status(403).json({ requiresPassword: true });
  }
  const media = (await db.query('SELECT id, url, type FROM media_files WHERE album_id = $1 ORDER BY id ASC', [albumId])).rows;
  res.json({ album: { id: album.id, title: album.title, description: album.description, is_public: album.is_public, user_id: album.user_id }, media });
});

// Verify album password and grant access in session
router.post('/album/:albumId/access', async (req, res) => {
  if (!req.session.user) return res.status(401).send('Unauthorized');
  const { password } = req.body;
  const albumId = req.params.albumId;
  const albumRes = await db.query('SELECT id, user_id, album_password FROM albums WHERE id = $1', [albumId]);
  const album = albumRes.rows[0];
  if (!album) return res.status(404).send('Album not found');
  if (!album.album_password) return res.json({ granted: true });
  if (password && password === album.album_password) {
    if (!req.session.allowedAlbums) req.session.allowedAlbums = [];
    if (!req.session.allowedAlbums.includes(album.id)) req.session.allowedAlbums.push(album.id);
    return res.json({ granted: true });
  }
  res.status(401).json({ granted: false });
});

// Like/unlike a media item
router.post('/media/:mediaId/like', async (req, res) => {
  if (!req.session.user) return res.status(401).send('Unauthorized');
  const mediaId = req.params.mediaId;
  const userId = req.session.user.id;
  // Ensure media exists and find owner
  const mediaRes = await db.query('SELECT m.id, a.user_id FROM media_files m JOIN albums a ON a.id = m.album_id WHERE m.id = $1', [mediaId]);
  const media = mediaRes.rows[0];
  if (!media) return res.status(404).send('Not found');
  try {
    await db.query('INSERT INTO likes (media_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [mediaId, userId]);
    if (media.user_id !== userId) {
      await db.query('INSERT INTO notifications (user_id, message) VALUES ($1, $2)', [media.user_id, `${req.session.user.username} liked your media.`]);
    }
    res.json({ liked: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to like' });
  }
});

router.post('/media/:mediaId/unlike', async (req, res) => {
  if (!req.session.user) return res.status(401).send('Unauthorized');
  const mediaId = req.params.mediaId;
  const userId = req.session.user.id;
  try {
    await db.query('DELETE FROM likes WHERE media_id = $1 AND user_id = $2', [mediaId, userId]);
    res.json({ liked: false });
  } catch (e) {
    res.status(500).json({ error: 'Failed to unlike' });
  }
});

// Fetch notifications for current user
router.get('/notifications', async (req, res) => {
  if (!req.session.user) return res.status(401).send('Unauthorized');
  const notifications = (await db.query('SELECT id, message, created_at, read FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50', [req.session.user.id])).rows;
  res.json(notifications);
});

// Mark notifications as read
router.post('/notifications/read', async (req, res) => {
  if (!req.session.user) return res.status(401).send('Unauthorized');
  await db.query('UPDATE notifications SET read = TRUE WHERE user_id = $1 AND read = FALSE', [req.session.user.id]);
  res.sendStatus(200);
});

module.exports = router;