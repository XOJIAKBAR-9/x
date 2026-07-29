const pool = require('./index');

async function setup() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        post_slug VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
        is_author BOOLEAN DEFAULT FALSE
      );
      CREATE INDEX IF NOT EXISTS idx_comments_post_slug ON comments(post_slug);
    `);
    console.log('Comments table created successfully.');
  } catch (err) {
    console.error('Failed to create comments table:', err);
  } finally {
    pool.end();
  }
}

setup();
