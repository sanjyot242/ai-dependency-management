// dependency.routes.js
const { Router } = require('express');
const router = Router();

const Repository = require('../../models/Repository'); // where you store repos
const DependencyScan = require('../../models/DependencyScan');
const { scanDependencies } = require('../../serivces/dependencyScanner');
const {
  findPackageJsonFiles,
  getFileContent,
} = require('../../utils/findPackageJsonFiles');
// Import your User model to fetch the token
const User = require('../../models/User');
const logger = require('../../utils/logger');

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

    logger.info(`Scanning dependencies for repo ${repo.name}`);
    logger.debug(`Repo details: ${repo.userId}`);
    // Get the GitHub token for the user from MongoDB
    const user = await User.findById(repo.userId);
    if (!user || !user.githubToken) {
      logger.error('GitHub token not found for user');
      return res.status(401).json({ error: 'GitHub token not found for user' });
    }
    const githubToken = user.githubToken;

    // Use findPackageJsonFiles to scan the entire repo for package.json files
    const packageJsonPaths = await findPackageJsonFiles(
      repo.owner,
      repo.name,
      repo.defaultBranch || 'main',
      githubToken
    );
    if (!packageJsonPaths || packageJsonPaths.length === 0) {
      logger.error('No package.json files found in the repository');
      return res
        .status(404)
        .json({ error: 'No package.json files found in the repository' });
    }

    // Iterate through each package.json file to fetch and parse its content
    const packageJsons = [];
    for (const filePath of packageJsonPaths) {
      const content = await getFileContent(
        repo.owner,
        repo.name,
        filePath,
        githubToken
      );
      if (content) {
        try {
          const pkg = JSON.parse(content);
          packageJsons.push(pkg);
        } catch (error) {
          console.error(
            `Error parsing JSON for file ${filePath}:`,
            error.message
          );
        }
      }
    }

    // Pass the array of package.json objects to your dependency scanner.
    // (You may need to adjust scanDependencies to handle an array.)
    const scanResults = await scanDependencies(packageJsons);
    logger.info(`Scan results for repo ${repo.name}:`, scanResults);
    // Store the scan results in the database
    const newScan = await DependencyScan.findOneAndUpdate(
      {
        userId: repo.userId,
        repoId: repo._id,
      },
      { $set: { depedencis: scanResults } }, // update operator with correct field name
      { new: true, upsert: true }
    );
    logger.info(`Scan saved to database: ${newScan}`);
    return res.json(newScan);
  } catch (error) {
    console.error('Error scanning dependencies:', error.message);
    return res.status(500).json({ error: 'Failed to scan dependencies' });
  }
});

/**
 * GET /api/dependencies/:repoId/latest
 * Returns the most recent scan for a given repo.
 */
router.get('/:repoId/latest', async (req, res) => {
  try {
    const { repoId } = req.params;
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
