// node-service/routes/dependency.routes.js
const { Router } = require('express');
const router = Router();

const Repository = require('../../models/Repository'); // or wherever you store repos
const DependencyScan = require('../../models/DependencyScan');
const { fetchPackageJson } = require('../../serivces/fetchPackageJson');
const { scanDependencies } = require('../../serivces/dependencyScanner');

/**
 * POST /api/dependencies/scan
 * Body: { repoId: "<repo-id>" }
 */
router.post('/scan', async (req, res) => {
  try {
    const { repoId } = req.body;
    const repo = await Repository.findById(repoId);
    if (!repo) {
      return res.status(404).json({ error: 'Repo not found' });
    }

    // Attempt to fetch package.json from GitHub
    const pkgJson = await fetchPackageJson(
      repo.owner,
      repo.name,
      repo.defaultBranch || 'main'
    );
    if (!pkgJson) {
      return res
        .status(404)
        .json({ error: 'package.json not found or failed to fetch' });
    }

    // Scan dependencies
    const scanResults = await scanDependencies(pkgJson);

    // Store in DB
    const newScan = await DependencyScan.create({
      userId: repo.userId,
      repoId: repo._id,
      dependencies: scanResults,
    });

    return res.json(newScan);
  } catch (error) {
    console.error('Error scanning dependencies:', error.message);
    return res.status(500).json({ error: 'Failed to scan dependencies' });
  }
});

/**
 * GET /api/dependencies/:repoId/latest
 * Return the most recent scan for a given repo
 */
router.get('/:repoId/latest', async (req, res) => {
  try {
    const { repoId } = req.params;
    // Find the last created scan
    const latestScan = await DependencyScan.findOne({ repoId }).sort({
      scannedAt: -1,
    });
    if (!latestScan) {
      return res.status(404).json({ error: 'No scans found for this repo' });
    }
    return res.json(latestScan);
  } catch (error) {
    console.error('Error fetching latest scan:', error.message);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
