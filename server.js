const path = require('path');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

app.use(express.json());

// Security headers. Google Fonts is loaded from the page, so it's allow-listed here.
app.use(
  helmet({
    // Disabled for local dev: this server runs over plain HTTP on localhost.
    // HSTS/upgrade-insecure-requests tell browsers (Safari enforces this
    // more strictly than Chrome) to force all future requests to HTTPS,
    // which breaks everything since there's no TLS listener here.
    hsts: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        scriptSrcAttr: ["'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        upgradeInsecureRequests: null,
      },
    },
  })
);

app.use(compression());

// ---------------------------------------------------------------
// API — backed by Postgres. See db/schema.sql to create the table.
// ---------------------------------------------------------------

function rowToPost(row) {
  return {
    slug: row.slug,
    title: row.title,
    date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : row.date,
    tags: row.tags || [],
    excerpt: row.excerpt,
    content: row.content || [],
  };
}

// GET /api/posts — all posts, newest first
app.get('/api/posts', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT slug, title, date, tags, excerpt, content FROM posts ORDER BY date DESC, id DESC'
    );
    res.json(rows.map(rowToPost));
  } catch (err) {
    console.error('GET /api/posts failed:', err);
    res.status(500).json({ error: 'Could not load posts' });
  }
});

// GET /api/posts/:slug — single post
app.get('/api/posts/:slug', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT slug, title, date, tags, excerpt, content FROM posts WHERE slug = $1',
      [req.params.slug]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Post not found' });
    res.json(rowToPost(rows[0]));
  } catch (err) {
    console.error('GET /api/posts/:slug failed:', err);
    res.status(500).json({ error: 'Could not load post' });
  }
});

// POST /api/posts — create a new post
// body: { title: string, tags: string[], content: string[] }
app.post('/api/posts', async (req, res) => {
  try {
    const { title, tags, content } = req.body;

    if (!title || !Array.isArray(content) || content.length === 0) {
      return res.status(400).json({ error: 'title and content are required' });
    }

    const cleanTags = Array.isArray(tags) && tags.length ? tags : ['untagged'];
    const slugBase = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const slug = `${slugBase}-${Date.now()}`;
    const excerpt = content[0].slice(0, 110) + (content[0].length > 110 ? '…' : '');

    const { rows } = await pool.query(
      `INSERT INTO posts (slug, title, tags, excerpt, content)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING slug, title, date, tags, excerpt, content`,
      [slug, title, cleanTags, excerpt, content]
    );

    res.status(201).json(rowToPost(rows[0]));
  } catch (err) {
    console.error('POST /api/posts failed:', err);
    res.status(500).json({ error: 'Could not save post' });
  }
});

// PUT /api/posts/:slug — update an existing post
app.put('/api/posts/:slug', async (req, res) => {
  try {
    const { title, tags, content } = req.body;

    if (!title || !Array.isArray(content) || content.length === 0) {
      return res.status(400).json({ error: 'title and content are required' });
    }

    const cleanTags = Array.isArray(tags) && tags.length ? tags : ['untagged'];
    const excerpt = content[0].slice(0, 110) + (content[0].length > 110 ? '…' : '');

    const { rows } = await pool.query(
      `UPDATE posts SET title = $1, tags = $2, excerpt = $3, content = $4
       WHERE slug = $5
       RETURNING slug, title, date, tags, excerpt, content`,
      [title, cleanTags, excerpt, content, req.params.slug]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Post not found' });
    res.json(rowToPost(rows[0]));
  } catch (err) {
    console.error('PUT /api/posts/:slug failed:', err);
    res.status(500).json({ error: 'Could not update post' });
  }
});

// DELETE /api/posts/:slug — delete a post
app.delete('/api/posts/:slug', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM posts WHERE slug = $1',
      [req.params.slug]
    );

    if (rowCount === 0) return res.status(404).json({ error: 'Post not found' });
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /api/posts/:slug failed:', err);
    res.status(500).json({ error: 'Could not delete post' });
  }
});

// ---------------------------------------------------------------
// Static site
// ---------------------------------------------------------------

app.use(
  express.static(PUBLIC_DIR, {
    index: 'index.html',
    maxAge: '1d',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  })
);

// Single-page app: any unmatched, non-API route falls back to index.html
// (safe here since the blog uses hash-based routing, e.g. #post/slug).
app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Blog running at http://localhost:${PORT}`);
});