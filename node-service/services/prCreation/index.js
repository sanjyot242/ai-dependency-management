// node-service/services/prCreation/index.js
const { getDefaultBranchSha, createBranch } = require('./branchCreation');
const { getCurrentFileSha, updateFile, bumpPackageJson } = require('./fileUpdateService');
const { checkExistingPr, openPullRequest } = require('./pullRequestService');
const { findPackageJsonFiles, getFileContent } = require('../../utils/findPackageJsonFiles') 
// ^ your new code that recursively finds paths & fetches content
const logger = require('../../utils/logger');

/**
 * createDependencyPR:
 *   Orchestrates the entire flow:
 *   1) find base branch sha
 *   2) create new branch
 *   3) find & fetch all package.json files from default branch
 *   4) bump dependencies for each file
 *   5) commit new content to new branch (multiple commits or sequential PUT calls)
 *   6) open a PR
 */
async function createDependencyPR({ owner, repo, token, baseBranch = 'main', outdatedDeps }) {
  try {
    logger.debug('Data received inside createDependencyPR', { owner, repo, baseBranch });

    // 1. get the HEAD sha of baseBranch
    const baseSha = await getDefaultBranchSha({ owner, repo, baseBranch, token });
    logger.debug(`Base branch ${baseBranch} SHA: ${baseSha}`);

    // 2. create new branch name
    const newBranchName = `deps-update-${Date.now()}`;
    await createBranch({ owner, repo, newBranchName, baseSha, token });
    logger.debug(`Created new branch ${newBranchName} from ${baseBranch}`);

    // 3. find all package.json paths in the repo's default branch
    const packageJsonPaths = await findPackageJsonFiles(owner, repo, baseBranch, token);
    if (!packageJsonPaths || packageJsonPaths.length === 0) {
      throw new Error('No package.json files found in the repository');
    }
    logger.debug(`Found ${packageJsonPaths.length} package.json files:`, packageJsonPaths);

    // We'll store a count of how many files we actually update
    let updatedFilesCount = 0;

    // 4. For each package.json path, fetch content, bump dependencies, commit to new branch
    for (const filePath of packageJsonPaths) {
      logger.debug(`Processing file: ${filePath}`);

      // get the raw content (string)
      const contentString = await getFileContent(owner, repo, filePath, baseBranch, token);
      if (!contentString) {
        logger.warn(`Could not fetch content for ${filePath}; skipping`);
        continue;
      }

      let oldPkgJson;
      try {
        oldPkgJson = JSON.parse(contentString);
      } catch (error) {
        logger.warn(`Error parsing JSON for file ${filePath}: ${error.message}`);
        continue;
      }

      // bump the dependencies
      const newContentString = bumpPackageJson(oldPkgJson, outdatedDeps);
      // if it ends up the same, you might skip commit to avoid no-op commits
      if (newContentString === contentString) {
        logger.debug(`No changes for ${filePath}; skipping commit`);
        continue;
      }

      // get the existing file's sha
      const existingSha = await getCurrentFileSha(owner, repo, filePath, newBranchName, token);

      // commit the updated file to new branch
      await updateFile(
        owner,
        repo,
        filePath,
        newBranchName,
        newContentString,
        `chore: update dependencies in ${filePath}`,
        existingSha,
        token
      );
      updatedFilesCount++;
      logger.debug(`Committed updated ${filePath} to branch ${newBranchName}`);
    }

    if (updatedFilesCount === 0) {
      throw new Error('No dependencies were updated. Possibly all are up-to-date or no changes needed.');
    }

    // 5. optional: check if there's an existing open PR for that new branch
    const existing = await checkExistingPr(owner, repo, newBranchName, token);
    if (existing) {
      logger.info('PR already exists:', existing.html_url);
      return existing; // skip opening a new one
    }

    // 6. open a single PR
    const title = 'Automated Dependency Update';
    const body = `This PR updates the following dependencies in ${updatedFilesCount} package.json file(s).`;

    const prData = await openPullRequest(
      owner,
      repo,
      newBranchName,
      baseBranch,
      title,
      body,
      token
    );
    logger.info('PR created:', prData.html_url);

    return prData;
  } catch (error) {
    logger.error('Error in createDependencyPR:', error.message);
    throw error;
  }
}

module.exports = { createDependencyPR };
