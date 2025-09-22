const express = require('express');
const multer = require('multer');
const aws = require('aws-sdk');
const db = require('../models/db');
const router = express.Router();

const s3 = new aws.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const upload = multer({ storage: multer.memoryStorage() });

router.post('/album', (req, res) => {
  if (!req.session.user) return res.status(401).send('Unauthorized');
  const { title, description, is_public } = req.body;
  const userId = req.session.user.id;
  const publicFlag = req.session.user.role === 'admin' ? is_public : false;
  db.query('INSERT INTO albums (title, description, user_id, is_public) VALUES ($1, $2, $3, $4) RETURNING id', [title, description, userId, publicFlag])
    .then(result => res.json({ albumId: result.rows[0].id }))
    .catch(err => res.status(500).send(err));
});

router.post('/media/:albumId', upload.single('file'), async (req, res) => {
  if (!req.session.user) return res.status(401).send('Unauthorized');
  const file = req.file;
  const type = file.mimetype.startsWith('image') ? 'image' : 'video';
  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: `${Date.now()}-${file.originalname}`,
    Body: file.buffer,
    ACL: 'public-read'
  };
  try {
    await s3.upload(params).promise();
    const url = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${params.Key}`;
    await db.query('INSERT INTO media_files (album_id, type, url) VALUES ($1, $2, $3)', [req.params.albumId, type, url]);
    res.json({ url });
  } catch (err) {
    res.status(500).send(err);
  }
});

module.exports = router;