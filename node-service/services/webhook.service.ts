// services/webhook.service.ts
import axios from 'axios';
import logger from '../utils/logger';
import Repository from '../models/Repository';
import User from '../models/User';
import { WebhookConfig } from '../types/dto';

class WebhookService {
  /**
   * Create a GitHub webhook for a repository
   */
  public async createRepositoryWebhook(
    userId: string,
    repositoryId: string
  ): Promise<boolean> {
    try {
      // Get repository info
      const repository = await Repository.findOne({
        _id: repositoryId,
        userId,
      });

      if (!repository) {
        logger.warn(`Repository ${repositoryId} not found for user ${userId}`);
        return false;
      }

      // Get user's GitHub token
      const user = await User.findById(userId);
      if (!user || !user.githubToken) {
        logger.warn(`GitHub token not found for user ${userId}`);
        return false;
      }

      // Log repository and user info
      logger.debug(
        `Attempting to create webhook for repository: ${repository.fullName}`
      );

      // Check if webhook already exists
      try {
        const webhookExists = await this.checkWebhookExists(
          repository.fullName,
          user.githubToken
        );

        if (webhookExists) {
          logger.info(
            `Webhook already exists for repository ${repository.fullName}`
          );
          return true;
        }
      } catch (checkError) {
        logger.warn(
          `Error checking existing webhooks for ${repository.fullName}: ${
            checkError instanceof Error ? checkError.message : 'Unknown error'
          }`
        );
        // Continue to try creating the webhook anyway
      }

      // Set up webhook configuration
      const webhookUrl = `${process.env.API_BASE_URL}/api/webhooks/github/push`;
      logger.debug(`Webhook URL: ${webhookUrl}`);

      const webhookConfig: WebhookConfig = {
        url: webhookUrl,
        content_type: 'json',
        secret: process.env.GITHUB_WEBHOOK_SECRET || '',
        events: ['push'],
      };

      // Create webhook
      try {
        const response = await axios.post(
          `https://api.github.com/repos/${repository.fullName}/hooks`,
          {
            name: 'web',
            active: true,
            events: webhookConfig.events,
            config: {
              url: webhookConfig.url,
              content_type: webhookConfig.content_type,
              secret: webhookConfig.secret,
            },
          },
          {
            headers: {
              Authorization: `token ${user.githubToken}`,
              Accept: 'application/vnd.github.v3+json',
            },
          }
        );

        if (response.status === 201) {
          logger.info(`Webhook created for repository ${repository.fullName}`);
          return true;
        } else {
          logger.warn(
            `Failed to create webhook for ${repository.fullName}: ${response.status} ${response.statusText}`
          );
          return false;
        }
      } catch (apiError: any) {
        // Handle specific GitHub API errors
        const statusCode = apiError.response?.status;
        const errorMessage =
          apiError.response?.data?.message || apiError.message;

        logger.error(
          `GitHub API error creating webhook for ${repository.fullName}: ${statusCode} - ${errorMessage}`
        );

        // Check for specific error conditions
        if (statusCode === 404) {
          logger.warn(
            `Repository not found or no access: ${repository.fullName}`
          );
        } else if (statusCode === 403) {
          logger.warn(
            `Permission denied for ${repository.fullName}. Check OAuth scopes.`
          );
        } else if (statusCode === 422) {
          logger.warn(
            `Validation failed or webhook already exists for ${repository.fullName}`
          );
          // For 422 errors, webhook might already exist but check failed, so return true
          return true;
        }

        return false;
      }
    } catch (error) {
      // Safe error logging that avoids circular references
      logger.error(
        `Error creating webhook for repository ${repositoryId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
      return false;
    }
  }

  /**
   * Check if a webhook already exists for this app
   */
  private async checkWebhookExists(
    repoFullName: string,
    githubToken: string
  ): Promise<boolean> {
    try {
      logger.debug(`Checking existing webhooks for ${repoFullName}`);

      const response = await axios.get(
        `https://api.github.com/repos/${repoFullName}/hooks`,
        {
          headers: {
            Authorization: `token ${githubToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );

      const webhooks = response.data;
      const webhookUrl = `${process.env.API_BASE_URL}/api/webhooks/github/push`;

      const existingWebhook = webhooks.find(
        (hook: any) => hook.config?.url === webhookUrl
      );

      if (existingWebhook) {
        logger.debug(`Found existing webhook: ${existingWebhook.id}`);
        return true;
      }

      return false;
    } catch (error) {
      // Check if it's a specific API error we can handle
      if (axios.isAxiosError(error) && error.response) {
        const statusCode = error.response.status;
        if (statusCode === 404) {
          logger.warn(`Repository not found or no access: ${repoFullName}`);
        } else if (statusCode === 403) {
          logger.warn(
            `Permission denied for ${repoFullName}. Check OAuth scopes.`
          );
        }
      }

      // Re-throw to be handled by the caller
      throw error;
    }
  }

  /**
   * Remove a GitHub webhook for a repository
   */
  public async removeRepositoryWebhook(
    userId: string,
    repositoryId: string
  ): Promise<boolean> {
    try {
      // Get repository info
      const repository = await Repository.findOne({
        _id: repositoryId,
        userId,
      });

      if (!repository) {
        logger.warn(`Repository ${repositoryId} not found for user ${userId}`);
        return false;
      }

      // Get user's GitHub token
      const user = await User.findById(userId);
      if (!user || !user.githubToken) {
        logger.warn(`GitHub token not found for user ${userId}`);
        return false;
      }

      // Find webhook ID
      try {
        const webhookUrl = `${process.env.API_BASE_URL}/api/webhooks/github/push`;
        const hooksResponse = await axios.get(
          `https://api.github.com/repos/${repository.fullName}/hooks`,
          {
            headers: {
              Authorization: `token ${user.githubToken}`,
              Accept: 'application/vnd.github.v3+json',
            },
          }
        );

        const webhook = hooksResponse.data.find(
          (hook: any) => hook.config?.url === webhookUrl
        );

        if (!webhook) {
          logger.info(`No webhook found for repository ${repository.fullName}`);
          return true;
        }

        // Delete webhook
        await axios.delete(
          `https://api.github.com/repos/${repository.fullName}/hooks/${webhook.id}`,
          {
            headers: {
              Authorization: `token ${user.githubToken}`,
              Accept: 'application/vnd.github.v3+json',
            },
          }
        );

        logger.info(`Webhook removed for repository ${repository.fullName}`);
        return true;
      } catch (apiError: any) {
        // Handle specific GitHub API errors
        const statusCode = apiError.response?.status;
        const errorMessage =
          apiError.response?.data?.message || apiError.message;

        logger.error(
          `GitHub API error removing webhook for ${repository.fullName}: ${statusCode} - ${errorMessage}`
        );

        // For 404 errors, webhook doesn't exist, so we consider this a success
        if (statusCode === 404) {
          logger.info(`No webhook found (404) for ${repository.fullName}`);
          return true;
        }

        return false;
      }
    } catch (error) {
      // Safe error logging
      logger.error(
        `Error removing webhook for repository ${repositoryId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
      return false;
    }
  }

  /**
   * Check if the API URL is properly configured
   */
  public validateApiUrl(): boolean {
    const apiBaseUrl = process.env.API_BASE_URL;
    if (!apiBaseUrl) {
      logger.error('API_BASE_URL environment variable is not set!');
      return false;
    }

    try {
      const url = new URL(apiBaseUrl);
      if (!url.hostname || url.hostname === 'localhost') {
        logger.warn(
          `API_BASE_URL (${apiBaseUrl}) may not be accessible from GitHub. Webhooks might not work.`
        );
      }
      return true;
    } catch (error) {
      logger.error(
        `Invalid API_BASE_URL (${apiBaseUrl}): ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
      return false;
    }
  }
}

export const webhookService = new WebhookService();
export default webhookService;
