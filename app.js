
// Allows us to use the express module to make creating the server app faster

const express = require('express');

//Adds encryption module
const bcrypt = require('bcrypt');
// Adds sessions module


//Allows us to work with computers that use other symbols than / to seperate files and directories
const path = require('path');

// creates an instance of the express application
const app = express();
//the number we will use to set the port on the server where we will find the site
const PORT = 3000;

// adds login session module

const session = require('express-session');
const { error } = require('console');


// in memory storage for temporary journal entry saving

let journalEntries = [];


//Temporary storage for registered users
const users = [];




//Middleware to parse form data

app.use(express.urlencoded({extended: true}));
app.use(express.json());


//serve static files




app.use(session({
  secret: 'my-secret-key', //replace with a strong random string in production
  resave: false,
  saveUninitialized: true
}));





app.get('/', (req, res) => {
  if (req.session.username){
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.redirect('/login')
  }
  
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

app.post('/entry',(req, res) => {
    const { content } = req.body;
    if (!content) {
        return res.status(400).send('Entry content required');
    }
    const newEntry = {
        id: Date.now(),
        content,
        timestamp: new Date().toISOString()
    };
    journalEntries.push(newEntry);
    res.redirect('/');
});

//Route to handle register post

app.post('/register',(req,res) => {
    const { username, password } = req.body;
    //very basic validation
    if (!username || !password){
        return res.status(400).send('Username and password required');
    }

     //check if username is already taken
    const userExists = users.find(user => user.username ===username);
    if (userExists) {
        return res.status(400).send('Username already taken');        
    }

    //Adds password hashing
    bcrypt.hash(password, 10,(error, hashedPassword) => {
        if (error) {
            return res.status(500).send('Error hashing password');
        }

        users.push({ username, password: hashedPassword });
        console.log(users);// for debugging
        
    });


    

   
    //Save the new user
  
    console.log(users); //just to check if it worked
    res.redirect('/login');
});

//Route to handle login POST
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  const user = users.find(
    user => user.username === username 
  );

  if (!user) {
    return res.status(401).send('Invalid credentials');
  }
  bcrypt.compare(password, user.password, (error, result) =>{
    if (error || !result) {
      return res.status(401).send('Invalid password');
    }
    req.session.username = user.username; // Save the username in the session
    res.redirect('/'); // Logged in successfully (for now we just redirect)
  })

  
});


//Route to fetch all entries for debugging
app.get('/entries', (req, res) => {
    res.json(journalEntries);
});

app.use(express.static(path.join(__dirname,'public',)));
// tells the server to show index.html, which is the basic journal page when they go to port3000/


app.listen(PORT, () => {
    console.log(`Journal app listening on port ${PORT}`)
});
