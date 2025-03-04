// node-service/routes/pr.routes.js
const { Router } = require('express');
const router = Router();
const { createDependencyPR } = require('../../serivces/prCreation/index');
const logger = require('../../utils/logger');
const Repository = require('../../models/Repository');
const User = require('../../models/User');
const DependencyScan = require('../../models/DependencyScan');


// POST /pull-requests/create
// Body: { owner, repo, baseBranch, token, outdatedDeps: [{ packageName, latestVersion }, ...] }
router.post('/create', async (req, res) => {
    logger.info('Creating PR for outdated dependencies');
  try {
    const { userId, repoId } = req.body;

    const repo  = await Repository.findById(repoId);
    if (!repo) {
        logger.error('Repository not found');
      return res.status(404).json({ error: 'Repository not found' });
    }

    const user = await User.findById(userId);
    if (!user) {
        logger.error('User not found');
      return res.status(404).json({ error: 'User not found' });
    }


    const latestScan = await DependencyScan.findOne({ repoId }).sort({ scannedAt: -1 });
    const outdatedDeps = latestScan
      ? latestScan.dependencies.filter(d => d.isOutdated)
      : [];

    logger.info(`Outdated dependencies found: ${outdatedDeps.length}`);
    if (outdatedDeps.length === 0) {
        logger.info('No outdated dependencies found');
      return res.json({ success: true, prUrl: null });
    }

    logger.info(`repo ${repo.owner}, ${repo.name}, ${user.githubToken}, ${repo.baseBranch|| 'main'}`);
    const prData = await createDependencyPR({ 
      owner: repo.owner, 
      repo: repo.name, 
      token: user.githubToken, 
      baseBranch: repo.baseBranch || 'main',
      outdatedDeps 
    });
    return res.json({ success: true, prUrl: prData.html_url });
  } catch (error) {
    logger.error('Error creating PR:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
