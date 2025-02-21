// node-service/routes/user.routes.js
const { Router } = require('express');
const User = require('../../models/User');
const Repository = require('../../models/Repository');
const axiosInstance = require('../../utils/axiosLogger');

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

router.post('/sync', async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findById(userId);
    if (!user || !user.githubToken) {
      return res
        .status(400)
        .json({ error: 'User not found or missing GitHub token' });
    }

    // Fetch user's repos from GitHub
    const ghResponse = await axiosInstance.get(
      'https://api.github.com/user/repos',
      {
        headers: {
          Authorization: `token ${user.githubToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    const githubRepos = ghResponse.data;

    await Promise.all(
      githubRepos.map(async (repo) => {
        const filter = { repoId: repo.id };
        const update = {
          userId,
          repoId: repo._id,
          fullName: repo.full_name,
          private: repo.private,
          htmlUrl: repo.html_url,
          description: repo.description || '',
        };

        await Repository.findOneAndUpdate(filter, update, {
          upsert: true,
          new: true,
        });
      })
    );
    res.json({ message: 'Repositories synced successfully' });
  } catch (error) {
    console.error('Error syncing repos:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
