// server/src/index.ts
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import path from 'path';
import logger from './utils/logger';
import http from 'http';

// Database connection
import './db';

// Initialize RabbitMQ
import rabbitMQService from './services/rabbitmq.service';

// Controllers
import authController from './controllers/auth.controller';
import repositoryController from './controllers/repository.controller';
import onboardingController from './controllers/onboarding.controller';
import dependencyScanController from './controllers/dependency-scan.controller';
import webhookController from './controllers/webhook.controller';

// Initialize scan scheduler
// The scheduler will automatically initialize when imported
import { scanScheduler } from './services/scan-scheduler.service';
import { initializeWebSocketService } from './services/websocket.service';
import { QUEUE_WEBSOCKET_NOTIFICATION } from './services/rabbitmq.service';

// Middleware
import authenticateToken from './middleware/auth.middleware';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = 'http://localhost:8080';

// Create HTTP server
const server = http.createServer(app);

const webSocketService = initializeWebSocketService(server);

// Initialize WebSocket service
import websocketNotificationWorker from './services/workers/websocket-notification.worker';

import { WorkerManager } from './services/workers/worker-manager';

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
app.use((req, res, next) => {
  logger.info(`Incoming request: ${req.method} ${req.url}`, {
    method: req.method,
    url: req.url,
    body: req.body,
  });
  next();
});
app.use(bodyParser.json());

rabbitMQService.init().catch((err) => {
  logger.error('Failed to initialize RabbitMQ:', err);
  // Continue server startup even if RabbitMQ fails
  // The service will attempt to reconnect later
});

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
  '/api/dependencies/update-schedule',
  authenticateToken,
  dependencyScanController.updateScanSchedule
);

app.get(
  '/api/dependencies/repo/:repoId/current-scan', // NEW: Added endpoint for current scan
  authenticateToken,
  dependencyScanController.getCurrentRepositoryScan
);

app.post(
  '/api/vulnerabilities/scan',
  authenticateToken,
  dependencyScanController.initiateVulnerabilityScan
);
app.get(
  '/api/vulnerabilities/summary/:scanId',
  authenticateToken,
  dependencyScanController.getVulnerabilitySummary
);
app.get(
  '/api/vulnerabilities/dependency/:scanId/:packageName',
  authenticateToken,
  dependencyScanController.getDependencyVulnerabilities
);

// First initialize WebSocket notification worker
logger.info('Starting WebSocket notification worker');
websocketNotificationWorker.start().catch((err) => {
  logger.error('Failed to start websocket notification worker:', err);
});

// Then start other workers
logger.info('Starting dependency scanner workers...');
const workerManager = new WorkerManager();
workerManager.start().catch((error) => {
  logger.error('Error starting workers:', error);
});

// WebSocket test endpoint
app.get('/api/ws-test', authenticateToken, async (req, res) => {
  const userId = req.user!.id;

  try {
    // Send a test notification through the queue instead of directly
    const success = await rabbitMQService.sendToQueue(
      QUEUE_WEBSOCKET_NOTIFICATION,
      {
        type: 'test_message',
        data: {
          userId,
          message: 'Test message from server',
          timestamp: new Date().toISOString(),
        },
      }
    );

    if (success) {
      res.json({
        success: true,
        message: 'Test message queued successfully',
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to queue test message',
      });
    }
  } catch (error) {
    logger.error('Error sending test message:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing test request',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

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

app.post('/api/webhooks/github/push', webhookController.handlePushEvent);

// Start server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Process termination handler for graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');

  server.close(() => {
    logger.info('HTTP server closed');

    // Close RabbitMQ connection
    rabbitMQService
      .close()
      .catch((err) => {
        logger.error('Error closing RabbitMQ connection:', err);
      })
      .finally(() => {
        logger.info('Server shutdown complete');
        process.exit(0);
      });
  });

  // Force shutdown after 10 seconds if graceful shutdown fails
  setTimeout(() => {
    logger.error(
      'Could not close connections in time, forcefully shutting down'
    );
    process.exit(1);
  }, 10000);
});

export default app;
