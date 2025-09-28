// workers/worker-manager.ts
import dotenv from 'dotenv';
import path from 'path';
import logger from '../../utils/logger';
import { dependencyScanWorker } from './dependency-scan.worker';
import { vulnerabilityScanWorker } from './vulnerability-scan.worker';
import { prCreationWorker } from './pr-creation.worker';
import { websocketNotificationWorker } from './websocket-notification.worker';
import rabbitMQService from '../../services/rabbitmq.service';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

/**
 * Manages and coordinates all worker processes
 */
export class WorkerManager {
  /**
   * Initialize all workers
   */
  public async start(): Promise<void> {
    try {
      logger.info('Starting Worker Manager');

      // Initialize RabbitMQ connection
      await rabbitMQService.init();

      // Start all workers
      await Promise.all([
        dependencyScanWorker.start(),
        vulnerabilityScanWorker.start(),
        prCreationWorker.start(),
        websocketNotificationWorker.start(),
      ]);

      logger.info('All workers started successfully');

      // Set up process termination handlers
      this.setupProcessHandlers();
    } catch (error) {
      logger.error('Error starting Worker Manager:', error);
      process.exit(1);
    }
  }

  /**
   * Set up process termination handlers
   */
  private setupProcessHandlers(): void {
    // Handle normal termination
    process.on('SIGTERM', this.shutdown.bind(this));
    process.on('SIGINT', this.shutdown.bind(this));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error);
      this.shutdown(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled promise rejection:', reason);
      // Don't shut down for unhandled rejections, just log them
    });
  }

  /**
   * Gracefully shut down all workers and connections
   */
  private async shutdown(exitCode = 0): Promise<void> {
    logger.info('Shutting down Worker Manager...');

    try {
      // Close RabbitMQ connection
      await rabbitMQService.close();
      logger.info('RabbitMQ connection closed');

      // In a real implementation, you might want to:
      // 1. Stop accepting new jobs
      // 2. Wait for existing jobs to complete (with a timeout)
      // 3. Then fully terminate the process

      logger.info(
        `Worker Manager shut down successfully, exiting with code ${exitCode}`
      );
      process.exit(exitCode);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1); // Force exit if clean shutdown fails
    }
  }
}
