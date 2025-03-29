// workers/pr-creation.worker.ts
import logger from '../../utils/logger';
import rabbitMQService, {
  QUEUE_PR_CREATION,
} from '../../services/rabbitmq.service';
import { CreatePRMessage } from '../../types/queue-messages.types';
import { DependencyScanService } from '../../services/dependency-scan.service';
import User from '../../models/User';
import Scan from '../../models/Scan';
import scanProcessManager from '../../services/scan-process-manager.service';

class PRCreationWorker {
  /**
   * Initialize the worker to consume jobs from the PR creation queue
   */
  public async start(): Promise<void> {
    try {
      logger.info('Starting PR Creation Worker');

      // Start consuming from PR creation queue
      await rabbitMQService.consumeQueue<CreatePRMessage>(
        QUEUE_PR_CREATION,
        this.processPRCreation.bind(this)
      );

      logger.info('PR Creation Worker is running');
    } catch (error) {
      logger.error('Error starting PR Creation Worker:', error);
      throw error;
    }
  }

  /**
   * Process a PR creation job
   */
  private async processPRCreation(message: CreatePRMessage): Promise<void> {
    const { scanId, repositoryId, userId } = message;
    logger.info(
      `Processing PR creation job: scanId=${scanId}, repoId=${repositoryId}, userId=${userId}`
    );

    try {
      // Verify that scan exists and belongs to user
      const scan = await Scan.findOne({ _id: scanId, userId });
      if (!scan) {
        throw new Error('Scan not found or not authorized');
      }

      // Validate that we're in the expected state
      if (
        scan.state !== 'pr-creation' &&
        scan.state !== 'dependencies-scanned' &&
        scan.state !== 'vulnerabilities-scanned'
      ) {
        logger.warn(
          `Scan ${scanId} is not in an appropriate state for PR creation (current: ${scan.state}). We will proceed anyway.`
        );
      }

      // Check if there are outdated dependencies
      if (scan.outdatedCount === 0) {
        logger.info(`No outdated dependencies to update for scanId=${scanId}`);

        // Handle the PR creation skip
        await scanProcessManager.handlePRCreationComplete(
          scanId,
          true, // Consider this a success
          undefined,
          undefined,
          'No outdated dependencies to update'
        );

        return;
      }

      // Get user's GitHub token
      const user = await User.findById(userId);
      if (!user || !user.githubToken) {
        throw new Error('GitHub token not found for user');
      }

      // Create PR
      const scanService = new DependencyScanService(userId, user.githubToken);
      const pullRequest = await scanService.createDependencyUpdatePR(
        scanId,
        repositoryId
      );

      if (!pullRequest) {
        const error = 'PR creation skipped: failed to create pull request';
        logger.warn(`${error} for scanId=${scanId}`);

        // Handle the PR creation failure
        await scanProcessManager.handlePRCreationComplete(
          scanId,
          false,
          undefined,
          undefined,
          error
        );

        return;
      }

      logger.info(
        `Pull request created successfully: scanId=${scanId}, PR #${pullRequest.number} (${pullRequest.html_url})`
      );

      // Notify of successful PR creation
      await scanProcessManager.handlePRCreationComplete(
        scanId,
        true,
        pullRequest.number,
        pullRequest.html_url
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown error in PR creation worker';

      logger.error(
        `Error processing PR creation job for scanId=${scanId}:`,
        error
      );

      // Handle the PR creation failure
      await scanProcessManager.handlePRCreationComplete(
        scanId,
        false,
        undefined,
        undefined,
        errorMessage
      );
    }
  }
}

export const prCreationWorker = new PRCreationWorker();

// Start worker if executed directly
if (require.main === module) {
  prCreationWorker.start().catch((err) => {
    logger.error('Failed to start PR creation worker:', err);
    process.exit(1);
  });
}

export default prCreationWorker;
