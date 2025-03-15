// controllers/dependency-scan.controller.ts
import { Request, Response } from 'express';
import {
  DependencyScanService,
  initiateAutomaticScan,
} from '../services/dependency-scan.service';
import { scanScheduler } from '../services/scan-scheduler.service';
import {
  createScan,
  getLatestScan,
  getScanHistory,
} from '../services/scan.service';
import Scan from '../models/Scan';
import User from '../models/User';

interface CreatePRRequestBody {
  scanId: string;
  repoId: string;
}

const dependencyScanController = {
  /**
   * Initiate a manual scan for a repository
   */
  initiateRepositoryScan: async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { repoId } = req.body;

      if (!repoId) {
        res.status(400).json({ error: 'Repository ID is required' });
        return;
      }

      // Create scan record
      const scan = await createScan(userId, repoId);

      // Get user's GitHub token
      const user = await User.findById(userId);
      if (!user || !user.githubToken) {
        res.status(400).json({ error: 'GitHub token not found' });
        return;
      }

      // Start scan in background
      const scanService = new DependencyScanService(userId, user.githubToken);

      // Don't await this - it will run in the background
      scanService
        .scanRepository(repoId, scan._id.toString())
        .then(async (completedScan) => {
          if (
            completedScan &&
            completedScan.status === 'completed' &&
            completedScan.outdatedCount > 0
          ) {
            // Automatically create PR if outdated dependencies are found
            await scanService.createDependencyUpdatePR(
              completedScan._id.toString(),
              repoId
            );
          }
        })
        .catch((error) => {
          console.error('Error in scan process:', error);
        });

      res.json({
        success: true,
        message: 'Scan initiated',
        scanId: scan._id,
      });
    } catch (error) {
      console.error('Error initiating scan:', error);
      res.status(500).json({ error: 'Failed to initiate scan' });
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

      // Get user's GitHub token
      const user = await User.findById(userId);
      if (!user || !user.githubToken) {
        res.status(400).json({ error: 'GitHub token not found' });
        return;
      }

      // Start scans
      const results = await initiateAutomaticScan(userId, user.githubToken);

      res.json({
        success: true,
        message: `Scan initiated for ${
          Object.keys(results).length
        } repositories`,
        scans: results,
      });
    } catch (error) {
      console.error('Error initiating scans for all repositories:', error);
      res.status(500).json({ error: 'Failed to initiate scans' });
    }
  },

  /**
   * Get scan status
   */
  getScanStatus: async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { scanId } = req.params;

      const scan = await Scan.findOne({ _id: scanId, userId });

      if (!scan) {
        res.status(404).json({ error: 'Scan not found' });
        return;
      }

      res.json({
        id: scan._id,
        status: scan.status,
        outdatedCount: scan.outdatedCount,
        startedAt: scan.startedAt,
        completedAt: scan.completedAt,
        errorMessage: scan.errorMessage,
      });
    } catch (error) {
      console.error('Error getting scan status:', error);
      res.status(500).json({ error: 'Failed to get scan status' });
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
      console.error('Error getting outdated dependencies:', error);
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

      // Get user's GitHub token
      const user = await User.findById(userId);
      if (!user || !user.githubToken) {
        res.status(400).json({ error: 'GitHub token not found' });
        return;
      }

      // Create PR
      const scanService = new DependencyScanService(userId, user.githubToken);
      const pullRequest = await scanService.createDependencyUpdatePR(
        scanId,
        repoId
      );

      if (!pullRequest) {
        res.status(400).json({
          error: 'No outdated dependencies to update or PR creation failed',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Pull request created successfully',
        pullRequest: {
          url: pullRequest.html_url,
          number: pullRequest.number,
          title: pullRequest.title,
        },
      });
    } catch (error) {
      console.error('Error creating dependency update PR:', error);
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
      console.error('Error triggering scheduled scan:', error);
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
      console.error('Error updating scan schedule:', error);
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
      const userId = req.user!.id;
      const { repoId } = req.params;

      // Convert IDs to ObjectId
      // const objectUserId = toObjectId(userId);
      // const objectRepoId = toObjectId(repoId);

      // Find the most recent scan for this repository (regardless of status)
      const currentScan = await Scan.findOne({
        repositoryId: repoId,
        userId: userId,
      }).sort({ createdAt: -1 });

      if (!currentScan) {
        // No scan exists yet - return appropriate response with 200 status
        res.json({
          status: 'no_scan',
          message: 'No scan has been initiated for this repository yet',
          repository: repoId,
        });
        return;
      }

      // Return scan information
      res.json({
        id: currentScan._id,
        status: currentScan.status,
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
};

export default dependencyScanController;
