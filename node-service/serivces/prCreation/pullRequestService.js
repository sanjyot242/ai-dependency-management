// node-service/services/prCreation/pullRequestService.js

const axiosInstance = require('../../utils/axiosLogger');

/**
 * checkExistingPr:
 *   Checks if there's an open PR from "head" to "base" so we don't duplicate.
 *   GET /repos/{owner}/{repo}/pulls?head={owner}:{headBranch}&state=open
 */
async function checkExistingPr(owner, repo, headBranch, token) {
  try {
    const res = await axiosInstance.get(
      `https://api.github.com/repos/${owner}/${repo}/pulls?head=${owner}:${headBranch}&state=open`,
      { headers: { Authorization: `token ${token}` } }
    );
    return res.data.length > 0 ? res.data[0] : null;
  } catch (error) {
    logger.error('Error checking existing PR:', error.message);
    // Not a critical error, might just return null
    return null;
  }
}

/**
 * openPullRequest:
 *   POST /repos/{owner}/{repo}/pulls
 *   body => { title, head, base, body }
 */
async function openPullRequest(owner, repo, headBranch, baseBranch, title, body, token) {
  try {
    const res = await axiosInstance.post(
      `https://api.github.com/repos/${owner}/${repo}/pulls`,
      {
        title,
        head: headBranch,
        base: baseBranch,
        body
      },
      { headers: { Authorization: `token ${token}` } }
    );
    return res.data; // includes PR number, html_url, etc.
  } catch (error) {
    logger.error('Error opening pull request:', error.message);
    throw new Error('Could not open pull request');
  }
}

module.exports = {
  checkExistingPr,
  openPullRequest
};
