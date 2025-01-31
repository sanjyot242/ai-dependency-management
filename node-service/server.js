const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.NODE_PORT || 3001;

app.get('/health', (req, res) => {
  res.json({ status: 'Node Service OK' });
});

app.listen(PORT, () => {
  console.log(`Node service running on port ${PORT}`);
});
