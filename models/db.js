const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined
});

(async () => {
  try {
  const dbUrl = process.env.DATABASE_URL || '';
  console.log('Connecting to database:', dbUrl ? dbUrl.replace(/:.*@/, ':****@') : 'DATABASE_URL not set');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role VARCHAR(20) DEFAULT 'user',
        approved BOOLEAN DEFAULT FALSE
      );
      CREATE TABLE IF NOT EXISTS signup_requests (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS albums (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        title VARCHAR(100) NOT NULL,
        description TEXT,
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_public BOOLEAN DEFAULT FALSE,
        album_password TEXT
      );
      CREATE TABLE IF NOT EXISTS media_files (
        id SERIAL PRIMARY KEY,
        album_id INTEGER REFERENCES albums(id),
        url TEXT NOT NULL,
        type VARCHAR(20) NOT NULL,
        size_bytes BIGINT
      );
      CREATE TABLE IF NOT EXISTS likes (
        id SERIAL PRIMARY KEY,
        media_id INTEGER REFERENCES media_files(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(media_id, user_id)
      );
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        read BOOLEAN DEFAULT FALSE
      );
    `);
    // Ensure new columns exist when updating an existing DB
    await pool.query(`ALTER TABLE albums ADD COLUMN IF NOT EXISTS album_password TEXT`);
    await pool.query(`ALTER TABLE media_files ADD COLUMN IF NOT EXISTS size_bytes BIGINT`);
    console.log('Tables created or already exist');
    const adminExists = await pool.query('SELECT * FROM users WHERE username = $1', ['admin']);
    if (adminExists.rows.length === 0) {
      const hashedPassword = bcrypt.hashSync('adminpass', 10);
      await pool.query(
        'INSERT INTO users (username, email, password, role, approved) VALUES ($1, $2, $3, $4, $5)',
        ['admin', 'admin@example.com', hashedPassword, 'admin', true]
      );
      console.log('Admin user created');
    } else {
      console.log('Admin user already exists');
    }
  } catch (err) {
    console.error('Database initialization error:', err.stack);
  }
})();

module.exports = pool;