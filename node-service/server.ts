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

// Dependency Scan Routes
app.post(
  '/api/dependencies/scan',
  authenticateToken,
  scanController.initiateRepositoryScan
);
app.get(
  '/api/dependencies/repo/:repoId/latest-scan',
  authenticateToken,
  scanController.getLatestRepositoryScan
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

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;
