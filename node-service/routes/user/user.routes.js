// node-service/routes/user.routes.js
const { Router } = require('express');
const User = require('../../models/User');
const router = Router();

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id, '_id username');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json(user);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
