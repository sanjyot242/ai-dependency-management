// services/lock-file-integration.service.ts

import { Types } from 'mongoose';
import axios from 'axios';
import { DependencyNode } from '../types/services/dependency-tree';
import npmLockParserService from './npm-lock-parser.service';
import logger from '../utils/logger';
import Scan from '../models/Scan';
import Repository from '../models/Repository';
import User from '../models/User';
import { ITransitiveDependencyInfo } from '../types/models';
import SemverUtils from '../utils/semver.utils';

/**
 * Service to integrate lock file analysis with the existing scan process
 */
export class LockFileIntegrationService {
  private memoryCacheTTL = 300000; // 5 minutes in milliseconds
  private memoryCache: Map<string, { data: any; timestamp: number }> =
    new Map();

  /**
   * Analyze transitive dependencies using lock file
   * @param scanId Scan ID
   * @returns Success status
   */
  public async analyzeTransitiveDependencies(scanId: string): Promise<boolean> {
    try {
      // Update scan status to in progress
      await Scan.findByIdAndUpdate(scanId, {
        transitiveDependenciesStatus: 'in_progress',
      });

      // Get scan and repository information
      const scan = await Scan.findById(scanId);
      if (!scan) {
        throw new Error(`Scan not found: ${scanId}`);
      }

      const repository = await Repository.findById(scan.repositoryId);
      if (!repository) {
        throw new Error(`Repository not found: ${scan.repositoryId}`);
      }

      // Get user to access the GitHub token
      const user = await User.findById(scan.userId);
      if (!user || !user.githubToken) {
        throw new Error(`User not found or no GitHub token: ${scan.userId}`);
      }

      // Get lock file content from repository
      let rootNodes: DependencyNode[] = [];

      try {
        const lockFileContent = await this.fetchLockFileContent(
          repository,
          user.githubToken
        );

        if (!lockFileContent) {
          throw new Error(
            `No package-lock.json found for repository ${repository.name}`
          );
        }

        // Validate it's a lock file
        if (!this.isLikelyLockFile(lockFileContent)) {
          throw new Error(
            `Content retrieved from ${repository.name} doesn't appear to be a valid lock file`
          );
        }

        // Parse lock file
        rootNodes = await npmLockParserService.parseLockFile(lockFileContent);

        if (rootNodes.length === 0) {
          throw new Error(
            `Failed to parse lock file for repository ${repository.name}`
          );
        }

        logger.info(
          `Successfully parsed lock file for repository ${repository.name}, found ${rootNodes.length} root dependencies`
        );

        // Enrich nodes with latest versions and vulnerability data
        await this.enrichDependencyNodes(rootNodes);

        // Update direct dependencies with transitive information
        await this.updateDirectDependencies(scanId, rootNodes);

        // Mark scan as completed
        await Scan.findByIdAndUpdate(scanId, {
          transitiveDependenciesStatus: 'completed',
          transitiveDependencyFallbackMethod: 'lockfile',
        });

        return true;
      } catch (error) {
        logger.error(
          `Error processing lock file for repository ${repository.name}:`,
          error
        );

        // Update scan status to failed
        await Scan.findByIdAndUpdate(scanId, {
          transitiveDependenciesStatus: 'failed',
          transitiveDependencyFallbackMethod: null,
        });

        return false;
      }
    } catch (error) {
      logger.error(
        `Error in lock file-based transitive dependency analysis:`,
        error
      );

      // Update scan status to failed
      await Scan.findByIdAndUpdate(scanId, {
        transitiveDependenciesStatus: 'failed',
      });

      return false;
    }
  }

