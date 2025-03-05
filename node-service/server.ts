// server/src/index.ts

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import bodyParser from 'body-parser';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import path from 'path';
import crypto from 'crypto';

// Load environment variables

dotenv.config({ path: path.resolve(__dirname, '../.env') });
// Store OAuth state to prevent CSRF attacks
// In a production app, you'd use Redis or another persistent store
const oauthStateStore: Record<string, { redirectUri: string; expiresAt: number }> = {};

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GITHUB_REDIRECT_URI = process.env.GITHUB_REDIRECT_URI ;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8080';

console.log('GITHUB_CLIENT_ID:', process.env.GITHUB_CLIENT_ID);
console.log('GITHUB_CLIENT_SECRET:', process.env.GITHUB_CLIENT_SECRET);
console.log('GITHUB_REDIRECT_URI:', process.env.GITHUB_REDIRECT_URI);

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(bodyParser.json());

// Simplified authentication middleware
const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  // Get token from header
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }
  
  try {
    const user = jwt.verify(token, JWT_SECRET);
    (req as any).user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Auth Routes
app.get('/api/auth/github/login', (req, res) => {
  const redirectUri = req.query.redirectUri as string || '/dashboard';
  
  // Generate a random state parameter to prevent CSRF attacks
  const state = crypto.randomBytes(20).toString('hex');
  
  // Store the state and associated redirect URI
  // Set expiration to 10 minutes from now
  oauthStateStore[state] = {
    redirectUri,
    expiresAt: Date.now() + 10 * 60 * 1000
  };
  
  // Build GitHub OAuth URL
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${GITHUB_REDIRECT_URI}&scope=repo,user:email&state=${state}`;
  
  res.json({ authUrl: githubAuthUrl });
});


app.get('/api/auth/github/callback', async (req, res) => {
  const { code, state } = req.query;
  
  if (!code || !state) {
    return res.redirect(`${FRONTEND_URL}/login?error=oauth_error`);
  }
  
  // Verify state to prevent CSRF attacks
  const storedState = oauthStateStore[state as string];
  if (!storedState || storedState.expiresAt < Date.now()) {
    // Invalid or expired state
    delete oauthStateStore[state as string];
    return res.redirect(`${FRONTEND_URL}/login?error=invalid_state`);
  }
  
  try {
    // Exchange code for access token
    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${process.env.SERVER_URL || 'http://localhost:3001'}/api/auth/github/callback`
      },
      {
        headers: {
          Accept: 'application/json',
        },
      }
    );
    
    const { access_token } = tokenResponse.data;
    
    if (!access_token) {
      return res.redirect(`${FRONTEND_URL}/login?error=token_error`);
    }
    
    // Get user info
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `token ${access_token}`,
      },
    });
    
    // Get user emails
    const emailsResponse = await axios.get('https://api.github.com/user/emails', {
      headers: {
        Authorization: `token ${access_token}`,
      },
    });
    
    // Find primary email
    const primaryEmail = emailsResponse.data.find((email: any) => email.primary)?.email || emailsResponse.data[0]?.email;
    
    const user = {
      id: userResponse.data.id.toString(),
      name: userResponse.data.name || userResponse.data.login,
      email: primaryEmail || userResponse.data.email,
      avatarUrl: userResponse.data.avatar_url,
      githubUsername: userResponse.data.login,
      githubToken: access_token,
    };
    
    // In a real app, you would save the user to the database here
    
    // Check if this is a new user (in a real app, you would check your database)
    const isNewUser = true; // Placeholder, replace with actual logic
    
    // Create JWT
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '24h' });
    
    // Clean up state
    const { redirectUri } = storedState;
    delete oauthStateStore[state as string];
    
    // Redirect back to the frontend with the token (this approach should ONLY be used for local development)
    // For production, consider using a secure cookie or a temporary code exchange approach
    const redirectPath = isNewUser ? '/onboarding/welcome' : redirectUri;
    return res.redirect(`${FRONTEND_URL}${redirectPath}?token=${token}`);
  } catch (error) {
    console.error('GitHub authentication error:', error);
    return res.redirect(`${FRONTEND_URL}/login?error=authentication_failed`);
  }
});





