// services/scan-scheduler.service.ts
import cron from 'node-cron';
import User, { IUser } from '../models/User';
import OnboardingConfig, {
  IOnboardingConfig,
} from '../models/OnboardingConfig';
import { initiateAutomaticScan } from './dependency-scan.service';

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
      console.log('Initializing scan scheduler service...');

      // Get all users with onboarding config
      const configs = await OnboardingConfig.find();

      for (const config of configs) {
        await this.scheduleForUser(config.userId.toString(), config);
      }

      // Set up a job to periodically check for new/updated configs
      cron.schedule('0 */6 * * *', () => {
        // Every 6 hours
        this.refreshAllSchedules().catch((err) => {
          console.error('Error refreshing scan schedules:', err);
        });
      });

      console.log(
        `Initialized ${Object.keys(this.cronJobs).length} scheduled scans`
      );
    } catch (error) {
      console.error('Error initializing scan scheduler:', error);
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
      console.log('scheduling for user', userId, testMode ? '(TEST MODE)' : '');

      // Cancel existing job if it exists
      if (this.cronJobs[userId]) {
        this.cronJobs[userId].stop();
        delete this.cronJobs[userId];
      }

      // Get config if not provided
      if (!config) {
        config = await OnboardingConfig.findOne({ userId });
        if (!config) {
          console.log(`No scan configuration found for user ${userId}`);
          return;
        }
      }

      // Create cron schedule
      let cronSchedule: string;

      if (testMode) {
        // For testing - run every 2 minutes
        cronSchedule = '*/2 * * * *';
        console.log('Using test schedule: every 2 minutes');
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

      // Get user to get GitHub token
      const user = await User.findById(userId);
      if (!user || !user.githubToken) {
        console.error(
          `User ${userId} not found or doesn't have a GitHub token`
        );
        return;
      }

      // Schedule job
      this.cronJobs[userId] = cron.schedule(cronSchedule, () => {
        console.log(
          `Running scheduled scan for user ${userId} at ${new Date().toISOString()}`
        );
        this.runScanForUser(user).catch((err) => {
          console.error(
            `Error running scheduled scan for user ${userId}:`,
            err
          );
        });
      });

      // For testing purposes, we might want to run a scan immediately
      if (testMode) {
        console.log(`Test mode: triggering immediate scan for user ${userId}`);
        setTimeout(() => {
          this.runScanForUser(user).catch((err) => {
            console.error(
              `Error running immediate test scan for user ${userId}:`,
              err
            );
          });
        }, 5000); // Run after 5 seconds to let system stabilize
      }

      console.log(
        `Scheduled ${
          testMode ? 'test' : config.scanFrequency
        } scan for user ${userId}`
      );
    } catch (error) {
      console.error(`Error scheduling scan for user ${userId}:`, error);
    }
  }

  /**
   * Run a scan for a specific user
   */
  private async runScanForUser(user: IUser): Promise<void> {
    try {
      console.log(`Running scheduled scan for user ${user._id}`);

      // Ensure user has GitHub token
      if (!user.githubToken) {
        throw new Error('User does not have a GitHub token');
      }

      // Run scan
      const results = await initiateAutomaticScan(
        user._id.toString(),
        user.githubToken
      );

      console.log(
        `Started ${Object.keys(results).length} scans for user ${user._id}`
      );
    } catch (error) {
      console.error(`Error running scan for user ${user._id}:`, error);
      throw error;
    }
  }

  /**
   * Refresh schedules for all users
   */
  private async refreshAllSchedules(): Promise<void> {
    try {
      console.log('Refreshing all scan schedules...');

      // Stop all existing jobs
      Object.values(this.cronJobs).forEach((job) => job.stop());
      this.cronJobs = {};

      // Re-initialize
      await this.initialize();
    } catch (error) {
      console.error('Error refreshing scan schedules:', error);
    }
  }

  /**
   * Cancel a scheduled scan for a user
   */
  public cancelScheduledScan(userId: string): void {
    if (this.cronJobs[userId]) {
      this.cronJobs[userId].stop();
      delete this.cronJobs[userId];
      console.log(`Cancelled scheduled scan for user ${userId}`);
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

      return await initiateAutomaticScan(userId, user.githubToken);
    } catch (error) {
      console.error(`Error triggering scan for user ${userId}:`, error);
      return null;
    }
  }
}

// Singleton instance
export const scanScheduler = new ScanSchedulerService();
