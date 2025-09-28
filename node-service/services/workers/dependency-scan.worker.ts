// workers/dependency-scan.worker.ts
import { Types } from 'mongoose';
import logger from '../../utils/logger';
import rabbitMQService, {
  QUEUE_SCAN_REPOSITORY,
} from '../../services/rabbitmq.service';
import { ScanRepositoryMessage } from '../../types/queue';
import { DependencyScanService } from '../../services/dependency-scan.service';
import User from '../../models/User';
import scanProcessManager from '../../services/scan-process-manager.service';

class DependencyScanWorker {
  /**
   * Initialize the worker to consume jobs from the scan repository queue
   */
  public async start(): Promise<void> {
    try {
      logger.info('Starting Dependency Scan Worker');

      // Start consuming from scan repository queue
      await rabbitMQService.consumeQueue<ScanRepositoryMessage>(
        QUEUE_SCAN_REPOSITORY,
        this.processScanJob.bind(this)
      );

      logger.info('Dependency Scan Worker is running');
    } catch (error) {
      logger.error('Error starting Dependency Scan Worker:', error);
      throw error;
    }
  }

  /**
   * Process a repository scan job
   */
  private async processScanJob(message: ScanRepositoryMessage): Promise<void> {
    const { scanId, repositoryId, userId, includeVulnerabilities } = message;
    logger.info(
      `Processing dependency scan job: scanId=${scanId}, repoId=${repositoryId}, userId=${userId}`
    );

    try {
      // Get user's GitHub token
      const user = await User.findById(userId);
      if (!user || !user.githubToken) {
        throw new Error('GitHub token not found for user');
      }

      // Create scan service instance
      const scanService = new DependencyScanService(userId, user.githubToken);

      // Execute the scan
      const scan = await scanService.scanRepository(repositoryId, scanId);

      if (!scan) {
        throw new Error('Scan failed to complete');
      }

      // Notify process manager of completion
      await scanProcessManager.handleDependencyScanComplete(
        scanId,
        scan.status as 'completed' | 'failed',
        {
          outdatedCount: scan.outdatedCount,
          errorMessage: scan.errorMessage,
        }
      );

      logger.info(`Dependency scan completed successfully: scanId=${scanId}`);
    } catch (error) {
      logger.error(`Error processing scan job for scanId=${scanId}:`, error);

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error in scan worker';

      // Notify process manager of failure
      await scanProcessManager.handleScanFailure(scanId, errorMessage);
    }
  }
}

export const dependencyScanWorker = new DependencyScanWorker();

// Start worker if executed directly
if (require.main === module) {
  dependencyScanWorker.start().catch((err) => {
    logger.error('Failed to start dependency scan worker:', err);
    process.exit(1);
  });
}

export default dependencyScanWorker;
