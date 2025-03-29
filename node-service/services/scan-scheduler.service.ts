// services/scan-scheduler.service.ts
import cron from 'node-cron';
import User, { IUser } from '../models/User';
import OnboardingConfig, {
  IOnboardingConfig,
} from '../models/OnboardingConfig';
import Repository from '../models/Repository';
import logger from '../utils/logger';
import scanProcessManager from '../services/scan-process-manager.service';
import rabbitMQService, { QUEUE_SCAN_REPOSITORY } from './rabbitmq.service';
import {
  ScanRepositoryMessage,
  ScheduledScanMessage,
} from '../types/queue-messages.types';

/**
 * Class for scheduling and managing automatic dependency scans based on user configurations
 */
export class ScanSchedulerService {
  private cronJobs: Record<string, cron.ScheduledTask> = {};

  constructor() {
    // Initialize scheduler on service creation
    this.initialize();
  }

  /**
   * Initialize scheduler
   */
  public async initialize(): Promise<void> {
    try {
      logger.info('Initializing scan scheduler service...');

      // Get all users with onboarding config
      const configs = await OnboardingConfig.find();

      for (const config of configs) {
        await this.scheduleForUser(config.userId.toString(), config);
      }

      // Set up a job to periodically check for new/updated configs
      cron.schedule('0 */6 * * *', () => {
        // Every 6 hours
        this.refreshAllSchedules().catch((err) => {
          logger.error('Error refreshing scan schedules:', err);
        });
      });

      logger.info(
        `Initialized ${Object.keys(this.cronJobs).length} scheduled scans`
      );
    } catch (error) {
      logger.error('Error initializing scan scheduler:', error);
    }
  }

  /**
   * Schedule automatic scans for a specific user
   * @param userId User ID
   * @param config Optional config object
   * @param testMode If true, uses a short interval for testing
   */
  public async scheduleForUser(
    userId: string,
    config?: IOnboardingConfig | null,
    testMode: boolean = false
  ): Promise<void> {
    try {
      logger.info('Scheduling for user', { userId, testMode });

      // Cancel existing job if it exists
      if (this.cronJobs[userId]) {
        this.cronJobs[userId].stop();
        delete this.cronJobs[userId];
      }

      // Get config if not provided
      if (!config) {
        config = await OnboardingConfig.findOne({ userId });
        if (!config) {
          logger.info(`No scan configuration found for user ${userId}`);
          return;
        }
      }

      // Create cron schedule
      let cronSchedule: string;

      if (testMode) {
        // For testing - run every 2 minutes
        cronSchedule = '*/5 * * * *';
        logger.info('Using test schedule: every 2 minutes');
      } else {
        // Normal schedule based on config
        switch (config.scanFrequency) {
          case 'daily':
            cronSchedule = '0 0 * * *'; // Every day at midnight
            break;
          case 'weekly':
            cronSchedule = '0 0 * * 1'; // Every Monday at midnight
            break;
          case 'monthly':
            cronSchedule = '0 0 1 * *'; // 1st day of every month at midnight
            break;
          default:
            cronSchedule = '0 0 * * 1'; // Default to weekly
        }
      }

      // Schedule job
      this.cronJobs[userId] = cron.schedule(cronSchedule, () => {
        logger.info(
          `Running scheduled scan for user ${userId} at ${new Date().toISOString()}`
        );
        this.runScanForUser(
          userId,
          config?.scanVulnerabilities !== false
        ).catch((err) => {
          logger.error(`Error running scheduled scan for user ${userId}:`, err);
        });
      });

      // For testing purposes, we might want to run a scan immediately
      if (testMode) {
        logger.info(`Test mode: triggering immediate scan for user ${userId}`);
        setTimeout(() => {
          this.runScanForUser(
            userId,
            config?.scanVulnerabilities !== false
          ).catch((err) => {
            logger.error(
              `Error running immediate test scan for user ${userId}:`,
              err
            );
          });
        }, 5000); // Run after 5 seconds to let system stabilize
      }

      logger.info(
        `Scheduled ${
          testMode ? 'test' : config.scanFrequency
        } scan for user ${userId}`
      );
    } catch (error) {
      logger.error(`Error scheduling scan for user ${userId}:`, error);
    }
  }

  /**
   * Run a scan for a specific user
   * @param userId User ID
   * @param includeVulnerabilities Whether to include vulnerability scanning
   */
  private async runScanForUser(
    userId: string,
    includeVulnerabilities: boolean = true
  ): Promise<Record<string, string>> {
    try {
      logger.info(`Running scheduled scan for user ${userId}`);

      // Get user to check GitHub token
      const user = await User.findById(userId);
      if (!user || !user.githubToken) {
        throw new Error('User does not have a GitHub token');
      }

      // Get repositories selected for scanning
      const repositories = await Repository.find({
        userId,
        isRepoSelected: true,
      });

      if (repositories.length === 0) {
        logger.info(`No repositories selected for scanning by user ${userId}`);
        return {};
      }

      const results: Record<string, string> = {};

      // Create scan records and queue scan jobs for each repository
      for (const repo of repositories) {
        const scan = await scanProcessManager.initiateScan(
          userId,
          repo._id.toString(),
          {
            includeVulnerabilities,
            createPR: true,
          }
        );

        results[repo.name] = scan._id.toString();
      }

      logger.info(
        `Started ${Object.keys(results).length} scans for user ${userId}` +
          (includeVulnerabilities
            ? ' with OSV vulnerability scanning'
            : ' without vulnerability scanning')
      );

      return results;
    } catch (error) {
      logger.error(`Error running scan for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Refresh schedules for all users
   */
  private async refreshAllSchedules(): Promise<void> {
    try {
      logger.info('Refreshing all scan schedules...');

      // Stop all existing jobs
      Object.values(this.cronJobs).forEach((job) => job.stop());
      this.cronJobs = {};

      // Re-initialize
      await this.initialize();
    } catch (error) {
      logger.error('Error refreshing scan schedules:', error);
    }
  }

  /**
   * Cancel a scheduled scan for a user
   */
  public cancelScheduledScan(userId: string): void {
    if (this.cronJobs[userId]) {
      this.cronJobs[userId].stop();
      delete this.cronJobs[userId];
      logger.info(`Cancelled scheduled scan for user ${userId}`);
    }
  }

  /**
   * Manually trigger a scan for a user
   */
  public async triggerScanForUser(
    userId: string
  ): Promise<Record<string, string> | null> {
    try {
      const user = await User.findById(userId);
      if (!user || !user.githubToken) {
        throw new Error('User not found or does not have a GitHub token');
      }

      // Get user config to check vulnerability scanning preference
      const config = await OnboardingConfig.findOne({ userId });
      const includeVulnerabilities =
        !config || config.scanVulnerabilities !== false; // Default to true

      return await this.runScanForUser(userId, includeVulnerabilities);
    } catch (error) {
      logger.error(`Error triggering scan for user ${userId}:`, error);
      return null;
    }
  }
}

// Singleton instance
export const scanScheduler = new ScanSchedulerService();