app.get('/api/auth/me', authenticateToken, (req, res) => {
  // User is already attached to request by the middleware
  res.json((req as any).user);
});

app.post('/api/auth/logout', (req, res) => {
  // In a stateless JWT setup, the client is responsible for discarding the token
  res.json({ success: true });
});

// Repository Routes
app.get('/api/repositories/github', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    
    // Get repositories from GitHub
    const response = await axios.get('https://api.github.com/user/repos', {
      headers: {
        Authorization: `token ${user.githubToken}`,
      },
      params: {
        sort: 'updated',
        per_page: 100,
      },
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching repositories:', error);
    res.status(500).json({ error: 'Failed to fetch repositories' });
  }
});

app.post('/api/onboarding/repositories', authenticateToken, (req, res) => {
  try {
    const { repositories } = req.body;
    
    if (!repositories || !Array.isArray(repositories)) {
      return res.status(400).json({ error: 'Repositories array is required' });
    }
    
    // In a real app, you would save the selected repositories to the database
    
    res.json({ success: true, message: 'Repositories saved successfully' });
  } catch (error) {
    console.error('Error saving repositories:', error);
    res.status(500).json({ error: 'Failed to save repositories' });
  }
});

app.post('/api/onboarding/config', authenticateToken, (req, res) => {
  try {
    const { config } = req.body;
    
    if (!config) {
      return res.status(400).json({ error: 'Configuration is required' });
    }
    
    // In a real app, you would save the configuration to the database
    
    res.json({ success: true, message: 'Configuration saved successfully' });
  } catch (error) {
    console.error('Error saving configuration:', error);
    res.status(500).json({ error: 'Failed to save configuration' });
  }
});

app.get('/api/onboarding/status', authenticateToken, (req, res) => {
  // In a real app, you would check the actual status
  // For now, we'll simulate the status
  
  setTimeout(() => {
    res.json({
      repositoriesInitialized: true,
      configInitialized: true,
      scanStarted: true
    });
  }, 1000);
});

// Dependency Routes
app.post('/api/dependencies/scan', authenticateToken, (req, res) => {
  try {
    const { repoId } = req.body;
    
    if (!repoId) {
      return res.status(400).json({ error: 'Repository ID is required' });
    }
    
    // In a real app, you would trigger a scan for the repository
    // For now, we'll simulate a successful scan
    
    res.json({ 
      success: true, 
      message: 'Scan initiated',
      scanId: '123456' // Simulated scan ID
    });
  } catch (error) {
    console.error('Error initiating scan:', error);
    res.status(500).json({ error: 'Failed to initiate scan' });
  }
});

app.get('/api/dependencies/repo/:repoId/latest-scan', authenticateToken, (req, res) => {
  try {
    const { repoId } = req.params;
    
    // In a real app, you would fetch the latest scan from the database
    // For now, we'll return mock data
    
    const mockScan = {
      id: '123456',
      repoId,
      scannedAt: new Date().toISOString(),
      dependencies: [
        {
          packageName: 'react',
          currentVersion: '17.0.2',
          latestVersion: '18.2.0',
          isOutdated: true
        },
        {
          packageName: 'axios',
          currentVersion: '0.21.4',
          latestVersion: '1.3.2',
          isOutdated: true,
          vulnerabilities: [
            {
              id: 'CVE-2023-45857',
              severity: 'high',
              description: 'Axios vulnerable to Reflected Cross-Site Scripting'
            }
          ]
        }
      ]
    };
    
    res.json(mockScan);
  } catch (error) {
    console.error('Error fetching latest scan:', error);
    res.status(500).json({ error: 'Failed to fetch latest scan' });
  }
});

