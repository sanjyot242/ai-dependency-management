// services/lock-file-integration.service.ts

import { Types } from 'mongoose';
import { DependencyNode } from '../types/services/dependency-tree';
import npmLockParserService from './npm-lock-parser.service';
import logger from '../utils/logger';
import Scan from '../models/Scan';
import Repository from '../models/Repository';
import { ITransitiveDependencyInfo } from '../types/models';
import axios from 'axios';
import SemverUtils from '../utils/semver.utils';
import User from '../models/User';

/**
 * Service to integrate lock file analysis with the existing scan process
 */
export class LockFileIntegrationService {
  private memoryCacheTTL = 300000; // 5 minutes in milliseconds
  private memoryCache: Map<string, { data: any; timestamp: number }> =
    new Map();

  /**
   * Analyze transitive dependencies using lock file when available
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
      if (!user) {
        throw new Error(`User not found: ${scan.userId}`);
      }

      // Get lock file content from repository
      let rootNodes: DependencyNode[] = [];
      let usedLockFile = false;

      try {
        const lockFileContent = await this.fetchLockFileContent(
          repository,
          user.githubToken || ''
        );

        if (lockFileContent) {
          // Parse lock file
          rootNodes = await npmLockParserService.parseLockFile(lockFileContent);
          usedLockFile = rootNodes.length > 0;
          logger.info(
            `Successfully parsed lock file for repository ${repository.name}, found ${rootNodes.length} root dependencies`
          );
        }
      } catch (error) {
        logger.warn(
          `Could not parse lock file for repository ${repository.name}:`,
          error
        );
      }

      // If lock file parsing failed or returned no nodes, fall back to API-based analysis
      if (!usedLockFile) {
        logger.info(
          `Falling back to API-based analysis for repository ${repository.name}`
        );
        await this.fallbackToApiAnalysis(scanId);
        return true;
      }

      // Enrich nodes with latest versions and vulnerability data
      await this.enrichDependencyNodes(rootNodes);

      // Update direct dependencies with transitive information
      await this.updateDirectDependencies(scanId, rootNodes);

      // Mark scan as completed
      await Scan.findByIdAndUpdate(scanId, {
        transitiveDependenciesStatus: 'completed',
      });

      return true;
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
   * @returns Lock file content or null if not available
   */
  private async fetchLockFileContent(
    repository: any,
    githubToken: string
  ): Promise<string | null> {
    try {
      // For GitHub repositories, we can fetch files directly from the API
      // You'll need to modify this based on how your system stores repository credentials

      if (!repository.fullName) {
        return null;
      }

      if (!githubToken) {
        logger.warn(
          `No GitHub token available for repository ${repository.name}, skipping lock file analysis`
        );
        return null;
      }

      // Example: Fetch package-lock.json from GitHub using the repository token
      const response = await axios.get(
        `https://api.github.com/repos/${repository.fullName}/contents/package-lock.json`,
        {
          headers: {
            Accept: 'application/vnd.github.v3.raw',
            Authorization: `token ${githubToken}`,
          },
        }
      );

      if (response.status === 200) {
        return response.data;
      }

      return null;
    } catch (error) {
      // Not found or other error
      logger.debug(
        `Error fetching lock file for repository ${repository.name}:`,
        error
      );
      return null;
    }
  }

  /**
   * Fallback to API-based analysis if lock file parsing fails
   */
  private async fallbackToApiAnalysis(scanId: string): Promise<void> {
    // Use your existing dependency-tree.service.ts implementation
    // This would call your current API-based approach

    // Example:
    // await dependencyTreeService.incrementalAnalysis(scanId);

    // For now, we'll update the scan to show we're falling back
    await Scan.findByIdAndUpdate(scanId, {
      transitiveDependenciesStatus: 'in_progress',
      transitiveDependencyFallbackMethod: 'api',
    });

    // Your existing implementation would handle the analysis
  }

  /**
   * Enrich dependency nodes with latest versions and vulnerability data
   */
  private async enrichDependencyNodes(nodes: DependencyNode[]): Promise<void> {
    // Process all unique packages in batches
    const allPackages = this.collectAllPackages(nodes);
    const batchSize = 10;

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

        // Find all instances of this package in the tree and update them
        packages.forEach(([pkgName, pkgVersion]) => {
          if (pkgName === name) {
            // Find and update all nodes with this name
            this.updateNodeLatestVersion(name, pkgVersion, latestVersion);
          }
        });
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
    // This would actually traverse the tree and update all matching nodes
    // For simplicity, we're not implementing the full traversal here

    if (latestVersion) {
      // Check if this version is outdated
      const isOutdated = SemverUtils.isGreaterThan(latestVersion, version);

      // In a real implementation, you would update all nodes with this name and version
    }
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
    // This would actually traverse the tree and update all matching nodes
    // For simplicity, we're not implementing the full traversal here
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
