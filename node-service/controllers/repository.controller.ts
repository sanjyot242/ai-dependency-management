import { Request, Response } from 'express';
import axios from 'axios';
import {
  saveUserRepositories,
  getUserRepositories,
  getRepositoryById,
  updateRepositorySelection,
  manageRepositoryWebhooks,
} from '../services/repository.service';
import { GithubRepository } from '../types/dto';

const repositoryController = {
  // Fetch repositories from GitHub and save to database
  fetchAndSaveRepositories: async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const user = req.user!;

      // Get repositories from GitHub
      const response = await axios.get<GithubRepository[]>(
        'https://api.github.com/user/repos',
        {
          headers: {
            Authorization: `token ${user.githubToken}`,
          },
          params: {
            sort: 'updated',
            per_page: 100,
          },
        }
      );

      // Save repositories to database (with none selected by default)
      const savedRepos = await saveUserRepositories(user.id, response.data, []);

      res.json(savedRepos);
    } catch (error) {
      console.error('Error fetching and saving repositories:', error);
      res.status(500).json({ error: 'Failed to fetch repositories' });
    }
  },

  // Get user's repositories
  getUserRepositories: async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const selectedOnly = req.query.selectedOnly === 'true';

      const repositories = await getUserRepositories(userId, selectedOnly);

      res.json(repositories);
    } catch (error) {
      console.error('Error getting user repositories:', error);
      res.status(500).json({ error: 'Failed to get repositories' });
    }
  },

  // Get a specific repository
  getRepository: async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const repoId = req.params.id;

      const repository = await getRepositoryById(repoId, userId);

      if (!repository) {
        res.status(404).json({ error: 'Repository not found' });
        return;
      }

      res.json(repository);
    } catch (error) {
      console.error('Error getting repository:', error);
      res.status(500).json({ error: 'Failed to get repository' });
    }
  },

  // Update repository selection
  updateRepositorySelection: async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { repositories } = req.body;

      if (!repositories || !Array.isArray(repositories)) {
        res.status(400).json({ error: 'Repositories array is required' });
        return;
      }

      await manageRepositoryWebhooks(userId, repositories);

      const selectedRepos = await updateRepositorySelection(
        userId,
        repositories
      );

      res.json({
        success: true,
        message: 'Repository selection updated',
        repositories: selectedRepos,
      });
    } catch (error) {
      console.error('Error updating repository selection:', error);
      res.status(500).json({ error: 'Failed to update repository selection' });
    }
  },
};

export default repositoryController;
