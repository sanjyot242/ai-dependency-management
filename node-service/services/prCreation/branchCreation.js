const { inc } = require('semver');
const axiosInstance = require('../../utils/axiosLogger');
const logger = require('../../utils/logger');

async function getDefaultBranchSha({ owner, repo, baseBranch = "main", token }) {
    // Log function entry with key parameters (avoid logging sensitive data like the full token)
    logger.debug(
      'Data received inside getDefaultBranchSHA', { owner, repo, baseBranch }
    );
  
    const url = `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${baseBranch}`;
    logger.debug('Calling GitHub API', { url });
  
    try {
      const refRes = await axiosInstance.get(url, {
        headers: { Authorization: `token ${token}` },
      });
      
  
      const baseSha = refRes.data.object.sha;
      logger.info(
        `Default branch ${baseBranch} SHA fetched successfully`
      );
      return baseSha;
    } catch (error) {
      // Log error details along with the context
     logger.error('Error fetching default branch SHA', error.message);
      return null;
    }
  }
  


async function createBranch({owner , repo , newBranchName , baseSha , token}){
    logger.debug(owner, repo, newBranchName, baseSha, token);   
    try{
        const body = {
            ref: `refs/heads/${newBranchName}`,
            sha: baseSha,
        };

        axiosInstance.post(`https://api.github.com/repos/${owner}/${repo}/git/refs`, body, {
            headers: {
                Authorization: `token ${token}`}});

        logger.info(`Branch ${newBranchName} created successfully`);
    }catch{
        logger.error('Error Creating Branch', error);
    }
}


module.exports = {
    getDefaultBranchSha,
    createBranch
}



