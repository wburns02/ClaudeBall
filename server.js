import express from 'express';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Database setup ─────────────────────────────────────────────────────────────
const DB_PATH = process.env.DB_PATH || join(__dirname, 'ideas.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS ideas (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    author TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'feature',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    votes INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS votes (
    idea_id TEXT NOT NULL,
    author TEXT NOT NULL,
    PRIMARY KEY (idea_id, author),
    FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE
  );
`);

// ── Express app ────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

const DIST = join(__dirname, 'dist');

// Static files from the Vite build
app.use(express.static(DIST));

// ── API routes ─────────────────────────────────────────────────────────────────

// GET /api/ideas — all ideas sorted by votes desc, with votedBy arrays
app.get('/api/ideas', (_req, res) => {
  try {
    const ideas = db.prepare(`
      SELECT i.id, i.text, i.author, i.category, i.created_at, i.votes
      FROM ideas i
      ORDER BY i.votes DESC, i.created_at DESC
    `).all();

    const votedByStmt = db.prepare('SELECT author FROM votes WHERE idea_id = ?');

    const result = ideas.map(idea => ({
      id: idea.id,
      text: idea.text,
      author: idea.author,
      category: idea.category,
      createdAt: idea.created_at,
      votes: idea.votes,
      votedBy: votedByStmt.all(idea.id).map(r => r.author),
    }));

    res.json(result);
  } catch (err) {
    console.error('GET /api/ideas error:', err);
    res.status(500).json({ error: 'Failed to load ideas' });
  }
});

// POST /api/ideas — create a new idea
app.post('/api/ideas', (req, res) => {
  try {
    const { text, author, category = 'feature' } = req.body;
    if (!text || !author) {
      return res.status(400).json({ error: 'text and author are required' });
    }

    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const createdAt = new Date().toISOString();

    const insertIdea = db.prepare(`
      INSERT INTO ideas (id, text, author, category, created_at, votes)
      VALUES (?, ?, ?, ?, ?, 1)
    `);
    const insertVote = db.prepare(`
      INSERT OR IGNORE INTO votes (idea_id, author) VALUES (?, ?)
    `);

    db.transaction(() => {
      insertIdea.run(id, text.trim(), author, category, createdAt);
      insertVote.run(id, author); // author auto-votes their own idea
    })();

    res.status(201).json({
      id,
      text: text.trim(),
      author,
      category,
      createdAt,
      votes: 1,
      votedBy: [author],
    });
  } catch (err) {
    console.error('POST /api/ideas error:', err);
    res.status(500).json({ error: 'Failed to create idea' });
  }
});

// POST /api/ideas/:id/vote — toggle vote for an author
app.post('/api/ideas/:id/vote', (req, res) => {
  try {
    const { id } = req.params;
    const { author } = req.body;
    if (!author) return res.status(400).json({ error: 'author is required' });

    const idea = db.prepare('SELECT * FROM ideas WHERE id = ?').get(id);
    if (!idea) return res.status(404).json({ error: 'Idea not found' });

    const existingVote = db.prepare('SELECT 1 FROM votes WHERE idea_id = ? AND author = ?').get(id, author);

    const toggleVote = db.transaction(() => {
      if (existingVote) {
        db.prepare('DELETE FROM votes WHERE idea_id = ? AND author = ?').run(id, author);
        db.prepare('UPDATE ideas SET votes = MAX(0, votes - 1) WHERE id = ?').run(id);
      } else {
        db.prepare('INSERT OR IGNORE INTO votes (idea_id, author) VALUES (?, ?)').run(id, author);
        db.prepare('UPDATE ideas SET votes = votes + 1 WHERE id = ?').run(id);
      }
    });
    toggleVote();

    const updated = db.prepare('SELECT * FROM ideas WHERE id = ?').get(id);
    const votedBy = db.prepare('SELECT author FROM votes WHERE idea_id = ?').all(id).map(r => r.author);

    res.json({
      id: updated.id,
      text: updated.text,
      author: updated.author,
      category: updated.category,
      createdAt: updated.created_at,
      votes: updated.votes,
      votedBy,
    });
  } catch (err) {
    console.error('POST /api/ideas/:id/vote error:', err);
    res.status(500).json({ error: 'Failed to toggle vote' });
  }
});

// DELETE /api/ideas/:id — delete idea (only author can delete)
app.delete('/api/ideas/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { author } = req.body;
    if (!author) return res.status(400).json({ error: 'author is required' });

    const idea = db.prepare('SELECT * FROM ideas WHERE id = ?').get(id);
    if (!idea) return res.status(404).json({ error: 'Idea not found' });
    if (idea.author !== author) return res.status(403).json({ error: 'Only the author can delete this idea' });

    db.prepare('DELETE FROM ideas WHERE id = ?').run(id);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/ideas/:id error:', err);
    res.status(500).json({ error: 'Failed to delete idea' });
  }
});

// ── SPA fallback ───────────────────────────────────────────────────────────────
// Any non-API, non-static GET should serve index.html so React Router works
app.get('*path', (req, res) => {
  const indexHtml = join(DIST, 'index.html');
  if (existsSync(indexHtml)) {
    res.sendFile(indexHtml);
  } else {
    res.status(503).send('App not built yet. Run: npm run build');
  }
});

// ── Start server ───────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`ClaudeBall server running on port ${PORT}`);
  console.log(`  Static files: ${DIST}`);
  console.log(`  Database:     ${DB_PATH}`);
});
