// controllers/webhook.controller.ts
import { Request, Response } from 'express';
import crypto from 'crypto';
import logger from '../utils/logger';
import Repository from '../models/Repository';
import User from '../models/User';
import OnboardingConfig from '../models/OnboardingConfig';
import scanProcessManager from '../services/scan-process-manager.service';

const webhookController = {
  /**
   * Handle GitHub push webhook events
   */
  handlePushEvent: async (req: Request, res: Response): Promise<void> => {
    try {
      // 1. Validate webhook signature if GitHub secret is configured
      if (process.env.GITHUB_WEBHOOK_SECRET) {
        const signature = req.headers['x-hub-signature-256'] as string;
        if (!signature) {
          res.status(401).json({ error: 'No signature provided' });
          return;
        }

        const payload = JSON.stringify(req.body);
        const hmac = crypto.createHmac(
          'sha256',
          process.env.GITHUB_WEBHOOK_SECRET
        );
        const digest = `sha256=${hmac.update(payload).digest('hex')}`;

        if (
          !crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature))
        ) {
          res.status(401).json({ error: 'Invalid signature' });
          return;
        }
      }

      // 2. Extract repository details from the webhook payload
      const { repository, ref, created, head_commit } = req.body;

      //check if push is from PR creation
      if (
        created == true ||
        ref.includes('dependency-updates-') || // Any dependency update branch
        (head_commit &&
          head_commit.message &&
          head_commit.message.includes('[AUTO-GENERATED: DEPENDENCY-SCANNER]'))
      ) {
        logger.info(
          `Skipping scan for PR-related push event on ${repository.name}: ${ref}`
        );
        res.status(200).json({ message: 'PR-related push event ignored' });
        return;
      }

      if (!repository) {
        res.status(400).json({ error: 'Repository information missing' });
        return;
      }

      // 3. Find the repository in our database
      const repoInDb = await Repository.findOne({
        githubId: repository.id.toString(),
      });

      if (!repoInDb) {
        logger.info(
          `Repository with GitHub ID ${repository.id} not found in database, skipping scan`
        );
        res
          .status(200)
          .json({ message: 'Repository not monitored by the system' });
        return;
      }

      // 4. Get user and check if autoScanOnPush is enabled
      const user = await User.findById(repoInDb.userId);
      if (!user) {
        logger.warn(`User not found for repository ${repoInDb.name}`);
        res.status(200).json({ message: 'Associated user not found' });
        return;
      }

      // 5. Check if autoScanOnPush is enabled in user's config
      const config = await OnboardingConfig.findOne({
        userId: repoInDb.userId,
      });
      if (!config || !config.autoScanOnPush) {
        logger.info(
          `Auto-scan on push is disabled for repository ${repoInDb.name}`
        );
        res.status(200).json({ message: 'Auto-scan on push is disabled' });
        return;
      }

      // 6. Initiate scan
      const scan = await scanProcessManager.initiateScan(
        repoInDb.userId.toString(),
        repoInDb._id.toString(),
        {
          includeVulnerabilities: config.scanVulnerabilities !== false,
          createPR: false, // Don't auto-create PRs for push-triggered scans
          triggerType: 'push', // Indicate this was triggered by a push
          branch: req.body.ref.replace('refs/heads/', ''), // Extract branch name
        }
      );

      logger.info(
        `Push-triggered scan initiated for ${repoInDb.name}, scanId: ${scan._id}`
      );
      res.status(200).json({
        success: true,
        message: 'Scan initiated successfully',
        scanId: scan._id,
      });
    } catch (error) {
      logger.error('Error handling push webhook:', error);
      res.status(500).json({ error: 'Error processing webhook' });
    }
  },
};

export default webhookController;
