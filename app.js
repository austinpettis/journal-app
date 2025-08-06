
// Allows us to use the express module to make creating the server app faster

const express = require('express');

//Adds encryption module
const bcrypt = require('bcrypt');
// create database
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./journal.db');

//hide things from git
require('dotenv').config();

// Create users table
db.run(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  password TEXT
)`);

// Create entries table
db.run(`CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  content TEXT,
  timestamp TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
)`);



//Allows us to work with computers that use other symbols than / to seperate files and directories
const path = require('path');

// creates an instance of the express application
const app = express();

//dynamic journal page 
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));



//the number we will use to set the port on the server where we will find the site
const PORT = 3000;

// adds login session module

const session = require('express-session');
const { error } = require('console');







//Middleware to parse form data

app.use(express.urlencoded({extended: true}));
app.use(express.json());



// tells the server to show index.html, which is the basic journal page when they go to port3000/



app.use(session({
  secret: process.env.SESSION_SECRET, //replace with a strong random string in production
  resave: false,
  saveUninitialized: true
}));





app.get('/', (req, res) => {
  if (!req.session.username) {
    return res.redirect('/login');
  }

  db.all(
    'SELECT * FROM entries WHERE user_id = ? ORDER BY timestamp DESC',
    [req.session.userId],
    (err, rows) => {
      if (err) {
        return res.status(500).send('Error fetching entries');
      }

      res.render('journal', {
        username: req.session.username,
        entries: rows
      });
    }
  );
});




// Route to serve the registration page
app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

// Route to serve the login page
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Route to handle new Journal Entries
app.post('/entry', (req, res) => {
  const { content } = req.body;
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).send('Unauthorized: You must be logged in');
  }

  if (!content) {
    return res.status(400).send('Entry content required');
  }

  const timestamp = new Date().toISOString();

  db.run(
    'INSERT INTO entries (user_id, content, timestamp) VALUES (?, ?, ?)',
    [userId, content, timestamp],
    function (err) {
      if (err) {
        return res.status(500).send('Error saving entry');
      }
      res.redirect('/');
    }
  );
});


//Route for logout
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).send('Could not log out');
    }
    res.redirect('/login');
  });
});




//Route to handle login POST
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  db.get('SELECT * FROM users WHERE username = ?', [username], (error, user) => {
    if (error) return res.status(500).send('Database Error');
    if (!user) return res.status(401).send('Invalid credentials');
    
    
    bcrypt.compare(password, user.password, (error, result) =>{
    if (error || !result) {
      return res.status(401).send('Invalid password');
   
    }
     req.session.username = user.username; // Save the username in the session
    req.session.userId = user.id;
    res.redirect('/'); // Logged in successfully (for now we just redirect)
  })

  })


  

  
});

app.post('/register', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).send('Username and password required');
  }

  db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
    if (err) return res.status(500).send('Database error');

    if (row) {
      return res.status(400).send('Username already taken');
    }

    bcrypt.hash(password, 10, (err, hashedPassword) => {
      if (err) return res.status(500).send('Error hashing password');

      db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], function(err) {
        if (err) return res.status(500).send('Error saving user');

        res.redirect('/login');
      });
    });
  });
});

//Edit entries
app.post('/entry/edit/:id', (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  const userId = req.session.userId;

  if (!userId) return res.status(401).send('Unauthorized');

  db.run(
    'UPDATE entries SET content = ? WHERE id = ? AND user_id = ?',
    [content, id, userId],
    function (err) {
      if (err) return res.status(500).send('Database error');
      res.redirect('/');
    }
  );
});

//delete entries

app.post('/entry/delete/:id', (req, res) => {
  const { id } = req.params;
  const userId = req.session.userId;

  if (!userId) return res.status(401).send('Unauthorized');

  db.run(
    'DELETE FROM entries WHERE id = ? AND user_id = ?',
    [id, userId],
    function (err) {
      if (err) return res.status(500).send('Database error');
      res.redirect('/');
    }
  );
});


//Route to fetch all entries 
app.get('/entries', (req, res) => {
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).send('Unauthorized');
  }

  db.all('SELECT * FROM entries WHERE user_id = ?', [userId], (err, rows) => {
    if (err) {
      return res.status(500).send('Error fetching entries');
    }
    res.json(rows);
  });
});

app.get('/edit/:id', (req, res) => {
  const entryId = req.params.id;

  const query = 'SELECT * FROM entries WHERE id = ? AND user_id = ?';
  db.get(query, [entryId, req.session.userId], (err, entry) => {
    if (err) return res.status(500).send('Database error');
    if (!entry) return res.status(404).send('Entry not found or access denied');

    res.render('edit', { entry });
  });
});
// edit journal entries
app.post('/edit/:id', (req, res) => {
  const entryId = req.params.id;
  const { content } = req.body;

  if (!content) {
    return res.status(400).send('Content cannot be empty');
  }

  const query = `UPDATE entries SET content = ?, timestamp = ? WHERE id = ? AND user_id = ?`;
  const params = [content, new Date().toISOString(), entryId, req.session.userId];

  db.run(query, params, function (err) {
    if (err) return res.status(500).send('Error updating entry');

    if (this.changes === 0) {
      return res.status(403).send('Entry not found or permission denied');
    }

    res.redirect('/');
  });
});



//serve static files

app.use(express.static(path.join(__dirname,'public',)));

app.listen(PORT, () => {
    console.log(`Journal app listening on port ${PORT}`)
});
