const  axiosInstance = require("../../utils/axiosLogger");
const  logger = require("../../utils/logger");


async function getCurrentFileSha(owner, repo, filePath, branch, token) {
    try {
      const res = await axiosInstance.get(
        `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`,
        { headers: { Authorization: `token ${token}` } }
      );
      return res.data.sha; // existing file's sha
    } catch (error) {
      logger.error(`Could not get current file sha for ${filePath} in ${branch}`, error.message);
      return null; // might be the file doesn't exist
    }
}


async function updateFile(owner, repo, filePath, branch, newContent, commitMessage, sha, token) {
    try {
      const base64Content = Buffer.from(newContent, 'utf-8').toString('base64');
  
      const body = {
        message: commitMessage,
        content: base64Content,
        branch: branch
      };
      if (sha) {
        body.sha = sha; 
      }
  
      const res = await axiosInstance.put(
        `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
        body,
        { headers: { Authorization: `token ${token}` } }
      );
      return res.data; // Contains commit info, etc.
    } catch (error) {
      logger.error(`Error updating file ${filePath} in branch ${branch}:`, error.message);
      throw new Error('Could not update file');
    }
  }

  function bumpPackageJson(oldPackageJson, outdatedDeps) {
    const newPkg = { ...oldPackageJson };
    if (!newPkg.dependencies) {
      console.warn('No dependencies field in package.json');
      newPkg.dependencies = {};
    }
    for (const dep of outdatedDeps) {
      if (newPkg.dependencies[dep.packageName]) {
        newPkg.dependencies[dep.packageName] = `^${dep.latestVersion}`;
      }
      //--note can use flag to update conditionally 
      if(newPkg.devDependencies[dep.packageName]) {
        newPkg.devDependencies[dep.packageName] = `^${dep.latestVersion}`;
      }
      // if you want to handle devDependencies or other fields, extend logic here
    }
    return JSON.stringify(newPkg, null, 2); // a nicely formatted JSON string
  }
  
  module.exports = {
    getCurrentFileSha,
    updateFile,
    bumpPackageJson
  };