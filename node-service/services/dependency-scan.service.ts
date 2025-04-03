// services/dependency-scan.service.ts
import axios from 'axios';
import { Types } from 'mongoose';
import { updateScanStatus, updateScanResults } from './scan.service';
import { IRepository, IScan,IDependency,IOnboardingConfig } from '../types/models';
import Repository from '../models/Repository';
import Scan from '../models/Scan';
import OnboardingConfig from '../models/OnboardingConfig';

import vulnerabilityScanService from './vulnerability-scan.service';

// SemVer parser
const semver = require('semver');

interface PackageJson {
  name: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

interface GithubFile {
  path: string;
  type: string;
  url?: string;
  download_url?: string;
}

interface GithubContent {
  name: string;
  path: string;
  sha: string;
  content: string;
  encoding: string;
}

interface GithubBranch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
}

interface GithubPullRequest {
  html_url: string;
  number: number;
  title: string;
}

/**
 * Main class for handling dependency scanning operations
 */
export class DependencyScanService {
  constructor(
    private readonly userId: string,
    private readonly githubToken: string
  ) {}

  /**
   * Runs a scan for a specific repository
   */
  public async scanRepository(
    repoId: string,
    scanId: string
  ): Promise<IScan | null> {
    try {
      // Get repository details
      const repository = await Repository.findOne({
        _id: repoId,
        userId: this.userId,
      });

      if (!repository) {
        throw new Error('Repository not found or not authorized');
      }

      // Update scan status to in-progress
      await updateScanStatus(scanId, 'in-progress');

      // Get repository content
      const packageFiles = await this.findAllPackageJsonFiles(repository);

      if (packageFiles.length === 0) {
        await updateScanStatus(scanId, 'completed', {
          completedAt: new Date(),
          errorMessage: 'No package.json files found in the repository',
        });
        return await Scan.findById(scanId);
      }

      // Get default branch name and latest commit
      const defaultBranch = await this.getDefaultBranch(repository);

      // Process all package.json files and identify outdated dependencies
      const allDependencies: IDependency[] = [];

      for (const file of packageFiles) {
        const packageJsonContent = await this.getPackageJsonContent(
          repository,
          file.path
        );
        if (packageJsonContent) {
          const dependencies = await this.processPackageJson(
            packageJsonContent,
            file.path
          );
          allDependencies.push(...dependencies);
        }
      }

      // Update scan with findings
      await updateScanResults(scanId, allDependencies);

      // Return updated scan
      return await Scan.findById(scanId);
    } catch (error) {
      console.error('Error in scanRepository:', error);

      // Update scan status to failed with error message
      await updateScanStatus(scanId, 'failed', {
        completedAt: new Date(),
        errorMessage:
          error instanceof Error ? error.message : 'Unknown error during scan',
      });

      throw error;
    }
  }

  /**
   * Finds all package.json files in a repository using recursive search
   */
  private async findAllPackageJsonFiles(
    repository: IRepository
  ): Promise<GithubFile[]> {
    const packageFiles: GithubFile[] = [];

    // Start with the root directory
    await this.searchDirectoryForPackageJson(repository, '', packageFiles);

    return packageFiles;
  }

  /**
   * Recursively searches for package.json files in directories
   */
  private async searchDirectoryForPackageJson(
    repository: IRepository,
    path: string,
    results: GithubFile[]
  ): Promise<void> {
    try {
      const contents = await this.getRepositoryContents(repository, path);

      for (const item of contents) {
        if (item.type === 'file' && item.path.endsWith('package.json')) {
          results.push(item);
        } else if (item.type === 'dir') {
          // Recursively search subdirectories
          await this.searchDirectoryForPackageJson(
            repository,
            item.path,
            results
          );
        }
      }
    } catch (error) {
      console.error(`Error searching directory ${path}:`, error);
    }
  }

