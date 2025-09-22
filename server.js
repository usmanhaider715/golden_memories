const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const db = require('./models/db');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const searchRoutes = require('./routes/search');
const uploadRoutes = require('./routes/upload');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true if using HTTPS
}));
app.use(express.static('public'));

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

app.listen(3000, () => {
  console.log('Server running on port 3000');
});