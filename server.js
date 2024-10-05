const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const crypto = require('crypto');

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;
const DB_URI = 'mongodb://localhost:27017/notes'; // MongoDB connection string

// MongoDB Model
const NoteSchema = new mongoose.Schema({
  title: String,
  content: String, // This will be stored encrypted
  date: { type: Date, default: Date.now }
});

const Note = mongoose.model('Note', NoteSchema);

// Connect to MongoDB
mongoose.connect(DB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error(err));

// Encryption function
const encrypt = (text, password) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(password), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
};

// Decryption function
const decrypt = (text, password) => {
  let parts = text.split(':');
  let iv = Buffer.from(parts.shift(), 'hex');
  let encryptedText = Buffer.from(parts.join(':'), 'hex');
  let decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(password), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
};

// Routes

// Create new note
app.post('/notes', async (req, res) => {
  const { title, content, password } = req.body;

  if (!password) {
    return res.status(400).json({ message: 'Password is required' });
  }

  const encryptedContent = encrypt(content, password);

  const note = new Note({
    title,
    content: encryptedContent
  });

  try {
    const savedNote = await note.save();
    res.status(201).json(savedNote);
  } catch (error) {
    res.status(500).json({ message: 'Error saving note' });
  }
});

// Get all notes (without decrypting)
app.get('/notes', async (req, res) => {
  try {
    const notes = await Note.find({});
    res.json(notes);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving notes' });
  }
});

// Get a specific note and decrypt
app.post('/notes/:id', async (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ message: 'Password is required' });
  }

  try {
    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }

    const decryptedContent = decrypt(note.content, password);
    res.json({
      title: note.title,
      content: decryptedContent,
      date: note.date
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving note' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
