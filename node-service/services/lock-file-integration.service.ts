// services/lock-file-integration.service.ts

// import { Types } from 'mongoose'; // Unused import
import axios from 'axios';
import { DependencyNode } from '../types/services/dependency-tree';
import npmLockParserService from './npm-lock-parser.service';
import logger from '../utils/logger';
import Scan from '../models/Scan';
import Repository from '../models/Repository';
import User from '../models/User';
import { ITransitiveDependencyInfo } from '../types/models';
import SemverUtils from '../utils/semver.utils';
import IterativeDependencyTraverser, { DEPENDENCY_LIMITS } from '../utils/dependency-tree.utils';

/**
 * Service to integrate lock file analysis with the existing scan process
 */
export class LockFileIntegrationService {
  private memoryCacheTTL = 300000; // 5 minutes in milliseconds
  private memoryCache: Map<string, { data: any; timestamp: number }> =
    new Map();
  private traverser: IterativeDependencyTraverser | null = null;
  private allNodes: Map<string, DependencyNode> | null = null;

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

        // Add memory usage check before enrichment
        const memoryBefore = process.memoryUsage();
        logger.info(`Memory usage before enrichment: ${Math.round(memoryBefore.heapUsed / 1024 / 1024)}MB`);

        // Enrich nodes with latest versions and vulnerability data
        logger.info('Starting dependency node enrichment...');
        await this.enrichDependencyNodes(rootNodes);
        logger.info('Dependency node enrichment completed successfully');

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
    const startTime = Date.now();

