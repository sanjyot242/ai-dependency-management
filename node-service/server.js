const express = require('express');
const cors = require('cors');

const connectDB = require('./db'); // <-- import the connection function
const User = require('./models/User');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.NODE_PORT || 3001;

// Initialize MongoDB connection
connectDB();

app.get('/health', (req, res) => {
  res.json({ status: 'Node Service OK' });
});

// Test route to create a User
app.post('/users', async (req, res) => {
  try {
    const { username, githubToken } = req.body;
    const newUser = await User.create({ username, githubToken });
    return res.json(newUser);
  } catch (err) {
    console.error('Error creating user:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Node service running on port ${PORT}`);
});
