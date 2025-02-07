// node-service/routes/auth.routes.js

const { Router } = require('express');
const axios = require('axios');
const User = require('../../models/User');
const router = Router();

// Redirect user to GitHub's OAuth page
router.get('/github', (req, res) => {
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=${process.env.GITHUB_REDIRECT_URI}&scope=repo,user`;
  return res.redirect(githubAuthUrl);
});

// Handle GitHub's callback with ?code=XYZ
router.get('/github/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).json({ error: 'No code provided' });
  }

  try {
    // 1. Exchange code for access token
    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: process.env.GITHUB_REDIRECT_URI,
      },
      { headers: { Accept: 'application/json' } }
    );

    const { access_token } = tokenResponse.data;
    if (!access_token) {
      return res.status(400).json({ error: 'No access token received' });
    }

    // 2. Fetch the user's GitHub profile
    const userProfile = await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `token ${access_token}`,
      },
    });

    const { login: githubUsername, id: githubId } = userProfile.data;

    // 3. Save/update the user in Mongo
    let user = await User.findOne({ githubId });
    if (!user) {
      user = await User.create({
        githubId,
        username: githubUsername,
        githubToken: access_token,
      });
    } else {
      user.githubToken = access_token;
      user.username = githubUsername;
      await user.save();
    }

    // 4. Redirect or return some data
    // For a simpler approach, redirect with userId in query
    return res.redirect(
      `${process.env.FRONTEND_URL}/dashboard?userId=${user._id}`
    );
  } catch (error) {
    console.error('GitHub OAuth callback error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
