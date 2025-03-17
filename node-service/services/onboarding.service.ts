// services/onboarding.service.ts
import OnboardingConfig, {
  IOnboardingConfig,
} from '../models/OnboardingConfig';
import User from '../models/User';
import Repository from '../models/Repository';
import { updateUserOnboardingStatus } from './user.service';
import { scanScheduler } from './scan-scheduler.service';

interface OnboardingConfigInput {
  scanFrequency?: 'daily' | 'weekly' | 'monthly';
  scanVulnerabilities?: boolean;
  notificationPreferences?: {
    email?: {
      enabled?: boolean;
      vulnerabilities?: boolean;
      outdatedDependencies?: boolean;
    };
    slack?: {
      enabled?: boolean;
      webhookUrl?: string;
      vulnerabilities?: boolean;
      outdatedDependencies?: boolean;
    };
  };
  autoScanOnPush?: boolean;
}

interface OnboardingStatus {
  isOnboarded: boolean;
  hasSelectedRepositories: boolean;
  hasConfig: boolean;
  scanStarted: boolean;
}

// Update the saveOnboardingConfig function to include the new field:
export const saveOnboardingConfig = async (
  userId: string,
  configData: OnboardingConfigInput
): Promise<IOnboardingConfig> => {
  try {
    // Find existing config or create new one
    let config = await OnboardingConfig.findOne({ userId });

    if (config) {
      // Update existing config
      if (configData.scanFrequency) {
        config.scanFrequency = configData.scanFrequency;
      }

      if (configData.notificationPreferences) {
        // Handle email preferences
        if (configData.notificationPreferences.email) {
          config.notificationPreferences.email = {
            ...config.notificationPreferences.email,
            ...configData.notificationPreferences.email,
          };
        }

        // Handle slack preferences
        if (configData.notificationPreferences.slack) {
          config.notificationPreferences.slack = {
            ...config.notificationPreferences.slack,
            ...configData.notificationPreferences.slack,
          };
        }
      }

      if (configData.autoScanOnPush !== undefined) {
        config.autoScanOnPush = configData.autoScanOnPush;
      }

      // Add the new field
      if (configData.scanVulnerabilities !== undefined) {
        config.scanVulnerabilities = configData.scanVulnerabilities;
      }
    } else {
      // Create new config
      config = new OnboardingConfig({
        userId,
        ...configData,
      });
    }

    await config.save();

    // Update user onboarded status
    await updateUserOnboardingStatus(userId, true);

    // Update scan schedule based on new configuration
    await scanScheduler.scheduleForUser(userId, undefined, false);

    return config;
  } catch (error) {
    console.error('Error in saveOnboardingConfig:', error);
    throw error;
  }
};

export const getOnboardingConfig = async (
  userId: string
): Promise<IOnboardingConfig | null> => {
  try {
    return await OnboardingConfig.findOne({ userId });
  } catch (error) {
    console.error('Error in getOnboardingConfig:', error);
    throw error;
  }
};

export const getOnboardingStatus = async (
  userId: string
): Promise<OnboardingStatus> => {
  try {
    const user = await User.findById(userId);
    const config = await OnboardingConfig.findOne({ userId });
    const repositories = await Repository.find({
      userId,
      isRepoSelected: true,
    });

    return {
      isOnboarded: user ? user.isOnboarded : false,
      hasSelectedRepositories: repositories.length > 0,
      hasConfig: !!config,
      scanStarted: false, // This would come from scanning service in a real app
    };
  } catch (error) {
    console.error('Error in getOnboardingStatus:', error);
    throw error;
  }
};
