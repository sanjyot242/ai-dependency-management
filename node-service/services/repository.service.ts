// services/repository.service.ts
import Repository, { IRepository } from '../models/Repository';
import { Types } from 'mongoose';

interface GithubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  private: boolean;
  default_branch: string;
  language: string | null;
}

export const saveUserRepositories = async (
  userId: string,
  githubRepos: GithubRepository[],
  selectedRepos: string[] = []
): Promise<IRepository[]> => {
  try {
    // Get all repos for this user
    const existingRepos = await Repository.find({ userId });
    const existingRepoMap = new Map<string, IRepository>(
      existingRepos.map((repo) => [repo.githubId, repo])
    );

    // Prepare batch operations
    const operations: Promise<any>[] = [];

    // Process GitHub repositories
    for (const repo of githubRepos) {
      const isSelected = selectedRepos.includes(repo.id.toString());

      if (existingRepoMap.has(repo.id.toString())) {
        // Update existing repo
        const existingRepo = existingRepoMap.get(repo.id.toString())!;
        existingRepo.name = repo.name;
        existingRepo.fullName = repo.full_name;
        existingRepo.description = repo.description || undefined;
        existingRepo.url = repo.html_url;
        existingRepo.isPrivate = repo.private;
        existingRepo.defaultBranch = repo.default_branch;
        existingRepo.language = repo.language || undefined;

        // Only update selection state if it's in the selectedRepos array
        if (selectedRepos.length > 0) {
          existingRepo.isRepoSelected = isSelected;
        }

        operations.push(existingRepo.save());

        // Remove from map to track processed repos
        existingRepoMap.delete(repo.id.toString());
      } else {
        // Create new repo with isRepoSelected defaulting to false
        const newRepo = new Repository({
          userId,
          githubId: repo.id.toString(),
          name: repo.name,
          fullName: repo.full_name,
          description: repo.description,
          url: repo.html_url,
          isPrivate: repo.private,
          defaultBranch: repo.default_branch,
          language: repo.language,
          isRepoSelected: isSelected,
        });

        operations.push(newRepo.save());
      }
    }

    // Execute all operations
    await Promise.all(operations);

    // Return only selected repositories if that's what was requested
    return await Repository.find({
      userId,
      ...(selectedRepos.length > 0 ? { isRepoSelected: true } : {}),
    });
  } catch (error) {
    console.error('Error in saveUserRepositories:', error);
    throw error;
  }
};

export const getUserRepositories = async (
  userId: string,
  selectedOnly: boolean = false
): Promise<IRepository[]> => {
  try {
    console.log('getting user Repo', selectedOnly);
    const query: any = { userId };

    if (selectedOnly) {
      query.isRepoSelected = true;
    }

    return await Repository.find(query).sort({ name: 1 });
  } catch (error) {
    console.error('Error in getUserRepositories:', error);
    throw error;
  }
};

export const getRepositoryById = async (
  id: string,
  userId: string
): Promise<IRepository | null> => {
  try {
    return await Repository.findOne({ _id: id, userId });
  } catch (error) {
    console.error('Error in getRepositoryById:', error);
    throw error;
  }
};

export const updateRepositorySelection = async (
  userId: string,
  repositoryIds: string[],
  isSelected: boolean = true
): Promise<IRepository[]> => {
  try {
    // First, unselect all repositories for this user
    await Repository.updateMany({ userId }, { isRepoSelected: false });

    // Then, select only the specified repositories
    if (repositoryIds.length > 0) {
      await Repository.updateMany(
        { userId, _id: { $in: repositoryIds } },
        { isRepoSelected: isSelected }
      );
    }

    return await Repository.find({ userId, isRepoSelected: true });
  } catch (error) {
    console.error('Error in updateRepositorySelection:', error);
    throw error;
  }
};
