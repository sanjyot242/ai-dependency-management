// node-service/services/fetchMultiplePackageJsons.js
const axiosInstance = require('../utils/axiosLogger');

/**
 * findPackageJsonFiles:
 *   1) calls GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1
 *   2) filters paths that end in 'package.json'
 */
async function findPackageJsonFiles(owner, repo, branch, token) {
  const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
  try {
    const res = await axiosInstance.get(url, {
      headers: { Authorization: `token ${token}` }
    });
    if (!res.data.tree) return [];
    // res.data.tree is an array of { path, mode, type, sha, url }
    const allFiles = res.data.tree;
    const packageJsonPaths = allFiles
      .filter(file => file.type === 'blob' && file.path.endsWith('package.json'))
      .map(file => file.path);
    return packageJsonPaths;
  } catch (error) {
    console.error('Error finding package.json files:', error.message);
    return [];
  }
}

/**
 * getFileContent:
 *   1) calls GET /repos/{owner}/{repo}/contents/{filePath}?ref={branch}
 *   2) returns the raw text content. (We must decode base64 from `res.data.content`)
 */
async function getFileContent(owner, repo, filePath, branch, token) {
  try {
    const res = await axiosInstance.get(
      `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`,
      {
        headers: { Authorization: `token ${token}` }
      }
    );
    if (!res.data.content) return null;

    // decode base64
    const buff = Buffer.from(res.data.content, 'base64');
    return buff.toString('utf-8');
  } catch (error) {
    console.error(`Error fetching file content for ${filePath}:`, error.message);
    return null;
  }
}

module.exports = {
  findPackageJsonFiles,
  getFileContent
};
