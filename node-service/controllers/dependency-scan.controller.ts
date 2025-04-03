// controllers/dependency-scan.controller.ts
import { Request, Response } from 'express';
import { Types } from 'mongoose';
import logger from '../utils/logger';
import Repository from '../models/Repository';
import Scan from '../models/Scan';
import scanProcessManager from '../services/scan-process-manager.service';
import rabbitMQService, {
  QUEUE_PR_CREATION,
  QUEUE_VULNERABILITY_SCAN,
} from '../services/rabbitmq.service';
import { VulnerabilityScanMessage } from '../types/queue';
import { CreatePRRequestBody } from '../types/dto';
import { scanScheduler } from '../services/scan-scheduler.service';
import vulnerabilityScanService from '../services/vulnerability-scan.service';

const dependencyScanController = {
  /**
   * Initiate a manual scan for a repository using the process manager
   */
  initiateRepositoryScan: async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { repoId } = req.body;
      const includeVulnerabilities = req.body.includeVulnerabilities !== false; // Default to true
      const createPR = req.body.createPR !== false; // Default to true

      if (!repoId) {
        res.status(400).json({ error: 'Repository ID is required' });
        return;
      }

      // Validate repository exists and user has access
      const repository = await Repository.findOne({
        _id: repoId,
        userId,
      });

      if (!repository) {
        res
          .status(404)
          .json({ error: 'Repository not found or access denied' });
        return;
      }

      // Use the process manager to initiate the scan
      const scan = await scanProcessManager.initiateScan(userId, repoId, {
        includeVulnerabilities,
        createPR,
      });

      res.status(201).json({
        success: true,
        message: 'Scan initiated successfully',
        scanId: scan._id,
        status: scan.status,
        state: scan.state,
        willScanVulnerabilities: includeVulnerabilities,
        willCreatePR: createPR,
        vulnerabilityProvider: 'OSV',
      });
    } catch (error) {
      logger.error('Error initiating repository scan:', error);
      res.status(500).json({
        error: 'Failed to initiate scan',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },

  /**
   * Initiate scans for all selected repositories
   */
  initiateAllRepositoriesScan: async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const includeVulnerabilities = req.body.includeVulnerabilities !== false; // Default to true
      const createPR = req.body.createPR !== false; // Default to true

      // Get selected repositories
      const repositories = await Repository.find({
        userId,
        isRepoSelected: true,
      });

      if (repositories.length === 0) {
        res
          .status(404)
          .json({ error: 'No repositories selected for scanning' });
        return;
      }

      // Initiate scans for all repositories
      const results: Record<string, any> = {};

      for (const repo of repositories) {
        const scan = await scanProcessManager.initiateScan(
          userId,
          repo._id.toString(),
          {
            includeVulnerabilities,
            createPR,
          }
        );

        results[repo.name] = {
          scanId: scan._id,
          state: scan.state,
          repoId: repo._id,
        };
      }

      res.json({
        success: true,
        message: `Scan initiated for ${
          Object.keys(results).length
        } repositories`,
        scans: results,
      });
    } catch (error) {
      logger.error('Error initiating scans for all repositories:', error);
      res.status(500).json({ error: 'Failed to initiate scans' });
    }
  },

  /**
   * Get scan status and details
   */
  getScanStatus: async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { scanId } = req.params;

      if (!Types.ObjectId.isValid(scanId)) {
        res.status(400).json({ error: 'Invalid scan ID format' });
        return;
      }

      // Get scan document
      const scan = await Scan.findOne({
        _id: scanId,
        userId,
      });

      if (!scan) {
        res.status(404).json({ error: 'Scan not found or access denied' });
        return;
      }

      // Get process state information
      const stateInfo = await scanProcessManager.getScanState(scanId);

      // Prepare response
      const response = {
        scanId: scan._id,
        repositoryId: scan.repositoryId,
        status: scan.status,
        createdAt: scan.createdAt,
        startedAt: scan.startedAt,
        completedAt: scan.completedAt,
        outdatedCount: scan.outdatedCount,
        vulnerabilityCount: scan.vulnerabilityCount,
        highSeverityCount: scan.highSeverityCount,
        errorMessage: scan.errorMessage,
        prNumber: scan.prNumber,
        prUrl: scan.prUrl,
        // State machine information
        state: stateInfo?.currentState || scan.status,
        stateHistory: stateInfo?.history || [],
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error getting scan status:', error);
      res.status(500).json({
        error: 'Failed to get scan status',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },

  /**
   * Get outdated dependencies from a scan
   */
  getOutdatedDependencies: async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { scanId } = req.params;

      const scan = await Scan.findOne({ _id: scanId, userId });

      if (!scan) {
        res.status(404).json({ error: 'Scan not found' });
        return;
      }

      const outdatedDependencies = scan.dependencies.filter(
        (dep) => dep.isOutdated
      );

      res.json({
        scanId: scan._id,
        outdatedCount: outdatedDependencies.length,
        dependencies: outdatedDependencies,
        completedAt: scan.completedAt,
      });
    } catch (error) {
      logger.error('Error getting outdated dependencies:', error);
      res.status(500).json({ error: 'Failed to get outdated dependencies' });
    }
  },

  /**
   * Manually create a PR for dependency updates
   */
  createDependencyUpdatePR: async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { scanId, repoId } = req.body as CreatePRRequestBody;

      if (!scanId || !repoId) {
        res
          .status(400)
          .json({ error: 'Scan ID and Repository ID are required' });
        return;
      }

      // Verify that scan exists and belongs to user
      const scan = await Scan.findOne({ _id: scanId, userId });
      if (!scan) {
        res.status(404).json({ error: 'Scan not found' });
        return;
      }

      // Transition scan to PR creation state
      await scanProcessManager.transitionState(scanId, 'pr-creation');

      // Queue PR creation job
      await rabbitMQService.sendToQueue(QUEUE_PR_CREATION, {
        scanId,
        repositoryId: repoId,
        userId,
      });

      res.json({
        success: true,
        message: 'Pull request creation has been queued',
        status: 'processing',
      });
    } catch (error) {
      logger.error('Error creating dependency update PR:', error);
      res.status(500).json({ error: 'Failed to create PR' });
    }
  },

  /**
   * Trigger a scheduled scan manually
   */
  triggerScheduledScan: async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;

      const results = await scanScheduler.triggerScanForUser(userId);

      if (!results) {
        res.status(400).json({ error: 'Failed to trigger scan' });
        return;
      }

      res.json({
        success: true,
        message: `Scan triggered for ${
          Object.keys(results).length
        } repositories`,
        scans: results,
      });
    } catch (error) {
      logger.error('Error triggering scheduled scan:', error);
      res.status(500).json({ error: 'Failed to trigger scan' });
    }
  },

  /**
   * Update scan schedule for a user
   */
  updateScanSchedule: async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;

      // Schedule will be updated based on the user's current config
      await scanScheduler.scheduleForUser(userId);

      res.json({
        success: true,
        message: 'Scan schedule updated successfully',
      });
    } catch (error) {
      logger.error('Error updating scan schedule:', error);
      res.status(500).json({ error: 'Failed to update scan schedule' });
    }
  },

  /**
   * Get current scan information (regardless of status)
   * This endpoint returns the latest scan even if it's not completed
   */
  getCurrentRepositoryScan: async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      logger.info('Getting current scan for repository');
      const userId = req.user!.id;
      const { repoId } = req.params;

      logger.info('User ID:', { userId });
      logger.info('Repository ID:', { repoId });

      // Find the most recent scan for this repository (regardless of status)
      const currentScan = await Scan.findOne({
        repositoryId: repoId,
        userId: userId,
      }).sort({ createdAt: -1 });

      if (!currentScan) {
        // No scan exists yet - return appropriate response with 200 status
        logger.info('No scan found for repository:', { repoId });
        res.json({
          status: 'no_scan',
          message: 'No scan has been initiated for this repository yet',
          repository: repoId,
        });
        return;
      }

      // Get state information if available
      const stateInfo = await scanProcessManager.getScanState(
        currentScan._id.toString()
      );

      logger.info('Current scan found:', {
        id: currentScan._id,
        status: currentScan.status,
        state: stateInfo?.currentState || currentScan.state,
      });

      // Return scan information
      res.json({
        id: currentScan._id,
        status: currentScan.status,
        state: stateInfo?.currentState || currentScan.state,
        stateHistory: stateInfo?.history || [],
        createdAt: currentScan.createdAt,
        startedAt: currentScan.startedAt,
        completedAt: currentScan.completedAt,
        outdatedCount: currentScan.outdatedCount,
        vulnerabilityCount: currentScan.vulnerabilityCount,
        highSeverityCount: currentScan.highSeverityCount,
        errorMessage: currentScan.errorMessage,
        inProgress:
          currentScan.status === 'pending' ||
          currentScan.status === 'in-progress',
      });
    } catch (error) {
      console.error('Error fetching current scan:', error);
      res.status(500).json({ error: 'Failed to fetch current scan' });
    }
  },

  /**
   * Manually initiate vulnerability scan for a completed dependency scan
   */
  initiateVulnerabilityScan: async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { scanId } = req.body;

      if (!scanId) {
        res.status(400).json({ error: 'Scan ID is required' });
        return;
      }

      // Verify the scan exists and belongs to user
      const scan = await Scan.findOne({ _id: scanId, userId });
      if (!scan) {
        res.status(404).json({ error: 'Scan not found' });
        return;
      }

      // Only allow if scan is in appropriate state
      if (scan.state !== 'dependencies-scanned' && scan.state !== 'completed') {
        res.status(400).json({
          error: `Scan must be in 'dependencies-scanned' or 'completed' state to check vulnerabilities. Current state: ${scan.state}`,
        });
        return;
      }

      // Transition to vulnerability scanning state
      await scanProcessManager.transitionState(
        scanId,
        'vulnerability-scanning'
      );

      // Get scan options from request
      const options = {
        quickScan: req.body.quickScan === true,
        excludeDevDependencies: req.body.excludeDevDependencies === true,
        excludeHighRiskOnly: req.body.excludeHighRiskOnly === true,
        batchSize: req.body.batchSize || 10,
      };

      // Queue vulnerability scan job
      await rabbitMQService.sendToQueue<VulnerabilityScanMessage>(
        QUEUE_VULNERABILITY_SCAN,
        {
          scanId,
          userId,
          options,
        }
      );

      res.json({
        success: true,
        message: 'Vulnerability scan initiated using OSV database',
        scanId,
      });
    } catch (error) {
      logger.error('Error initiating vulnerability scan:', error);
      res.status(500).json({ error: 'Failed to initiate vulnerability scan' });
    }
  },

  /**
   * Get vulnerability summary for a scan
   */
  getVulnerabilitySummary: async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { scanId } = req.params;

      // Verify the scan exists and belongs to user
      const scan = await Scan.findOne({ _id: scanId, userId });
      if (!scan) {
        res.status(404).json({ error: 'Scan not found' });
        return;
      }

      // Check if scan has been completed
      if (scan.status !== 'completed') {
        res.status(400).json({
          error: 'Vulnerability scanning has not been completed for this scan',
        });
        return;
      }

      // Get vulnerability summary
      const summary = await vulnerabilityScanService.getVulnerabilitySummary(
        scanId
      );

      res.json({
        scanId,
        ...summary,
        scannedAt: scan.completedAt,
        dataSource: 'OSV',
      });
    } catch (error) {
      logger.error('Error getting vulnerability summary:', error);
      res.status(500).json({ error: 'Failed to get vulnerability summary' });
    }
  },

  /**
   * Get vulnerability details for a specific dependency
   */
  getDependencyVulnerabilities: async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { scanId, packageName } = req.params;

      // Verify the scan exists and belongs to user
      const scan = await Scan.findOne({ _id: scanId, userId });
      if (!scan) {
        res.status(404).json({ error: 'Scan not found' });
        return;
      }

      // Find the dependency
      const dependency = scan.dependencies.find(
        (dep) => dep.packageName === packageName
      );

      if (!dependency) {
        res.status(404).json({ error: 'Dependency not found in scan' });
        return;
      }

      res.json({
        packageName: dependency.packageName,
        currentVersion: dependency.currentVersion,
        latestVersion: dependency.latestVersion,
        vulnerabilities: dependency.vulnerabilities || [],
        dataSource: 'OSV',
      });
    } catch (error) {
      logger.error('Error getting dependency vulnerabilities:', error);
      res
        .status(500)
        .json({ error: 'Failed to get dependency vulnerabilities' });
    }
  },
};

export default dependencyScanController;
