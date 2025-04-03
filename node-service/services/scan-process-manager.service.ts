// services/scan-process-manager.service.ts
import { Types } from 'mongoose';
import logger from '../utils/logger';
import { IScan,ScanState,StateTransition } from '../types/models';
import Scan  from '../models/Scan';
import rabbitMQService, {
  QUEUE_SCAN_REPOSITORY,
  QUEUE_VULNERABILITY_SCAN,
  QUEUE_PR_CREATION,
  QUEUE_WEBSOCKET_NOTIFICATION,
} from './rabbitmq.service';
import {
  ScanRepositoryMessage,
  VulnerabilityScanMessage,
  CreatePRMessage,
  ScanCompleteMessage,
} from '../types/queue-messages.types';

/**
 * Service for managing the scanning process workflow
 * Implements the Process Manager pattern for coordinating distributed processes
 */
export class ScanProcessManager {
  /**
   * Initialize a new scan process
   * @param userId User ID
   * @param repositoryId Repository ID
   * @param options Scan options
   * @returns The created scan document
   */
  public async initiateScan(
    userId: string,
    repositoryId: string,
    options: {
      includeVulnerabilities?: boolean;
      createPR?: boolean;
    } = {}
  ): Promise<IScan> {
    logger.info(
      `Initiating scan process for repository ${repositoryId}, user ${userId}`
    );

    try {
      // Create a new scan document with initial state
      const scan = await Scan.create({
        userId: new Types.ObjectId(userId),
        repositoryId: new Types.ObjectId(repositoryId),
        status: 'pending', // Traditional status field
        state: 'initiated', // State machine state
        stateHistory: [
          {
            state: 'initiated',
            timestamp: new Date(),
            metadata: { options },
          },
        ],
        includeVulnerabilities: options.includeVulnerabilities ?? false,
        createPR: options.createPR ?? false,
        createdAt: new Date(),
      });

      // Transition to dependency scanning state
      await this.transitionState(scan._id.toString(), 'dependency-scanning');

      // Queue the dependency scan job
      await rabbitMQService.sendToQueue<ScanRepositoryMessage>(
        QUEUE_SCAN_REPOSITORY,
        {
          scanId: scan._id.toString(),
          repositoryId,
          userId,
          includeVulnerabilities: options.includeVulnerabilities ?? false,
        }
      );

      return scan;
    } catch (error) {
      logger.error(`Error initiating scan process:`, error);
      throw error;
    }
  }

