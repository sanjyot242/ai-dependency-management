// node-service/routes/repo.routes.js
const { Router } = require('express');
const axios = require('axios');
const User = require('../../models/User');
const Repository = require('../../models/Repository');
const axiosInstance = require('../../utils/axiosLogger');

const router = Router();

router.post('/sync', async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findById(userId);
    if (!user || !user.githubToken) {
      return res.status(400).json({ error: 'User or GitHub token not found' });
    }

    // Fetch repos from GitHub
    const ghResponse = await axiosInstance.get(
      'https://api.github.com/user/repos',
      {
        headers: {
          Authorization: `token ${user.githubToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );
    const githubRepos = ghResponse.data; // array of repo objects


    const bulkOps = githubRepos.map((repo)=>({
      updateOne:{
        filter: {repoId: repo.id},
        update:{
          $set:{
            userId: user._id,
            name: repo.name,
            private: repo.private,
            htmlUrl: repo.html_url,
            owner: repo.owner.login,
            description: repo.description || '',
            baseBranch: repo.default_branch, // store the base branch info
          },
        },
        upsert: true,
      }
   }));

   await Repository.bulkWrite(bulkOps);

  
    

    res.json({ message: 'Repositories synced successfully' });
  } catch (error) {
    console.error('Error syncing repos:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }
    const repos = await Repository.find({ userId });
    res.json(repos);
  } catch (error) {
    console.error('Error fetching repos:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