  /**
   * Gets contents of a repository at a specific path
   */
  private async getRepositoryContents(
    repository: IRepository,
    path: string = ''
  ): Promise<GithubFile[]> {
    try {
      const response = await axios.get<GithubFile[]>(
        `https://api.github.com/repos/${repository.fullName}/contents/${path}`,
        {
          headers: {
            Authorization: `token ${this.githubToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error(`Error getting repository contents for ${path}:`, error);
      return [];
    }
  }

  /**
   * Gets the default branch for a repository
   */
  private async getDefaultBranch(
    repository: IRepository
  ): Promise<{ name: string; sha: string }> {
    try {
      // If defaultBranch is already in the repository record, use that
      if (repository.defaultBranch) {
        const branchResponse = await axios.get<GithubBranch>(
          `https://api.github.com/repos/${repository.fullName}/branches/${repository.defaultBranch}`,
          {
            headers: {
              Authorization: `token ${this.githubToken}`,
              Accept: 'application/vnd.github.v3+json',
            },
          }
        );

        return {
          name: branchResponse.data.name,
          sha: branchResponse.data.commit.sha,
        };
      }

      // Otherwise, fetch from GitHub API
      const repoResponse = await axios.get(
        `https://api.github.com/repos/${repository.fullName}`,
        {
          headers: {
            Authorization: `token ${this.githubToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );

      const defaultBranchName = repoResponse.data.default_branch;

      // Get the branch details
      const branchResponse = await axios.get<GithubBranch>(
        `https://api.github.com/repos/${repository.fullName}/branches/${defaultBranchName}`,
        {
          headers: {
            Authorization: `token ${this.githubToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );

      return {
        name: branchResponse.data.name,
        sha: branchResponse.data.commit.sha,
      };
    } catch (error) {
      console.error('Error getting default branch:', error);
      throw new Error('Failed to get repository default branch');
    }
  }

  /**
   * Gets package.json content from a specific path in the repository
   */
  private async getPackageJsonContent(
    repository: IRepository,
    filePath: string
  ): Promise<PackageJson | null> {
    try {
      const response = await axios.get<GithubContent>(
        `https://api.github.com/repos/${repository.fullName}/contents/${filePath}`,
        {
          headers: {
            Authorization: `token ${this.githubToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );

      // Decode content from base64
      const content = Buffer.from(response.data.content, 'base64').toString(
        'utf8'
      );

      return JSON.parse(content) as PackageJson;
    } catch (error) {
      console.error(
        `Error getting package.json content from ${filePath}:`,
        error
      );
      return null;
    }
  }

  /**
   * Process package.json to identify outdated dependencies
   */
  private async processPackageJson(
    packageJson: PackageJson,
    filePath: string
  ): Promise<IDependency[]> {
    const dependencies: IDependency[] = [];

    // Process regular dependencies
    const depsToProcess = [
      { deps: packageJson.dependencies, type: 'dependencies' },
      { deps: packageJson.devDependencies, type: 'devDependencies' },
      { deps: packageJson.peerDependencies, type: 'peerDependencies' },
    ];

    for (const { deps, type } of depsToProcess) {
      if (!deps) continue;

      for (const [packageName, versionRange] of Object.entries(deps)) {
        try {
          // Skip packages with special versions or GitHub dependencies
          if (
            versionRange.includes('://') ||
            versionRange.startsWith('git') ||
            versionRange.includes('github')
          ) {
            continue;
          }

          // Clean version range (remove ^, ~, etc.)
          const cleanVersion = versionRange.replace(/[^0-9.]/g, '');

          // Get latest version from npm
          const latestVersion = await this.getLatestPackageVersion(packageName);

          // Check if outdated
          const isOutdated =
            latestVersion && semver.gt(latestVersion, cleanVersion);

          dependencies.push({
            packageName,
            currentVersion: versionRange,
            latestVersion: latestVersion || undefined,
            isOutdated: !!isOutdated,
            filePath, // Store the path to know which file to update
            dependencyType: type, // Store dependency type for updates
          } as IDependency);
        } catch (error) {
          console.error(`Error processing ${packageName}:`, error);
          dependencies.push({
            packageName,
            currentVersion: versionRange,
            isOutdated: false,
          } as IDependency);
        }
      }
    }

    return dependencies;
  }

  /**
   * Gets the latest version of a package from npm
   */
  private async getLatestPackageVersion(
    packageName: string
  ): Promise<string | null> {
    try {
      const response = await axios.get(
        `https://registry.npmjs.org/${packageName}`
      );
      return response.data['dist-tags']?.latest || null;
    } catch (error) {
      console.error(`Error fetching npm info for ${packageName}:`, error);
      return null;
    }
  }

  /**
   * Create a pull request with dependency updates
   */
  public async createDependencyUpdatePR(
    scanId: string,
    repoId: string
  ): Promise<GithubPullRequest | null> {
    try {
      // Get scan data
      const scan = await Scan.findById(scanId);
      if (!scan || scan.status !== 'completed') {
        throw new Error('Scan not found or not completed');
      }

      // Get repository data
      const repository = await Repository.findById(repoId);
      if (!repository) {
        throw new Error('Repository not found');
      }

      // Get outdated dependencies
      const outdatedDependencies = scan.dependencies.filter(
        (dep) => dep.isOutdated
      );
      if (outdatedDependencies.length === 0) {
        console.log('No outdated dependencies to update');
        return null;
      }

      // Get default branch
      const { name: defaultBranch, sha: baseSha } = await this.getDefaultBranch(
        repository
      );

      // Create a new branch for updates
      const date = new Date().toISOString().split('T')[0];
      const branchName = `dependency-updates-${date}-${Math.floor(
        Math.random() * 1000
      )}`;

      await this.createBranch(repository, branchName, baseSha);

      // Group updates by file path
      const updatesByFile: Record<string, IDependency[]> = {};

      for (const dep of outdatedDependencies) {
        if (!dep.filePath) continue;

        if (!updatesByFile[dep.filePath]) {
          updatesByFile[dep.filePath] = [];
        }

        updatesByFile[dep.filePath].push(dep);
      }

      // Update each file and commit changes
      for (const [filePath, deps] of Object.entries(updatesByFile)) {
        await this.updatePackageJsonFile(
          repository,
          filePath,
          deps,
          branchName
        );
      }

      // Create pull request
      return await this.createPullRequest(
        repository,
        branchName,
        defaultBranch,
        outdatedDependencies
      );
    } catch (error) {
      console.error('Error creating PR for dependency updates:', error);
      return null;
    }
  }

  /**
   * Create a new branch in the repository
   */
  private async createBranch(
    repository: IRepository,
    branchName: string,
    baseSha: string
  ): Promise<void> {
    try {
      await axios.post(
        `https://api.github.com/repos/${repository.fullName}/git/refs`,
        {
          ref: `refs/heads/${branchName}`,
          sha: baseSha,
        },
        {
          headers: {
            Authorization: `token ${this.githubToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );
    } catch (error) {
      console.error(`Error creating branch ${branchName}:`, error);
      throw new Error('Failed to create branch for dependency updates');
    }
  }

  /**
   * Update package.json file with new dependency versions
   */
  private async updatePackageJsonFile(
    repository: IRepository,
    filePath: string,
    dependencies: IDependency[],
    branchName: string
  ): Promise<void> {
    try {
      // Get current file content and metadata
      const response = await axios.get<GithubContent>(
        `https://api.github.com/repos/${repository.fullName}/contents/${filePath}?ref=${branchName}`,
        {
          headers: {
            Authorization: `token ${this.githubToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );

      const content = Buffer.from(response.data.content, 'base64').toString(
        'utf8'
      );
      const packageJson = JSON.parse(content) as PackageJson;

      // Update dependencies
      let hasChanges = false;

      for (const dep of dependencies) {
        if (!dep.latestVersion) continue;

        // Determine prefix from current version (^, ~, etc.)
        const prefix = dep.currentVersion.startsWith('^')
          ? '^'
          : dep.currentVersion.startsWith('~')
          ? '~'
          : '';

        const newVersion = `${prefix}${dep.latestVersion}`;

        // Update correct dependency section
        const depType = dep.dependencyType || 'dependencies';

        if (
          depType === 'dependencies' &&
          packageJson.dependencies?.[dep.packageName]
        ) {
          packageJson.dependencies[dep.packageName] = newVersion;
          hasChanges = true;
        } else if (
          depType === 'devDependencies' &&
          packageJson.devDependencies?.[dep.packageName]
        ) {
          packageJson.devDependencies[dep.packageName] = newVersion;
          hasChanges = true;
        } else if (
          depType === 'peerDependencies' &&
          packageJson.peerDependencies?.[dep.packageName]
        ) {
          packageJson.peerDependencies[dep.packageName] = newVersion;
          hasChanges = true;
        }
      }

      if (!hasChanges) {
        return;
      }

      // Convert back to string with proper formatting
      const updatedContent = JSON.stringify(packageJson, null, 2);

      // Commit updated file
      await axios.put(
        `https://api.github.com/repos/${repository.fullName}/contents/${filePath}`,
        {
          message: `Update dependencies in ${filePath}`,
          content: Buffer.from(updatedContent).toString('base64'),
          sha: response.data.sha,
          branch: branchName,
        },
        {
          headers: {
            Authorization: `token ${this.githubToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );
    } catch (error) {
      console.error(`Error updating package.json file ${filePath}:`, error);
      throw new Error(
        `Failed to update package.json: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Create a pull request for the dependency updates
   */
  private async createPullRequest(
    repository: IRepository,
    branchName: string,
    baseBranch: string,
    outdatedDependencies: IDependency[]
  ): Promise<GithubPullRequest> {
    try {
      // Create PR title
      const prTitle = `Update ${outdatedDependencies.length} dependencies`;

      // Create PR description
      let prBody = '## Dependency Updates\n\n';
      prBody +=
        'This PR updates the following dependencies to their latest versions:\n\n';

      for (const dep of outdatedDependencies) {
        if (dep.latestVersion) {
          prBody += `- \`${dep.packageName}\`: ${dep.currentVersion} → ${dep.latestVersion}\n`;
        }
      }

      prBody +=
        '\n\n---\n*This PR was automatically generated by the dependency scanning tool.*';

      // Create the PR
      const response = await axios.post<GithubPullRequest>(
        `https://api.github.com/repos/${repository.fullName}/pulls`,
        {
          title: prTitle,
          body: prBody,
          head: branchName,
          base: baseBranch,
        },
        {
          headers: {
            Authorization: `token ${this.githubToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error creating pull request:', error);
      throw new Error('Failed to create pull request for dependency updates');
    }
  }

  /**
   * Runs a full scan for a repository, including dependencies and vulnerabilities
   */
  public async fullRepositoryScan(
    repoId: string,
    scanId: string,
    includeVulnerabilities: boolean = true
  ): Promise<IScan | null> {
    try {
      // First perform the regular dependency scan
      const completedScan = await this.scanRepository(repoId, scanId);

      // If the scan completed successfully and vulnerability scanning is requested
      if (
        completedScan &&
        completedScan.status === 'completed' &&
        includeVulnerabilities
      ) {
        console.log(
          `Dependency scan completed for ${repoId}, starting OSV vulnerability scan...`
        );

        try {
          // Perform vulnerability scanning using OSV
          return await vulnerabilityScanService.scanVulnerabilities(scanId, {
            batchSize: 20, // Use a larger batch size for better performance
          });
        } catch (vulnError) {
          console.error('Error in OSV vulnerability scanning:', vulnError);
          // Even if vulnerability scanning fails, we still return the completed dependency scan
          return completedScan;
        }
      }

      return completedScan;
    } catch (error) {
      console.error('Error in fullRepositoryScan:', error);
      throw error;
    }
  }
}

/**
 * Gets scan configuration for a user
 */
export const getUserScanConfig = async (
  userId: string
): Promise<IOnboardingConfig | null> => {
  try {
    return await OnboardingConfig.findOne({ userId });
  } catch (error) {
    console.error('Error getting user scan config:', error);
    return null;
  }
};

/**
 * Initializes an automatic scan for all selected repositories
 */
export const initiateAutomaticScan = async (
  userId: string,
  githubToken: string,
  includeVulnerabilities: boolean = true
): Promise<Record<string, string>> => {
  try {
    // Get user scan configuration
    const config = await getUserScanConfig(userId);
    if (!config) {
      throw new Error('User scan configuration not found');
    }

    // Get selected repositories
    const repositories = await Repository.find({
      userId,
      isRepoSelected: true,
    });
    if (repositories.length === 0) {
      throw new Error('No repositories selected for scanning');
    }

    // Create scan service
    const scanService = new DependencyScanService(userId, githubToken);

    // Initialize scans for all selected repositories
    const scanResults: Record<string, string> = {};

    for (const repo of repositories) {
      // Create a new scan record
      const scan = new Scan({
        repositoryId: repo._id,
        userId,
        status: 'pending',
      });

      await scan.save();

      // Start scan process (in background)
      scanService
        .fullRepositoryScan(
          repo._id.toString(),
          scan._id.toString(),
          includeVulnerabilities
        )
        .then(async (completedScan) => {
          if (
            completedScan &&
            completedScan.status === 'completed' &&
            completedScan.outdatedCount > 0
          ) {
            // Create PR for outdated dependencies
            await scanService.createDependencyUpdatePR(
              completedScan._id.toString(),
              repo._id.toString()
            );
          }

          // If high severity vulnerabilities are found, log them
          if (completedScan && completedScan.highSeverityCount > 0) {
            console.log(
              `WARNING: ${completedScan.highSeverityCount} high severity vulnerabilities found in ${repo.name} using OSV database`
            );

            // Here you could add code to send notifications or create issues for vulnerabilities
          }
        })
        .catch((error) => {
          console.error(
            `Error in automatic scan for repository ${repo.name}:`,
            error
          );
        });

      scanResults[repo.name] = scan._id.toString();
    }

    return scanResults;
  } catch (error) {
    console.error('Error initiating automatic scan:', error);
    throw error;
  }
};

// Extension point for future AI analysis and vulnerability scanning services
// addVulnerabilityInfo(scanId: string): Promise<void> {}
// analyzePackageSecurity(packageName: string, version: string): Promise<SecurityData> {}
