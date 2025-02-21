const axiosInstance = require('../utils/axiosLogger');

async function fetchPackageJson(owner, repo, branch = 'main') {
  try {
    // This endpoint returns the file's metadata and content in base64
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/package.json?ref=${branch}`;
    const response = await axiosInstance.get(url, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
    });

    // GitHub returns a base64-encoded string in response.data.content
    const { content, encoding } = response.data;
    if (!content) {
      throw new Error('No content found');
    }

    // Convert from base64 to a UTF-8 string
    const decodedContent = Buffer.from(content, encoding).toString('utf8');

    // Parse the decoded string as JSON
    return JSON.parse(decodedContent);
  } catch (error) {
    console.error(
      `Failed to fetch package.json for ${owner}/${repo}:`,
      error.message
    );
    return null; // Or rethrow the error, depending on your preference
  }
}

module.exports = { fetchPackageJson };