    try {
      // Process all unique packages in batches using iterative collection
      const allPackages = this.collectAllPackages(nodes);

      // Validate package count and apply limits
      if (allPackages.length === 0) {
        logger.warn('No packages found for enrichment');
        return;
      }

      if (allPackages.length > DEPENDENCY_LIMITS.MAX_NODES) {
        logger.warn(`Too many packages (${allPackages.length}), limiting to ${DEPENDENCY_LIMITS.MAX_NODES}`);
        allPackages.splice(DEPENDENCY_LIMITS.MAX_NODES);
      }

      // Adaptive batch sizing based on package count
      const batchSize = this.calculateOptimalBatchSize(allPackages.length);

      logger.info(
        `Enriching ${allPackages.length} unique packages with metadata (batch size: ${batchSize})`
      );

      // Process in batches with progress tracking
      let processedCount = 0;
      const totalBatches = Math.ceil(allPackages.length / batchSize);

      for (let i = 0; i < allPackages.length; i += batchSize) {
        // Check processing time limit
        if (Date.now() - startTime > DEPENDENCY_LIMITS.MAX_PROCESSING_TIME) {
          logger.warn(`Enrichment timeout after ${DEPENDENCY_LIMITS.MAX_PROCESSING_TIME}ms, processed ${processedCount}/${allPackages.length} packages`);
          break;
        }

        const batch = allPackages.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;

        logger.debug(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} packages)`);

        try {
          // Log batch start for debugging
          logger.debug(`Starting batch ${batchNumber}: packages [${batch.map(([name]) => name).slice(0, 3).join(', ')}${batch.length > 3 ? '...' : ''}]`);

          // Fetch latest versions and vulnerability info in parallel with timeout
          await Promise.race([
            Promise.all([
              this.batchGetLatestVersions(batch),
              this.batchCheckVulnerabilities(batch),
            ]),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Batch timeout')), 120000) // 2 minute timeout per batch
            )
          ]);

          processedCount += batch.length;

          // Progress reporting with memory monitoring
          if (batchNumber % 5 === 0 || batchNumber === totalBatches) {
            const currentMemory = process.memoryUsage();
            logger.info(`Enrichment progress: ${processedCount}/${allPackages.length} packages (${Math.round(processedCount/allPackages.length*100)}%) - Memory: ${Math.round(currentMemory.heapUsed / 1024 / 1024)}MB`);
          }

          logger.debug(`Completed batch ${batchNumber} successfully`);

        } catch (batchError) {
          logger.error(`Error processing batch ${batchNumber}:`, {
            error: batchError instanceof Error ? batchError.message : String(batchError),
            batch: batch.map(([name, version]) => `${name}@${version}`).slice(0, 3),
            batchSize: batch.length
          });
          // Continue with next batch instead of failing completely
        }

        // Adaptive rate limiting based on batch size and API response times
        if (i + batchSize < allPackages.length) {
          const delay = this.calculateBatchDelay(batchSize);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      const totalTime = Date.now() - startTime;
      logger.info(`Package enrichment completed: ${processedCount}/${allPackages.length} packages in ${totalTime}ms`);

    } catch (error) {
      logger.error('Error in dependency node enrichment:', error);
      throw error;
    }
  }

  /**
   * Calculate optimal batch size based on total package count
   */
  private calculateOptimalBatchSize(totalPackages: number): number {
    if (totalPackages < 100) return 5;
    if (totalPackages < 1000) return 10;
    if (totalPackages < 5000) return 15;
    return 20; // Max batch size for very large projects
  }

  /**
   * Calculate delay between batches based on batch size
   */
  private calculateBatchDelay(batchSize: number): number {
    // Smaller batches = shorter delay, larger batches = longer delay
    const baseDelay = 100;
    const scaledDelay = batchSize * 10; // 10ms per item in batch
    return Math.min(baseDelay + scaledDelay, 1000); // Max 1 second delay
  }

  /**
   * Collect all unique packages from a dependency tree using iterative approach
   */
  private collectAllPackages(nodes: DependencyNode[]): Array<[string, string]> {
    try {
      this.traverser = new IterativeDependencyTraverser();
      const packages = this.traverser.collectAllPackages(
        nodes,
        DEPENDENCY_LIMITS.MAX_DEPTH,
        DEPENDENCY_LIMITS.MAX_NODES
      );

      // Build allNodes map for quick lookups during enrichment
      this.allNodes = new Map<string, DependencyNode>();
      this.buildNodeMap(nodes, this.allNodes);

      // Log performance metrics
      const metrics = this.traverser.getMetrics();
      logger.info('Package collection completed:', {
        uniquePackages: metrics.uniquePackages,
        totalNodes: metrics.totalNodes,
        maxDepth: metrics.maxDepth,
        circularReferences: metrics.circularReferences,
        processingTimeMs: metrics.processingTimeMs,
        memoryUsageMB: metrics.memoryUsageMB,
        allNodesCount: this.allNodes.size
      });

      // Warn about circular dependencies
      const circularDeps = this.traverser.getCircularDependencies();
      if (circularDeps.length > 0) {
        logger.warn(`Found ${circularDeps.length} circular dependencies in dependency tree:`, {
          examples: circularDeps.slice(0, 3),
          totalCount: circularDeps.length
        });
      }

      return packages;
    } catch (error) {
      logger.error('Error in iterative package collection:', error);
      // Fallback to limited collection
      return this.collectAllPackagesLimited(nodes, 20); // Limit to 20 levels
    }
  }

  /**
   * Build node map for quick lookups using iterative approach with circular dependency protection
   */
  private buildNodeMap(nodes: DependencyNode[], nodeMap: Map<string, DependencyNode>): void {
    const stack: DependencyNode[] = [...nodes];
    const visited = new Set<string>();
    let processedCount = 0;
    const maxIterations = 10000; // Safety limit

    logger.debug(`Building node map from ${nodes.length} root nodes...`);

    while (stack.length > 0 && processedCount < maxIterations) {
      const node = stack.pop()!;
      const nodeKey = `${node.name}@${node.version}`;

      // Skip if already processed (circular dependency protection)
      if (visited.has(nodeKey)) {
        continue;
      }
      visited.add(nodeKey);
      processedCount++;

      // Add to map if not already present
      if (!nodeMap.has(nodeKey)) {
        nodeMap.set(nodeKey, node);
      }

      // Add children to stack
      for (const [, childNode] of node.dependencies.entries()) {
        stack.push(childNode);
      }

      // Progress logging for large trees
      if (processedCount % 100 === 0) {
        logger.debug(`BuildNodeMap progress: ${processedCount} nodes processed, stack: ${stack.length}`);
      }
    }

    if (processedCount >= maxIterations) {
      logger.warn(`BuildNodeMap hit iteration limit (${maxIterations}), may be incomplete`);
    }

    logger.debug(`Node map built successfully: ${nodeMap.size} unique nodes from ${processedCount} iterations`);
  }

  /**
   * Fallback method for package collection with limited depth
   */
  private collectAllPackagesLimited(
    nodes: DependencyNode[],
    maxDepth: number
  ): Array<[string, string]> {
    const packages = new Set<string>();
    const result: Array<[string, string]> = [];
    let nodeCount = 0;
    const maxNodes = 5000; // Emergency limit

    const traverseLimited = (node: DependencyNode, depth: number) => {
      if (depth > maxDepth || nodeCount > maxNodes) {
        return;
      }

      const key = `${node.name}@${node.version}`;
      nodeCount++;

      if (!packages.has(key)) {
        packages.add(key);
        result.push([node.name, node.version]);

        // Process children with depth limit
        for (const [_, childNode] of node.dependencies.entries()) {
          traverseLimited(childNode, depth + 1);
        }
      }
    };

    // Process each root node with limited depth
    for (const node of nodes) {
      traverseLimited(node, 1);
    }

    logger.warn(`Used limited fallback collection: ${result.length} packages, max depth ${maxDepth}`);
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
   * Update all nodes in the tree with latest version info using iterative approach
   */
  private updateNodeLatestVersion(
    name: string,
    version: string,
    latestVersion: string | null
  ): void {
    // Use the cached nodes from traverser if available
    if (this.traverser && this.allNodes && this.allNodes.size > 0) {
      const nodeKey = `${name}@${version}`;
      const targetNode = this.allNodes.get(nodeKey);

      if (targetNode) {
        targetNode.latestVersion = latestVersion || undefined;

        // Determine if outdated
        if (latestVersion) {
          targetNode.isOutdated = SemverUtils.isGreaterThan(
            latestVersion,
            version
          );
        }
      }
    }

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
    // Use the cached nodes from traverser if available
    if (this.traverser && this.allNodes && this.allNodes.size > 0) {
      const nodeKey = `${name}@${version}`;
      const targetNode = this.allNodes.get(nodeKey);

      if (targetNode) {
        targetNode.isVulnerable = isVulnerable;
        targetNode.vulnerabilityCount = vulnerabilityCount;
      }
    }

    // Log for debugging
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
          const maxDepth = this.calculateMaxDepth(node);
          const transitiveDependencies: ITransitiveDependencyInfo = {
            count,
            vulnerableCount,
            outdatedCount,
            maxDepth,
            analyzed: true,
            storageType: 'embedded',
            // Only store tree for small dependencies or skip to avoid bloating DB
            tree: count < 50 ? this.serializeTree(node) : undefined,
          };

          logger.debug(
            `${node.name} transitive info: ${count} deps, ${vulnerableCount} vulnerable, ${outdatedCount} outdated, depth ${maxDepth}`
          );

          // Update the dependency
          directDependencies[matchingDepIndex] = {
            ...directDependencies[matchingDepIndex],
            transitiveDependencies,
          };
        }
      }

      // Calculate aggregate statistics for better UI display
      const totalOutdatedTransitive = directDependencies.reduce(
        (sum, dep) => sum + (dep.transitiveDependencies?.outdatedCount || 0),
        0
      );
      const maxTransitiveDepth = Math.max(
        ...directDependencies.map(dep => dep.transitiveDependencies?.maxDepth || 0)
      );

      // Update scan with enhanced dependencies and statistics
      await Scan.findByIdAndUpdate(scanId, {
        dependencies: directDependencies,
        transitiveDependencyCount: totalTransitiveCount,
        vulnerableTransitiveDependencyCount: totalVulnerableCount,
        // Add new aggregate fields for UI
        outdatedTransitiveDependencyCount: totalOutdatedTransitive,
        maxTransitiveDependencyDepth: maxTransitiveDepth,
      });

      logger.info(
        `Updated scan with transitive dependency info: ${totalTransitiveCount} total, ${totalVulnerableCount} vulnerable, ${totalOutdatedTransitive} outdated, max depth ${maxTransitiveDepth}`
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

    // Iterative traversal using stack
    const stack: DependencyNode[] = [node];
    const visited = new Set<string>();

    while (stack.length > 0) {
      const currentNode = stack.pop()!;
      const nodeKey = `${currentNode.name}@${currentNode.version}`;

      // Skip if already visited (handle circular dependencies)
      if (visited.has(nodeKey)) {
        continue;
      }
      visited.add(nodeKey);

      for (const [, childNode] of currentNode.dependencies.entries()) {
        count++;

        if (childNode.isVulnerable) {
          vulnerableCount += childNode.vulnerabilityCount;
        }

        if (childNode.isOutdated) {
          outdatedCount++;
        }

        // Add children to stack for processing
        stack.push(childNode);
      }
    }

    return { count, vulnerableCount, outdatedCount };
  }

  /**
   * Calculate the maximum depth of a tree using iterative approach
   */
  private calculateMaxDepth(node: DependencyNode): number {
    let maxDepth = 0;

    // Iterative traversal using stack with depth tracking
    const stack: Array<{ node: DependencyNode; depth: number }> = [{ node, depth: 1 }];
    const visited = new Set<string>();

    while (stack.length > 0) {
      const { node: currentNode, depth } = stack.pop()!;
      const nodeKey = `${currentNode.name}@${currentNode.version}`;

      // Skip if already visited (handle circular dependencies)
      if (visited.has(nodeKey)) {
        continue;
      }
      visited.add(nodeKey);

      maxDepth = Math.max(maxDepth, depth);

      for (const [, childNode] of currentNode.dependencies.entries()) {
        stack.push({ node: childNode, depth: depth + 1 });
      }
    }

    return maxDepth;
  }

  /**
   * Serialize a dependency tree to a plain object format for storage using iterative approach
   */
  private serializeTree(rootNode: DependencyNode): any {
    const visited = new Set<string>();
    const stack: Array<{ node: DependencyNode; parent?: any; key?: string }> = [
      { node: rootNode }
    ];
    let result: any = null;

    while (stack.length > 0) {
      const { node, parent, key } = stack.pop()!;
      const nodeKey = `${node.name}@${node.version}`;

      // Skip if already visited (handle circular dependencies)
      if (visited.has(nodeKey)) {
        if (parent && key) {
          parent[key] = {
            name: node.name,
            version: node.version,
            _circular: true
          };
        }
        continue;
      }
      visited.add(nodeKey);

      const serializedNode = {
        name: node.name,
        version: node.version,
        isVulnerable: node.isVulnerable,
        vulnerabilityCount: node.vulnerabilityCount,
        isOutdated: node.isOutdated,
        latestVersion: node.latestVersion,
        depth: node.depth,
        dependencyType: node.dependencyType,
        dependencies: {} as Record<string, any>,
      };

      if (parent && key) {
        parent[key] = serializedNode;
      } else {
        result = serializedNode;
      }

      // Add children to stack for processing
      for (const [depName, childNode] of node.dependencies.entries()) {
        stack.push({
          node: childNode,
          parent: serializedNode.dependencies,
          key: depName
        });
      }
    }

    return result;
  }
}

export const lockFileIntegrationService = new LockFileIntegrationService();
export default lockFileIntegrationService;