  /**
   * Handle dependency scan completion event
   * @param message Scan complete message
   */
  public async handleDependencyScanComplete(
    scanId: string,
    status: 'completed' | 'failed',
    data: {
      outdatedCount?: number;
      errorMessage?: string;
    } = {}
  ): Promise<void> {
    logger.info(
      `Handling dependency scan completion: scanId=${scanId}, status=${status}`
    );

    try {
      const scan = await Scan.findById(scanId);
      if (!scan) {
        throw new Error(`Scan ${scanId} not found`);
      }

      if (status === 'failed') {
        // Handle failure case
        return this.handleScanFailure(
          scanId,
          data.errorMessage || 'Unknown error in dependency scan'
        );
      }

      // Transition to dependencies-scanned state
      await this.transitionState(scanId, 'dependencies-scanned', {
        outdatedCount: data.outdatedCount,
      });

      // Determine next step based on scan options and results
      if (scan.includeVulnerabilities && (data.outdatedCount ?? 0) > 0) {
        // Proceed with vulnerability scanning
        await this.transitionState(scanId, 'vulnerability-scanning');
        await this.queueVulnerabilityScan(scanId, scan.userId.toString());
      } else if (scan.createPR && (data.outdatedCount ?? 0) > 0) {
        // Proceed with PR creation
        await this.transitionState(scanId, 'pr-creation');
        await this.queuePRCreation(
          scanId,
          scan.repositoryId.toString(),
          scan.userId.toString()
        );
      } else {
        // No further steps needed, complete the scan
        await this.completeScan(scanId);
      }

      // Send WebSocket notification
      await this.sendWebSocketNotification(scan.userId.toString(), {
        scanId,
        repositoryId: scan.repositoryId.toString(),
        userId: scan.userId.toString(),
        status: 'completed',
        scanType: 'dependency',
        completedAt: new Date(),
        outdatedCount: data.outdatedCount,
      });
    } catch (error) {
      logger.error(
        `Error handling dependency scan completion for scanId=${scanId}:`,
        error
      );
      await this.handleScanFailure(
        scanId,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Queue a vulnerability scan job
   */
  private async queueVulnerabilityScan(
    scanId: string,
    userId: string
  ): Promise<void> {
    logger.info(`Queueing vulnerability scan for scanId=${scanId}`);

    await rabbitMQService.sendToQueue<VulnerabilityScanMessage>(
      QUEUE_VULNERABILITY_SCAN,
      {
        scanId,
        userId,
        options: {
          batchSize: 20, // Use larger batch size for efficiency
        },
      }
    );
  }

  /**
   * Queue a PR creation job
   */
  private async queuePRCreation(
    scanId: string,
    repositoryId: string,
    userId: string
  ): Promise<void> {
    logger.info(`Queueing PR creation for scanId=${scanId}`);

    await rabbitMQService.sendToQueue<CreatePRMessage>(QUEUE_PR_CREATION, {
      scanId,
      repositoryId,
      userId,
    });
  }

  /**
   * Handle vulnerability scan completion event
   * @param scanId Scan ID
   * @param status Completion status
   * @param data Additional data
   */
  public async handleVulnerabilityScanComplete(
    scanId: string,
    status: 'completed' | 'failed',
    data: {
      vulnerabilityCount?: number;
      highSeverityCount?: number;
      errorMessage?: string;
    } = {}
  ): Promise<void> {
    logger.info(
      `Handling vulnerability scan completion: scanId=${scanId}, status=${status}`
    );

    try {
      const scan = await Scan.findById(scanId);
      if (!scan) {
        throw new Error(`Scan ${scanId} not found`);
      }

      if (status === 'failed') {
        // Handle failure case
        return this.handleScanFailure(
          scanId,
          data.errorMessage || 'Unknown error in vulnerability scan'
        );
      }

      // Transition to vulnerabilities-scanned state
      await this.transitionState(scanId, 'vulnerabilities-scanned', {
        vulnerabilityCount: data.vulnerabilityCount,
        highSeverityCount: data.highSeverityCount,
      });

      // Determine if PR creation is needed
      if (scan.createPR && (scan.outdatedCount ?? 0) > 0) {
        // Proceed with PR creation
        await this.transitionState(scanId, 'pr-creation');
        await this.queuePRCreation(
          scan._id.toString(),
          scan.repositoryId.toString(),
          scan.userId.toString()
        );
      } else {
        // No further steps needed, complete the scan
        await this.completeScan(scanId);
      }

      // Send WebSocket notification
      await this.sendWebSocketNotification(scan.userId.toString(), {
        scanId,
        repositoryId: scan.repositoryId.toString(),
        userId: scan.userId.toString(),
        status: 'completed',
        scanType: 'vulnerability',
        completedAt: new Date(),
        vulnerabilityCount: data.vulnerabilityCount,
        highSeverityCount: data.highSeverityCount,
      });
    } catch (error) {
      logger.error(
        `Error handling vulnerability scan completion for scanId=${scanId}:`,
        error
      );
      await this.handleScanFailure(
        scanId,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Handle PR creation completion event
   * @param scanId Scan ID
   * @param success Whether PR creation was successful
   * @param prNumber PR number if created
   * @param prUrl PR URL if created
   * @param error Error message if failed
   */
  public async handlePRCreationComplete(
    scanId: string,
    success: boolean,
    prNumber?: number,
    prUrl?: string,
    error?: string
  ): Promise<void> {
    logger.info(
      `Handling PR creation completion: scanId=${scanId}, success=${success}`
    );

    try {
      const scan = await Scan.findById(scanId);
      if (!scan) {
        throw new Error(`Scan ${scanId} not found`);
      }

      if (!success) {
        // PR creation failed but this is not a scan failure
        // Just log the error and complete the scan
        logger.warn(
          `PR creation failed for scanId=${scanId}: ${
            error || 'No error details'
          }`
        );

        // Complete the scan with a warning
        return this.completeScan(scanId, {
          prCreationFailed: true,
          prCreationError: error,
        });
      }

      // Transition to pr-created state
      await this.transitionState(scanId, 'pr-created', {
        prNumber,
        prUrl,
      });

      // Update PR information on scan document
      await Scan.findByIdAndUpdate(scanId, {
        prNumber,
        prUrl,
      });

      // Complete the scan
      await this.completeScan(scanId);

      // Send WebSocket notification
      await this.sendPRNotification(scan.userId.toString(), scanId, {
        prNumber,
        prUrl,
        repository: scan.repositoryId.toString(),
      });
    } catch (error) {
      logger.error(
        `Error handling PR creation completion for scanId=${scanId}:`,
        error
      );
      // This is not a critical error, so still complete the scan
      await this.completeScan(scanId, {
        warning: `Error updating PR status: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      });
    }
  }

  /**
   * Mark a scan as completed
   * @param scanId Scan ID
   * @param metadata Additional metadata
   */
  public async completeScan(
    scanId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    logger.info(`Completing scan: scanId=${scanId}`);

    try {
      // Transition to completed state
      await this.transitionState(scanId, 'completed', metadata);

      // Update legacy status field
      const now = new Date();
      await Scan.findByIdAndUpdate(scanId, {
        status: 'completed',
        completedAt: now,
      });

      // Get the scan for notification
      const scan = await Scan.findById(scanId);
      if (!scan) {
        throw new Error(`Scan ${scanId} not found`);
      }

      // Send WebSocket notification for completion
      await this.sendWebSocketNotification(scan.userId.toString(), {
        scanId,
        repositoryId: scan.repositoryId.toString(),
        userId: scan.userId.toString(),
        status: 'completed',
        scanType: 'complete',
        completedAt: now,
        outdatedCount: scan.outdatedCount,
        vulnerabilityCount: scan.vulnerabilityCount,
        highSeverityCount: scan.highSeverityCount,
      });
    } catch (error) {
      logger.error(`Error completing scan ${scanId}:`, error);
      // Try to mark as failed if completion fails
      await this.handleScanFailure(
        scanId,
        `Error completing scan: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Handle scan failure
   * @param scanId Scan ID
   * @param error Error message
   */
  public async handleScanFailure(scanId: string, error: string): Promise<void> {
    logger.error(`Scan failure: scanId=${scanId}, error=${error}`);

    try {
      // Get current scan state to know what failed
      const scan = await Scan.findById(scanId);
      const currentState = scan?.state || 'unknown';

      // Transition to failed state
      await this.transitionState(scanId, 'failed', {
        error,
        failedDuringState: currentState,
      });

      // Update legacy status field
      const now = new Date();
      await Scan.findByIdAndUpdate(scanId, {
        status: 'failed',
        errorMessage: error,
        completedAt: now,
      });

      // Send WebSocket notification for failure
      if (scan) {
        await this.sendWebSocketNotification(scan.userId.toString(), {
          scanId,
          repositoryId: scan.repositoryId.toString(),
          userId: scan.userId.toString(),
          status: 'failed',
          scanType: currentState,
          completedAt: now,
          error,
        });
      }
    } catch (additionalError) {
      logger.error(
        `Error handling scan failure for ${scanId}:`,
        additionalError
      );
      // At this point we can only log the error
    }
  }

  /**
   * Transition a scan to a new state
   * @param scanId Scan ID
   * @param newState New state
   * @param metadata Additional metadata
   */
  public async transitionState(
    scanId: string,
    newState: ScanState,
    metadata?: Record<string, any>
  ): Promise<void> {
    logger.info(`Transitioning scan ${scanId} to state: ${newState}`);

    const transition: StateTransition = {
      state: newState,
      timestamp: new Date(),
      metadata,
    };

    await Scan.findByIdAndUpdate(scanId, {
      state: newState,
      $push: { stateHistory: transition },
      ...(metadata || {}), // Add any metadata as direct fields on the scan document
    });
  }

  /**
   * Get the current state of a scan
   * @param scanId Scan ID
   * @returns Current state and full state history
   */
  public async getScanState(
    scanId: string
  ): Promise<{ currentState: ScanState; history: StateTransition[] } | null> {
    const scan = await Scan.findById(scanId);
    if (!scan) return null;

    return {
      currentState: scan.state as ScanState,
      history: scan.stateHistory as StateTransition[],
    };
  }

  /**
   * Safely sends a WebSocket notification
   * @param userId User ID
   * @param notification Notification data
   * @returns Whether the notification was sent
   */
  private async sendWebSocketNotification(
    userId: string,
    notification: ScanCompleteMessage
  ): Promise<boolean> {
    try {
      // Instead of calling the WebSocket service directly, send to queue
      return await rabbitMQService.sendToQueue(QUEUE_WEBSOCKET_NOTIFICATION, {
        type: 'scan_complete',
        data: notification,
      });
    } catch (error) {
      logger.warn('Error sending WebSocket notification to queue:', error);
      return false;
    }
  }

  /**
   * Safely sends a PR created notification
   * @param userId User ID
   * @param scanId Scan ID
   * @param prDetails PR details
   * @returns Whether the notification was sent
   */
  private async sendPRNotification(
    userId: string,
    scanId: string,
    prDetails: any
  ): Promise<boolean> {
    try {
      // Send to queue instead of WebSocket service
      return await rabbitMQService.sendToQueue(QUEUE_WEBSOCKET_NOTIFICATION, {
        type: 'pr_created',
        data: {
          userId,
          scanId,
          prDetails,
        },
      });
    } catch (error) {
      logger.warn('Error sending PR notification to queue:', error);
      return false;
    }
  }
}

export const scanProcessManager = new ScanProcessManager();
export default scanProcessManager;
