// server/src/index.ts
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import path from 'path';

// Database connection
import './db';

// Controllers
import authController from './controllers/auth.controller';
import repositoryController from './controllers/repository.controller';
import onboardingController from './controllers/onboarding.controller';
import scanController from './controllers/scan.controller';
import dependencyScanController from './controllers/dependency-scan.controller';

// Models for webhook handler
import Repository from './models/Repository';
import OnboardingConfig from './models/OnboardingConfig';
import User from './models/User';

// Services
import { createScan } from './services/scan.service';
import { DependencyScanService } from './services/dependency-scan.service';
import { scanScheduler } from './services/scan-scheduler.service';

// Middleware
import authenticateToken from './middleware/auth.middleware';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = 'http://localhost:8080';

// Middleware setup
app.use(cookieParser()); // Parse cookies
app.use(
  cors({
    origin: FRONTEND_URL, // Allow frontend domain
    credentials: true, // Allow cookies to be sent
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(morgan('short'));
app.use(bodyParser.json());

// Initialize scan scheduler
// The scheduler will automatically initialize when imported

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Auth Routes
app.get('/api/auth/github/login', authController.initiateGithubAuth);
app.get('/api/auth/github/callback', authController.handleGithubCallback);
app.get('/api/auth/me', authenticateToken, authController.getCurrentUser);
app.post('/api/auth/logout', authController.logout);

// Repository Routes
app.get(
  '/api/repositories/github',
  authenticateToken,
  repositoryController.fetchAndSaveRepositories
);
app.get(
  '/api/repositories',
  authenticateToken,
  repositoryController.getUserRepositories
);
app.get(
  '/api/repositories/:id',
  authenticateToken,
  repositoryController.getRepository
);
app.post(
  '/api/repositories/selection',
  authenticateToken,
  repositoryController.updateRepositorySelection
);

// Onboarding Routes
app.post(
  '/api/onboarding/config',
  authenticateToken,
  onboardingController.saveConfig
);
app.get(
  '/api/onboarding/config',
  authenticateToken,
  onboardingController.getConfig
);
app.get(
  '/api/onboarding/status',
  authenticateToken,
  onboardingController.getStatus
);

// Dependency Scan Routes - Using the new dependency scan controller
app.post(
  '/api/dependencies/scan',
  authenticateToken,
  dependencyScanController.initiateRepositoryScan // UPDATED: Using new controller
);
app.post(
  '/api/dependencies/scan/all',
  authenticateToken,
  dependencyScanController.initiateAllRepositoriesScan
);
app.get(
  '/api/dependencies/scan/:scanId/status',
  authenticateToken,
  dependencyScanController.getScanStatus
);
app.get(
  '/api/dependencies/scan/:scanId/outdated',
  authenticateToken,
  dependencyScanController.getOutdatedDependencies
);
app.post(
  '/api/dependencies/create-pr',
  authenticateToken,
  dependencyScanController.createDependencyUpdatePR
);
app.post(
  '/api/dependencies/trigger-scheduled-scan',
  authenticateToken,
  dependencyScanController.triggerScheduledScan
);
app.post(
  '/api/dependencies/update-schedule',
  authenticateToken,
  dependencyScanController.updateScanSchedule
);

// Legacy scan routes - using scanController for existing APIs
// These now work alongside the new controller for backward compatibility
app.get(
  '/api/dependencies/repo/:repoId/latest-scan',
  authenticateToken,
  scanController.getLatestRepositoryScan
);
app.get(
  '/api/dependencies/repo/:repoId/current-scan', // NEW: Added endpoint for current scan
  authenticateToken,
  dependencyScanController.getCurrentRepositoryScan
);
app.get(
  '/api/dependencies/repo/:repoId/history',
  authenticateToken,
  scanController.getRepositoryScanHistory
);
app.get(
  '/api/dependencies/repo/:repoId/vulnerabilities',
  authenticateToken,
  scanController.getRepositoryVulnerabilities
);
app.post(
  '/api/dependencies/analyze-risk',
  authenticateToken,
  scanController.analyzeUpdateRisk
);
app.get(
  '/api/dependencies/repo/:repoId/risk-analyses',
  authenticateToken,
  scanController.getRiskAnalyses
);

// // Test endpoint for debugging scan triggers
// app.post('/api/test/trigger-scan', authenticateToken, async (req, res) => {
//   try {
//     const userId = req.user!.id;
//     console.log(`Test endpoint: Triggering scan for user ${userId}`);

//     const user = await User.findById(userId);
//     if (!user || !user.githubToken) {
//       return res.status(400).json({ error: 'GitHub token not found' });
//     }

//     console.log(`Test endpoint: Found GitHub token, initiating scan...`);

//     const results = await scanScheduler.triggerScanForUser(userId);

//     console.log(`Test endpoint: Scan initiated`, results);

//     res.json({
//       success: true,
//       message: 'Test scan triggered',
//       results
//     });
//   } catch (error) {
//     console.error('Error in test scan trigger:', error);
//     res.status(500).json({ error: 'Test failed' });
//   }
// });

app.post('/api/test/schedule-test', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    console.log(`Setting up test schedule for user ${userId}`);

    await scanScheduler.scheduleForUser(userId, undefined, true);

    res.json({
      success: true,
      message:
        'Test schedule set up - will run every 2 minutes and immediately',
    });
  } catch (error) {
    console.error('Error setting up test schedule:', error);
    res.status(500).json({ error: 'Failed to set up test schedule' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;
