const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const logger = require('./utils/logger');
const path = require('path');

const connectDB = require('./db'); // <-- import the connection function

const authRoutes = require('./routes/auth/auth.routes');
const userRoutes = require('./routes/user/user.routes');
const repoRoutes = require('./routes/repos/repo.routes');
const dependencyRoutes = require('./routes/dependency/dependency.routes');
const prRoutes = require('./routes/pr/pr.routes');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.NODE_PORT || 3001;

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// A custom token to include method, url, and status
morgan.token('custom', (req, res) => {
  return `${req.method} ${req.originalUrl} ${res.statusCode}`;
});

const morganFormat = morgan(
  ':remote-addr :custom :res[content-length] - :response-time ms',
  {
    stream: {
      write: (message) => logger.info(message.trim()),
    },
  }
);

app.use(morganFormat);

// Initialize MongoDB connection
connectDB();
console.log('GITHUB_CLIENT_ID:', process.env.GITHUB_CLIENT_ID);
console.log('GITHUB_CLIENT_SECRET:', process.env.GITHUB_CLIENT_SECRET);
console.log('GITHUB_REDIRECT_URI:', process.env.GITHUB_REDIRECT_URI);

app.use('/auth', authRoutes);

app.use('/user', userRoutes);

app.use('/repos', repoRoutes);

app.use('/dependencies', dependencyRoutes);

app.use('/pull-requests', prRoutes);



app.get('/health', (req, res) => {
  res.json({ status: 'Node Service OK' });
});

app.listen(PORT, () => {
  console.log(`Node service running on port ${PORT}`);
});
