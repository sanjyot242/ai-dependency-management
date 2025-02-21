// findPackageJsonFiles.js
const axiosInstance = require('../utils/axiosLogger');

async function findPackageJsonFiles(owner, repo, branch = 'main', token) {
  const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
  const res = await axiosInstance.get(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  // Axios returns the data on res.data
  const data = res.data;

  // Filter for any path that ends with 'package.json'
  const packageJsonPaths = data.tree
    .filter(
      (item) => item.type === 'blob' && item.path.endsWith('package.json')
    )
    .map((item) => item.path);

  return packageJsonPaths;
}

async function getFileContent(owner, repo, filePath, token) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
  const res = await axiosInstance.get(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status !== 200) return null; // handle errors

  const data = res.data;
  // data.content is base64-encoded
  const decoded = Buffer.from(data.content, 'base64').toString('utf8');
  return decoded;
}

module.exports = {
  findPackageJsonFiles,
  getFileContent,
};
