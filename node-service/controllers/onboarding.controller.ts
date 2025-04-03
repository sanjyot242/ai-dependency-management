// controllers/onboarding.controller.ts
import { Request, Response } from 'express';
import {
  saveOnboardingConfig,
  getOnboardingConfig,
  getOnboardingStatus,
} from '../services/onboarding.service';
import { INotificationPreferences } from '../types/models';
import { OnboardingConfigInput } from '../types/dto';

const onboardingController = {
  // Save onboarding configuration
  saveConfig: async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { config } = req.body as { config?: OnboardingConfigInput };

      if (!config) {
        res.status(400).json({ error: 'Configuration is required' });
        return;
      }

      const savedConfig = await saveOnboardingConfig(userId, config);

      res.json({
        success: true,
        message: 'Configuration saved successfully',
        config: savedConfig,
      });
    } catch (error) {
      console.error('Error saving onboarding config:', error);
      res.status(500).json({ error: 'Failed to save configuration' });
    }
  },

  // Get user's onboarding configuration
  getConfig: async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;

      const config = await getOnboardingConfig(userId);

      if (!config) {
        res.status(404).json({ error: 'Configuration not found' });
        return;
      }

      res.json(config);
    } catch (error) {
      console.error('Error getting onboarding config:', error);
      res.status(500).json({ error: 'Failed to get configuration' });
    }
  },

  // Get onboarding status
  getStatus: async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;

      const status = await getOnboardingStatus(userId);

      res.json(status);
    } catch (error) {
      console.error('Error getting onboarding status:', error);
      res.status(500).json({ error: 'Failed to get onboarding status' });
    }
  },
};

export default onboardingController;
