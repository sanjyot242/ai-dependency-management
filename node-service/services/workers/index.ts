// workers/index.ts
import '../../db'; // Make sure database connection is established
import logger from '../../utils/logger';
import { WorkerManager } from './worker-manager';

/**
 * Entry point for worker processes
 */
async function main() {
  try {
    logger.info('Starting dependency scanner workers...');

    // Create and start worker manager
    const workerManager = new WorkerManager();
    await workerManager.start();

    logger.info('All dependency scanner workers running');
  } catch (error) {
    logger.error('Error starting workers:', error);
    process.exit(1);
  }
}

// Start the workers
main().catch((error) => {
  logger.error('Fatal error in worker process:', error);
  process.exit(1);
});
