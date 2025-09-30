const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const db = require('./models/db');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const searchRoutes = require('./routes/search');
const uploadRoutes = require('./routes/upload');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.set('trust proxy', 1);
// Session: 5 minutes inactivity timeout with rolling renewal
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-me',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    secure: process.env.COOKIE_SECURE === 'true',
    maxAge: 5 * 60 * 1000
  }
}));
app.use(express.static('public'));

// Ensure local uploads directory exists
const uploadsDir = path.join(__dirname, 'public', 'uploads');
try {
	fs.mkdirSync(uploadsDir, { recursive: true });
} catch (err) {
	console.error('Failed to create uploads directory:', err);
}

app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/search', searchRoutes);
app.use('/upload', uploadRoutes);

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.get('/dashboard', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  res.sendFile(__dirname + '/public/dashboard.html');
});

app.get('/profile', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  res.sendFile(__dirname + '/public/profile.html');
});

app.get('/admin-panel', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).send('Forbidden');
  res.sendFile(__dirname + '/public/admin.html');
});

app.get('/album/:id', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  res.sendFile(__dirname + '/public/album.html');
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});