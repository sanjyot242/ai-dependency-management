// utils/findPackageJsonFiles.js
const axios = require('axios');
const logger = require('./logger');

/**
 * findPackageJsonFiles:
 *   1) calls GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1
 *   2) filters paths that end in 'package.json'
 */
async function findPackageJsonFiles(owner, repo, branch, token) {
  const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
  logger.info(
    `Searching for package.json files in ${owner}/${repo} (${branch})`
  );

  try {
    const res = await axios.get(url, {
      headers: { Authorization: `token ${token}` },
    });

    if (!res.data.tree) {
      logger.warn(`No file tree found for ${owner}/${repo}`);
      return [];
    }

    // res.data.tree is an array of { path, mode, type, sha, url }
    const allFiles = res.data.tree;
    const packageJsonPaths = allFiles
      .filter(
        (file) => file.type === 'blob' && file.path.endsWith('package.json')
      )
      .map((file) => file.path);

    logger.info(
      `Found ${packageJsonPaths.length} package.json files in ${owner}/${repo}`
    );
    return packageJsonPaths;
  } catch (error) {
    // Check for specific GitHub API errors
    if (error.response && error.response.status) {
      const status = error.response.status;

      if (status === 404) {
        logger.error(`Repository not found: ${owner}/${repo}`);
      } else if (status === 403) {
        logger.error(
          `API rate limit exceeded or permission denied for ${owner}/${repo}`
        );
      } else if (status === 409) {
        logger.error(
          `Repository is empty or git trees are not available for ${owner}/${repo}`
        );
      } else {
        logger.error(
          `GitHub API error (${status}) when finding package.json files for ${owner}/${repo}: ${error.message}`
        );
      }
    } else {
      logger.error(
        `Error finding package.json files for ${owner}/${repo}: ${error.message}`
      );
    }

    return [];
  }
}

/**
 * getFileContent:
 *   1) calls GET /repos/{owner}/{repo}/contents/{filePath}?ref={branch}
 *   2) returns the raw text content. (We must decode base64 from `res.data.content`)
 */
async function getFileContent(owner, repo, filePath, branch, token) {
  logger.debug(
    `Fetching file content for ${filePath} in ${owner}/${repo} (${branch})`
  );

  try {
    const res = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`,
      {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3.raw',
        },
      }
    );

    // When using Accept: 'application/vnd.github.v3.raw',
    // GitHub returns the raw file content directly without base64 encoding
    return res.data;
  } catch (error) {
    // Check for specific GitHub API errors
    if (error.response && error.response.status) {
      const status = error.response.status;

      if (status === 404) {
        // Just debug log for 404s since we're trying multiple potential file paths
        logger.debug(`File not found: ${filePath} in ${owner}/${repo}`);
      } else if (status === 403) {
        logger.warn(
          `API rate limit exceeded or permission denied for ${filePath} in ${owner}/${repo}`
        );
      } else {
        logger.warn(
          `GitHub API error (${status}) fetching ${filePath} in ${owner}/${repo}: ${error.message}`
        );
      }
    } else {
      logger.warn(
        `Error fetching file content for ${filePath} in ${owner}/${repo}: ${error.message}`
      );
    }

    throw error; // Re-throw to let the caller handle the specific error
  }
}

module.exports = {
  findPackageJsonFiles,
  getFileContent,
};
