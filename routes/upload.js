const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../models/db');
const router = express.Router();

// Local disk storage for uploads
const uploadsRoot = path.join(__dirname, '..', 'public', 'uploads');
const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, uploadsRoot);
	},
	filename: (req, file, cb) => {
		const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
		const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
		cb(null, `${unique}-${safeName}`);
	}
});
const upload = multer({ storage });

const USER_STORAGE_QUOTA = 500 * 1024 * 1024; // 500 MB

router.post('/album', (req, res) => {
  if (!req.session.user) return res.status(401).send('Unauthorized');
  const { title, description, is_public, album_password } = req.body;
  const userId = req.session.user.id;
  // Default new albums to public unless explicitly set false (admins can still control)
  const publicFlag = req.session.user.role === 'admin' ? !!is_public : (is_public === false ? false : true);
  db.query('INSERT INTO albums (title, description, user_id, is_public, album_password) VALUES ($1, $2, $3, $4, $5) RETURNING id', [title, description, userId, publicFlag, album_password || null])
    .then(result => res.json({ albumId: result.rows[0].id }))
    .catch(err => res.status(500).send(err));
});

router.post('/media/:albumId', upload.single('file'), async (req, res) => {
  if (!req.session.user) return res.status(401).send('Unauthorized');
  try {
    if (!req.file) return res.status(400).send('No file uploaded');
    const file = req.file;
    const type = file.mimetype && file.mimetype.startsWith('image') ? 'image' : 'video';
    const publicUrl = `/uploads/${path.basename(file.path)}`;
    // Enforce per-user quota
    const ownerRes = await db.query('SELECT user_id FROM albums WHERE id = $1', [req.params.albumId]);
    const ownerId = ownerRes.rows[0]?.user_id;
    if (!ownerId) return res.status(404).send('Album not found');
    const usageRes = await db.query(`
      SELECT COALESCE(SUM(size_bytes),0) AS used
      FROM media_files mf
      JOIN albums a ON a.id = mf.album_id
      WHERE a.user_id = $1
    `, [ownerId]);
    const used = Number(usageRes.rows[0].used);
    if (used + file.size > USER_STORAGE_QUOTA) {
      // remove just-uploaded file since we won't keep it
      try { fs.unlinkSync(file.path); } catch(e) {}
      return res.status(413).send('User storage quota exceeded');
    }
    await db.query('INSERT INTO media_files (album_id, type, url, size_bytes) VALUES ($1, $2, $3, $4)', [req.params.albumId, type, publicUrl, file.size]);
    res.json({ url: publicUrl });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).send('Upload failed');
  }
});

// Usage endpoint
router.get('/usage/me', async (req, res) => {
  if (!req.session.user) return res.status(401).send('Unauthorized');
  const r = await db.query(`
    SELECT COALESCE(SUM(size_bytes),0) AS used
    FROM media_files mf
    JOIN albums a ON a.id = mf.album_id
    WHERE a.user_id = $1
  `, [req.session.user.id]);
  res.json({ used: Number(r.rows[0].used), quota: USER_STORAGE_QUOTA });
});

// Helpers
async function getAlbumById(albumId) {
	const result = await db.query('SELECT * FROM albums WHERE id = $1', [albumId]);
	return result.rows[0];
}

async function canManageAlbum(req, albumId) {
	const album = await getAlbumById(albumId);
	if (!album) return { allowed: false, reason: 'Not found' };
	if (req.session.user.role === 'admin') return { allowed: true, album };
	if (album.user_id === req.session.user.id) return { allowed: true, album };
	return { allowed: false, reason: 'Forbidden' };
}

// Get media for album (owner or admin)
router.get('/media/list/:albumId', async (req, res) => {
	if (!req.session.user) return res.status(401).send('Unauthorized');
	const { allowed, album, reason } = await canManageAlbum(req, req.params.albumId);
	if (!allowed) return res.status(403).send(reason || 'Forbidden');
	const media = (await db.query('SELECT * FROM media_files WHERE album_id = $1 ORDER BY id ASC', [album.id])).rows;
	res.json(media);
});

// Update album (title/description, owner or admin)
router.patch('/album/:albumId', async (req, res) => {
	if (!req.session.user) return res.status(401).send('Unauthorized');
	const { title, description, is_public, album_password } = req.body;
	const { allowed, album, reason } = await canManageAlbum(req, req.params.albumId);
	if (!allowed) return res.status(403).send(reason || 'Forbidden');
	const newPublic = req.session.user.role === 'admin' ? is_public : album.is_public;
	await db.query('UPDATE albums SET title = $1, description = $2, is_public = $3, album_password = $4 WHERE id = $5', [title ?? album.title, description ?? album.description, !!newPublic, album_password ?? album.album_password, album.id]);
	res.sendStatus(200);
});

// Delete media (owner or admin)
router.delete('/media/:mediaId', async (req, res) => {
	if (!req.session.user) return res.status(401).send('Unauthorized');
	const mediaRes = await db.query('SELECT m.*, a.user_id FROM media_files m JOIN albums a ON a.id = m.album_id WHERE m.id = $1', [req.params.mediaId]);
	const media = mediaRes.rows[0];
	if (!media) return res.status(404).send('Not found');
	if (!(req.session.user.role === 'admin' || req.session.user.id === media.user_id)) return res.status(403).send('Forbidden');
	// Delete file on disk
	try {
		const filePath = path.join(uploadsRoot, path.basename(media.url));
		fs.unlinkSync(filePath);
	} catch (e) {
		// ignore missing file
	}
	await db.query('DELETE FROM media_files WHERE id = $1', [req.params.mediaId]);
	res.sendStatus(200);
});

// Delete album (and its media) owner or admin
router.delete('/album/:albumId', async (req, res) => {
	if (!req.session.user) return res.status(401).send('Unauthorized');
	const { allowed, album, reason } = await canManageAlbum(req, req.params.albumId);
	if (!allowed) return res.status(403).send(reason || 'Forbidden');
	const media = (await db.query('SELECT * FROM media_files WHERE album_id = $1', [album.id])).rows;
	for (const m of media) {
		try {
			const filePath = path.join(uploadsRoot, path.basename(m.url));
			fs.unlinkSync(filePath);
		} catch (e) {}
	}
	await db.query('DELETE FROM media_files WHERE album_id = $1', [album.id]);
	await db.query('DELETE FROM albums WHERE id = $1', [album.id]);
	res.sendStatus(200);
});

module.exports = router;