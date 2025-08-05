
	const express = require('express');
	const path = require('path');
	const app = express();
	const PORT = 3000;

	let journalEntries = []; //In-memory storage
	
	// Middleware to parse form data
	app.use(express.urlencoded({extended: true}));
	app.use(express.json());

	//serve static files
	app.use(express.static(path.join(__dirname, 'public')));

	// Route to render homepage
	app.get('/', (req, res) => {
		res.sendFile(path.join(__dirname, 'public', 'index.html'));
	});

	// Route to handle new journal entries
	app.post('/entry', (req, res) => {
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

		//Route to fetch all entries (for debugging)
		app.get('/entries', (req, res) => {
			res.json(journalEntries);
		});
		
		app.listen(PORT, () => {
			console.log(`Journal app listening on port ${PORT}`);
		});