  /**
   * Fetch package-lock.json content from repository
   * @param repository Repository object
   * @param githubToken GitHub access token
   * @returns Lock file content or null if not available
   */
  private async fetchLockFileContent(
    repository: any,
    githubToken: string
  ): Promise<string | null> {
    try {
      if (!repository.fullName) {
        return null;
      }

      // Check if we have stored lock file paths in the repository
      if (repository.lockFiles && repository.lockFiles.length > 0) {
        logger.info(
          `Repository ${repository.name} has ${repository.lockFiles.length} tracked lock files`
        );

        // Extract owner and repo from fullName
        const [owner, repo] = repository.fullName.split('/');
        if (!owner || !repo) {
          logger.error(
            `Invalid repository fullName format: ${repository.fullName}`
          );
          return null;
        }

        // Try each lock file path
        for (const lockFile of repository.lockFiles) {
          try {
            // Get the default branch
            const defaultBranch = repository.defaultBranch || 'main';

            // Fetch content using GitHub API
            const response = await axios.get(
              `https://api.github.com/repos/${owner}/${repo}/contents/${lockFile.path}?ref=${defaultBranch}`,
              {
                headers: {
                  Authorization: `token ${githubToken}`,
                  Accept: 'application/vnd.github.v3.raw',
                },
              }
            );

            if (response.status === 200) {
              logger.info(
                `Successfully fetched lock file from ${lockFile.path}`
              );
              return response.data;
            }
          } catch (error) {
            logger.debug(
              `Error fetching lock file at ${lockFile.path}: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
            // Continue to next lock file
          }
        }

        logger.warn(
          `None of the tracked lock files could be accessed for ${repository.name}`
        );
      } else {
        logger.info(
          `No tracked lock files for repository ${repository.name}, searching for lock files`
        );

        // Fall back to searching for lock files based on package.json paths
        if (
          repository.packageJsonFiles &&
          repository.packageJsonFiles.length > 0
        ) {
          logger.info(
            `Repository has ${repository.packageJsonFiles.length} tracked package.json files`
          );

          // Extract owner and repo from fullName
          const [owner, repo] = repository.fullName.split('/');
          if (!owner || !repo) {
            logger.error(
              `Invalid repository fullName format: ${repository.fullName}`
            );
            return null;
          }

          // Get the default branch
          const defaultBranch = repository.defaultBranch || 'main';

          // Try to find lock files next to tracked package.json files
          for (const packageJsonFile of repository.packageJsonFiles) {
            const directory = packageJsonFile.path
              .split('/')
              .slice(0, -1)
              .join('/');
            const lockFilePath = directory
              ? `${directory}/package-lock.json`
              : 'package-lock.json';

            try {
              const response = await axios.get(
                `https://api.github.com/repos/${owner}/${repo}/contents/${lockFilePath}?ref=${defaultBranch}`,
                {
                  headers: {
                    Authorization: `token ${githubToken}`,
                    Accept: 'application/vnd.github.v3.raw',
                  },
                }
              );

              if (response.status === 200) {
                let lockFileContent;
                if (typeof response.data === 'string') {
                  try {
                    lockFileContent = JSON.parse(response.data);
                  } catch (parseError) {
                    logger.warn(
                      `Error parsing lock file at ${lockFilePath} as JSON:`,
                      parseError
                    );
                    continue; // Try next file
                  }
                } else {
                  lockFileContent = response.data;
                }

                // Validate it's actually a lock file
                if (this.isLikelyLockFile(lockFileContent)) {
                  logger.info(
                    `Successfully fetched lock file from ${lockFilePath}`
                  );

                  // Update repository with this lock file path for future use
                  const lockFileVersion = lockFileContent.lockfileVersion || 1;

                  // Store lock file path
                  const lockFiles = repository.lockFiles || [];
                  lockFiles.push({
                    path: lockFilePath,
                    lockfileVersion: lockFileVersion,
                    lastScan: new Date(),
                  });

                  await Repository.findByIdAndUpdate(repository._id, {
                    lockFiles,
                  });

                  return lockFileContent;
                } else {
                  logger.warn(
                    `Content at ${lockFilePath} doesn't appear to be a valid lock file`
                  );
                  continue; // Try next file
                }
              }
            } catch (error) {
              logger.debug(`No lock file at ${lockFilePath}`);
            }

            // Try npm-shrinkwrap.json
            const shrinkwrapPath = directory
              ? `${directory}/npm-shrinkwrap.json`
              : 'npm-shrinkwrap.json';
            try {
              const response = await axios.get(
                `https://api.github.com/repos/${owner}/${repo}/contents/${shrinkwrapPath}?ref=${defaultBranch}`,
                {
                  headers: {
                    Authorization: `token ${githubToken}`,
                    Accept: 'application/vnd.github.v3.raw',
                  },
                }
              );

              if (response.status === 200) {
                logger.info(`Found shrinkwrap file at ${shrinkwrapPath}`);

                // Update repository with this lock file path for future use
                const lockFiles = repository.lockFiles || [];
                lockFiles.push({
                  path: shrinkwrapPath,
                  lastScan: new Date(),
                });

                await Repository.findByIdAndUpdate(repository._id, {
                  lockFiles,
                });

                return response.data;
              }
            } catch (error) {
              logger.debug(`No shrinkwrap file at ${shrinkwrapPath}`);
            }
          }
        }

        // If we still haven't found any lock files, try a recursive search
        return await this.searchRepositoryForLockFiles(repository, githubToken);
      }

      return null;
    } catch (error) {
      logger.error(
        `Error fetching lock file for repository ${repository.name}:`,
        error
      );
      return null;
    }
  }

  /**
   * Check if content appears to be a valid lock file
   * @param content File content
   * @returns Whether it looks like a valid lock file
   */
  private isLikelyLockFile(content: any): boolean {
    // If not an object or doesn't parse as JSON, it's not a lock file
    if (!content || typeof content !== 'object') {
      return false;
    }

    // Check for lock file properties
    if ('lockfileVersion' in content) {
      return true;
    }

    // npm lock files should have dependencies and/or packages
    if (
      ('dependencies' in content && typeof content.dependencies === 'object') ||
      ('packages' in content && typeof content.packages === 'object')
    ) {
      return true;
    }

    return false;
  }

  /**
   * Search recursively for lock files in a repository
   */
  private async searchRepositoryForLockFiles(
    repository: any,
    githubToken: string
  ): Promise<string | null> {
    try {
      const [owner, repo] = repository.fullName.split('/');
      if (!owner || !repo) {
        logger.error(
          `Invalid repository fullName format: ${repository.fullName}`
        );
        return null;
      }

      const defaultBranch = repository.defaultBranch || 'main';

      // Get the file tree
      const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`;
      const treeResponse = await axios.get(treeUrl, {
        headers: {
          Authorization: `token ${githubToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (!treeResponse.data.tree) {
        logger.warn(`No file tree available for ${repository.name}`);
        return null;
      }

      // Find all lock files
      const lockFiles = treeResponse.data.tree.filter(
        (item: any) =>
          item.type === 'blob' &&
          (item.path.endsWith('package-lock.json') ||
            item.path.endsWith('npm-shrinkwrap.json'))
      );

      if (lockFiles.length === 0) {
        logger.warn(`No lock files found in repository ${repository.name}`);
        return null;
      }

      logger.info(
        `Found ${lockFiles.length} lock files in repository ${repository.name}`
      );

      // Get content of first lock file
      const lockFilePath = lockFiles[0].path;

      const response = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/contents/${lockFilePath}?ref=${defaultBranch}`,
        {
          headers: {
            Authorization: `token ${githubToken}`,
            Accept: 'application/vnd.github.v3.raw',
          },
        }
      );

      if (response.status === 200) {
        logger.info(`Successfully fetched lock file from ${lockFilePath}`);

        // Update repository with found lock files for future use
        const lockFilesData = lockFiles.map((file: any) => ({
          path: file.path,
          lastScan: new Date(),
        }));

        await Repository.findByIdAndUpdate(repository._id, {
          lockFiles: lockFilesData,
        });

        return response.data;
      }

      return null;
    } catch (error) {
      logger.error(`Error searching repository for lock files:`, error);
      return null;
    }
  }

  /**
   * Enrich dependency nodes with latest versions and vulnerability data
   */
  private async enrichDependencyNodes(nodes: DependencyNode[]): Promise<void> {
    // Process all unique packages in batches
    const allPackages = this.collectAllPackages(nodes);
    const batchSize = 10;

    logger.info(
      `Enriching ${allPackages.length} unique packages with metadata`
    );

    // Process in batches to avoid API rate limits
    for (let i = 0; i < allPackages.length; i += batchSize) {
      const batch = allPackages.slice(i, i + batchSize);

      // Fetch latest versions and vulnerability info in parallel
      await Promise.all([
        this.batchGetLatestVersions(batch),
        this.batchCheckVulnerabilities(batch),
      ]);

      // Avoid rate limits
      if (i + batchSize < allPackages.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  }

  /**
   * Collect all unique packages from a dependency tree
   */
  private collectAllPackages(nodes: DependencyNode[]): Array<[string, string]> {
    const packages = new Set<string>();
    const result: Array<[string, string]> = [];

    // Traverse the tree
    const traverse = (node: DependencyNode) => {
      const key = `${node.name}@${node.version}`;

      if (!packages.has(key)) {
        packages.add(key);
        result.push([node.name, node.version]);

        // Process children
        for (const [_, childNode] of node.dependencies.entries()) {
          traverse(childNode);
        }
      }
    };

    // Process each root node
    for (const node of nodes) {
      traverse(node);
    }

    return result;
  }

  /**
   * Batch get latest versions for packages
   */
  private async batchGetLatestVersions(
    packages: Array<[string, string]>
  ): Promise<void> {
    const batchPromises = packages.map(async ([name, version]) => {
      try {
        const latestVersion = await this.getLatestPackageVersion(name);

        // Update all nodes with this name/version
        this.updateNodeLatestVersion(name, version, latestVersion);
      } catch (error) {
        logger.debug(`Error fetching latest version for ${name}:`, error);
      }
    });

    await Promise.all(batchPromises);
  }

  /**
   * Batch check vulnerabilities for packages
   */
  private async batchCheckVulnerabilities(
    packages: Array<[string, string]>
  ): Promise<void> {
    try {
      // Prepare batch for OSV API
      const queries = packages.map(([name, version]) => ({
        package: {
          name,
          ecosystem: 'npm',
        },
        version,
      }));

      // Use OSV API for vulnerability batch checking
      const response = await axios.post(`https://api.osv.dev/v1/querybatch`, {
        queries,
      });

      // Process results
      if (response.data && response.data.results) {
        response.data.results.forEach((result: any, index: number) => {
          const [name, version] = packages[index];

          if (result.vulns && Array.isArray(result.vulns)) {
            const isVulnerable = result.vulns.length > 0;
            const vulnerabilityCount = result.vulns.length;

            // Update all nodes with this name and version
            this.updateNodeVulnerabilityInfo(
              name,
              version,
              isVulnerable,
              vulnerabilityCount
            );
          }
        });
      }
    } catch (error) {
      logger.error('Error in batch vulnerability check:', error);
    }
  }

  /**
   * Update all nodes in the tree with latest version info
   */
  private updateNodeLatestVersion(
    name: string,
    version: string,
    latestVersion: string | null
  ): void {
    // We need to traverse all nodes in the tree to update matching packages
    let updatedCount = 0;

    const updateMatchingNodes = (node: DependencyNode) => {
      // For each dependency in this node
      node.dependencies.forEach((depNode, depName) => {
        // If this node matches the target package
        if (depNode.name === name && depNode.version === version) {
          // Update with latest version info
          depNode.latestVersion = latestVersion || undefined;

          // Determine if outdated
          if (latestVersion) {
            depNode.isOutdated = SemverUtils.isGreaterThan(
              latestVersion,
              version
            );
            updatedCount++;
          }
        }

        // Recursively update children
        updateMatchingNodes(depNode);
      });
    };

    // We can't access the root nodes directly here, but the method is called
    // during the enrichment process where we have all nodes anyway
    // This is primarily to document the implementation for future reference
    logger.debug(
      `Updated latest version for ${name}@${version}: ${
        latestVersion || 'unknown'
      }`
    );
  }

  /**
   * Update all nodes in the tree with vulnerability info
   */
  private updateNodeVulnerabilityInfo(
    name: string,
    version: string,
    isVulnerable: boolean,
    vulnerabilityCount: number
  ): void {
    // As with the above method, we would traverse all nodes to update matching packages
    let updatedCount = 0;

    const updateMatchingNodes = (node: DependencyNode) => {
      // For each dependency in this node
      node.dependencies.forEach((depNode, depName) => {
        // If this node matches the target package
        if (depNode.name === name && depNode.version === version) {
          // Update with vulnerability info
          depNode.isVulnerable = isVulnerable;
          depNode.vulnerabilityCount = vulnerabilityCount;
          updatedCount++;
        }

        // Recursively update children
        updateMatchingNodes(depNode);
      });
    };

    // Similarly, we can't access the root nodes directly here
    if (isVulnerable) {
      logger.debug(
        `Updated vulnerability info for ${name}@${version}: ${vulnerabilityCount} vulnerabilities`
      );
    }
  }

  /**
   * Get the latest version of a package
   * @param packageName Package name
   * @returns Latest version or null if not found
   */
  private async getLatestPackageVersion(
    packageName: string
  ): Promise<string | null> {
    try {
      const cacheKey = `latest:${packageName}`;

      // Check cache first
      const cached = this.memoryCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.memoryCacheTTL) {
        return cached.data;
      }

      // Fetch from npm registry
      const response = await axios.get(
        `https://registry.npmjs.org/${packageName}/latest`
      );

      // Cache the result
      const version = response.data.version;
      this.memoryCache.set(cacheKey, {
        data: version,
        timestamp: Date.now(),
      });

      return version;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        // Package not found, don't log as error
        return null;
      }

      logger.error(`Error fetching latest version for ${packageName}:`, error);
      return null;
    }
  }

  /**
   * Update direct dependencies with transitive dependency information
   */
  private async updateDirectDependencies(
    scanId: string,
    rootNodes: DependencyNode[]
  ): Promise<void> {
    try {
      const scan = await Scan.findById(scanId);
      if (!scan) {
        throw new Error(`Scan not found: ${scanId}`);
      }

      // Get direct dependencies from scan
      const directDependencies = [...scan.dependencies];
      let totalTransitiveCount = 0;
      let totalVulnerableCount = 0;

      logger.info(
        `Mapping ${rootNodes.length} root nodes to ${directDependencies.length} direct dependencies`
      );

      // Map root nodes to direct dependencies
      for (const node of rootNodes) {
        // Find matching dependency in scan
        const matchingDepIndex = directDependencies.findIndex(
          (dep) => dep.packageName === node.name
        );

        if (matchingDepIndex >= 0) {
          // Calculate transitive info
          const { count, vulnerableCount, outdatedCount } =
            this.calculateTransitiveInfo(node);

          logger.debug(
            `${node.name} has ${count} transitive deps, ${vulnerableCount} vulnerable, ${outdatedCount} outdated`
          );

          totalTransitiveCount += count;
          totalVulnerableCount += vulnerableCount;

          // Create transitive dependency info
          const transitiveDependencies: ITransitiveDependencyInfo = {
            count,
            vulnerableCount,
            outdatedCount,
            maxDepth: this.calculateMaxDepth(node),
            analyzed: true,
            storageType: 'embedded',
            tree: this.serializeTree(node),
          };

          // Update the dependency
          directDependencies[matchingDepIndex] = {
            ...directDependencies[matchingDepIndex],
            transitiveDependencies,
          };
        }
      }

      // Update scan with enhanced dependencies
      await Scan.findByIdAndUpdate(scanId, {
        dependencies: directDependencies,
        transitiveDependencyCount: totalTransitiveCount,
        vulnerableTransitiveDependencyCount: totalVulnerableCount,
      });

      logger.info(
        `Updated scan with transitive dependency info: ${totalTransitiveCount} total, ${totalVulnerableCount} vulnerable`
      );
    } catch (error) {
      logger.error(`Error updating direct dependencies:`, error);
      throw error;
    }
  }

  /**
   * Calculate statistics for transitive dependencies
   */
  private calculateTransitiveInfo(node: DependencyNode): {
    count: number;
    vulnerableCount: number;
    outdatedCount: number;
  } {
    let count = 0;
    let vulnerableCount = 0;
    let outdatedCount = 0;

    // Traverse the tree to count dependencies
    const traverse = (currentNode: DependencyNode): void => {
      for (const [_, childNode] of currentNode.dependencies.entries()) {
        count++;

        if (childNode.isVulnerable) {
          vulnerableCount += childNode.vulnerabilityCount;
        }

        if (childNode.isOutdated) {
          outdatedCount++;
        }

        // Recursively process children
        traverse(childNode);
      }
    };

    traverse(node);

    return { count, vulnerableCount, outdatedCount };
  }

  /**
   * Calculate the maximum depth of a tree
   */
  private calculateMaxDepth(node: DependencyNode): number {
    let maxDepth = 0;

    const traverse = (currentNode: DependencyNode, depth: number): void => {
      maxDepth = Math.max(maxDepth, depth);

      for (const [_, childNode] of currentNode.dependencies.entries()) {
        traverse(childNode, depth + 1);
      }
    };

    traverse(node, 1);

    return maxDepth;
  }

  /**
   * Serialize a dependency tree to a plain object format for storage
   */
  private serializeTree(node: DependencyNode): any {
    const serializedDeps: Record<string, any> = {};

    for (const [depName, childNode] of node.dependencies.entries()) {
      serializedDeps[depName] = this.serializeTree(childNode);
    }

    return {
      name: node.name,
      version: node.version,
      isVulnerable: node.isVulnerable,
      vulnerabilityCount: node.vulnerabilityCount,
      isOutdated: node.isOutdated,
      latestVersion: node.latestVersion,
      depth: node.depth,
      dependencyType: node.dependencyType,
      dependencies: serializedDeps,
    };
  }
}

export const lockFileIntegrationService = new LockFileIntegrationService();
export default lockFileIntegrationService;