app.get('/api/dependencies/repo/:repoId/history', authenticateToken, (req, res) => {
  try {
    const { repoId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;
    
    // In a real app, you would fetch scan history from the database
    // For now, we'll return mock data
    
    const mockHistory = [];
    
    // Generate mock history entries
    for (let i = 0; i < limit; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      mockHistory.push({
        id: `scan-${i}`,
        repoId,
        scannedAt: date.toISOString(),
        outdatedDependencies: Math.floor(Math.random() * 10),
        vulnerabilities: Math.floor(Math.random() * 5)
      });
    }
    
    res.json(mockHistory);
  } catch (error) {
    console.error('Error fetching scan history:', error);
    res.status(500).json({ error: 'Failed to fetch scan history' });
  }
});

app.get('/api/dependencies/repo/:repoId/vulnerabilities', authenticateToken, (req, res) => {
  try {
    const { repoId } = req.params;
    
    // In a real app, you would fetch vulnerabilities from the database
    // For now, we'll return mock data
    
    const mockVulnerabilities = {
      scanId: '123456',
      scannedAt: new Date().toISOString(),
      vulnerableDependencies: [
        {
          packageName: 'axios',
          currentVersion: '0.21.4',
          latestVersion: '1.3.2',
          vulnerabilities: [
            {
              id: 'CVE-2023-45857',
              severity: 'high',
              description: 'Axios vulnerable to Reflected Cross-Site Scripting',
              references: ['https://nvd.nist.gov/vuln/detail/CVE-2023-45857']
            }
          ]
        },
        {
          packageName: 'lodash',
          currentVersion: '4.17.15',
          latestVersion: '4.17.21',
          vulnerabilities: [
            {
              id: 'CVE-2021-23337',
              severity: 'high',
              description: 'Prototype Pollution in Lodash',
              references: ['https://nvd.nist.gov/vuln/detail/CVE-2021-23337']
            }
          ]
        }
      ],
      totalVulnerabilities: 2
    };
    
    res.json(mockVulnerabilities);
  } catch (error) {
    console.error('Error fetching vulnerabilities:', error);
    res.status(500).json({ error: 'Failed to fetch vulnerabilities' });
  }
});

app.post('/api/dependencies/analyze-risk', authenticateToken, (req, res) => {
  try {
    const { packageName, currentVersion, newVersion } = req.body;
    
    if (!packageName || !currentVersion || !newVersion) {
      return res.status(400).json({ error: 'Package name, current version, and new version are required' });
    }
    
    // In a real app, you would use the AI service to analyze risk
    // For now, we'll return mock data
    
    // Simulate some basic risk analysis
    const versionParts = {
      current: currentVersion.split('.').map(Number),
      new: newVersion.split('.').map(Number)
    };
    
    let riskScore = 0;
    
    // Major version change is higher risk
    if (versionParts.new[0] > versionParts.current[0]) {
      riskScore = 70 + Math.floor(Math.random() * 20);
    } 
    // Minor version change is medium risk
    else if (versionParts.new[1] > versionParts.current[1]) {
      riskScore = 30 + Math.floor(Math.random() * 30);
    } 
    // Patch version change is low risk
    else {
      riskScore = 10 + Math.floor(Math.random() * 20);
    }
    
    const mockAnalysis = {
      packageName,
      version: newVersion,
      riskScore,
      breakingChanges: riskScore > 60,
      confidenceLevel: 75,
      recommendations: [
        'Review the changelog before updating',
        'Run comprehensive tests after updating',
        riskScore > 60 ? 'Consider updating in a separate PR' : 'Safe to update in a batch with other dependencies'
      ]
    };
    
    res.json(mockAnalysis);
  } catch (error) {
    console.error('Error analyzing risk:', error);
    res.status(500).json({ error: 'Failed to analyze risk' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;