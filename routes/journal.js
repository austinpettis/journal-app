// routes/journal.js
const path = require('path');
const express = require('express');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();

const router = express.Router();

//logger for debugging
router.use((req, _res, next) => {
  console.log('[JOURNAL]', req.method, req.path);
  next();
});


// ---- Database (moved here) ----
const db = new sqlite3.Database(path.join(__dirname, '..', 'data', 'journal-app', 'journal.db'));

// Create tables if not exist
db.run(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  password TEXT
)`);
db.run(`CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  content TEXT,
  timestamp TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
)`);

// ---- Helpers ----
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.redirect('/journal/login');
  }
  return next();
}

// ---- Journal pages ----
// Landing page (dynamic EJS journal or static HTML — choose one)

// If you want to keep your dynamic EJS journal (views/journal-app/journal.ejs):
router.get('/', requireAuth, (req, res) => {
  db.all(
    'SELECT * FROM entries WHERE user_id = ? ORDER BY timestamp DESC',
    [req.session.userId],
    (err, rows) => {
      if (err) return res.status(500).send('Error fetching entries');
      res.render('journal-app/journal', {
        username: req.session.username,
        entries: rows
      });
    }
  );
});

// Static login/register pages served from public/journal-app
router.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'journal-app', 'login.html'));
});

router.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'journal-app', 'register.html'));
});

// ---- Auth actions ----
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  db.get('SELECT * FROM users WHERE username = ?', [username], (error, user) => {
    if (error) return res.status(500).send('Database Error');
    if (!user) return res.status(401).send('Invalid credentials');

    bcrypt.compare(password, user.password, (err, ok) => {
      if (err || !ok) return res.status(401).send('Invalid password');
      req.session.username = user.username;
      req.session.userId = user.id;
      return res.redirect('/journal');
    });
  });
});

router.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).send('Username and password required');

  db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
    if (err) return res.status(500).send('Database error');
    if (row) return res.status(400).send('Username already taken');

    bcrypt.hash(password, 10, (err, hashedPassword) => {
      if (err) return res.status(500).send('Error hashing password');
      db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], function (err2) {
        if (err2) return res.status(500).send('Error saving user');
        return res.redirect('/journal/login');
      });
    });
  });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// ---- Entries CRUD ----
router.post('/entry', requireAuth, (req, res) => {
  const { content } = req.body;
  const userId = req.session.userId;
  if (!content) return res.status(400).send('Entry content required');

  const timestamp = new Date().toISOString();
  db.run(
    'INSERT INTO entries (user_id, content, timestamp) VALUES (?, ?, ?)',
    [userId, content, timestamp],
    function (err) {
      if (err) return res.status(500).send('Error saving entry');
      return res.redirect('/journal');
    }
  );
});

router.get('/entries', requireAuth, (req, res) => {
  db.all('SELECT * FROM entries WHERE user_id = ?', [req.session.userId], (err, rows) => {
    if (err) return res.status(500).send('Error fetching entries');
    res.json(rows);
  });
});

// Edit page (server-rendered EJS)
router.get('/edit/:id', requireAuth, (req, res) => {
  const entryId = req.params.id;
  db.get('SELECT * FROM entries WHERE id = ? AND user_id = ?', [entryId, req.session.userId], (err, entry) => {
    if (err) return res.status(500).send('Database error');
    if (!entry) return res.status(404).send('Entry not found or access denied');
    res.render('journal-app/edit', { entry });
  });
});

// Edit action
router.post('/edit/:id', requireAuth, (req, res) => {
  const entryId = req.params.id;
  const { content } = req.body;
  if (!content) return res.status(400).send('Content cannot be empty');

  const params = [content, new Date().toISOString(), entryId, req.session.userId];
  db.run('UPDATE entries SET content = ?, timestamp = ? WHERE id = ? AND user_id = ?', params, function (err) {
    if (err) return res.status(500).send('Error updating entry');
    if (this.changes === 0) return res.status(403).send('Entry not found or permission denied');
    res.redirect('/journal');
  });
});

// Delete
router.post('/entry/delete/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM entries WHERE id = ? AND user_id = ?', [id, req.session.userId], function (err) {
    if (err) return res.status(500).send('Database error');
    res.redirect('/journal');
  });
});
//logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/journal/login'));
});


module.exports = router;

