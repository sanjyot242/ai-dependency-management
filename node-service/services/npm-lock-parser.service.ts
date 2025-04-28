// services/npm-lock-parser.service.ts

import fs from 'fs/promises';
import { DependencyNode } from '../types/services/dependency-tree';
import logger from '../utils/logger';
import SemverUtils from '../utils/semver.utils';

/**
 * Service for parsing npm package-lock.json files to extract dependency trees
 */
export class NpmLockParserService {
  /**
   * Parse a package-lock.json file to extract the dependency tree
   * @param lockFileContent Content of package-lock.json
   * @returns Array of root dependency nodes
   */
  public async parseLockFile(
    lockFileContent: string
  ): Promise<DependencyNode[]> {
    try {
      // Parse the lock file JSON
      const lockData = JSON.parse(lockFileContent);

      // Check lock file version
      if (!lockData.lockfileVersion) {
        logger.warn(`Unsupported npm lock file version`);
        return [];
      }

      const rootNodes: DependencyNode[] = [];

      // Parse based on lockfile version
      if (lockData.lockfileVersion >= 2) {
        // npm 7+ (lockfileVersion 2+)
        await this.parseNpmLockfileV2(lockData, rootNodes);
      } else {
        // npm 6 and earlier (lockfileVersion 1)
        await this.parseNpmLockfileV1(lockData, rootNodes);
      }

      return rootNodes;
    } catch (error) {
      logger.error(`Error parsing npm lock file:`, error);
      return [];
    }
  }

  /**
   * Parse npm lockfile version 2+ (npm 7+)
   */
  private async parseNpmLockfileV2(
    lockData: any,
    rootNodes: DependencyNode[]
  ): Promise<void> {
    // For npm 7+, packages are in a flat structure with paths
    const packageCache = new Map<string, DependencyNode>();
    const directDependencies = new Set<string>();

    // First get direct dependencies from the root package
    if (lockData.packages && lockData.packages['']) {
      const rootPkg = lockData.packages[''];

      // Get direct dependencies
      ['dependencies', 'devDependencies'].forEach((depType) => {
        if (rootPkg[depType]) {
          Object.keys(rootPkg[depType]).forEach((name) => {
            directDependencies.add(name);
          });
        }
      });
    }

    // Build a cache of all packages
    if (lockData.packages) {
      for (const [pkgPath, pkgInfo] of Object.entries(lockData.packages)) {
        if (pkgPath === '') continue; // Skip root package

        // Extract name and version from path or package info
        let name, version;

        if (pkgPath.startsWith('node_modules/')) {
          // Extract from path (e.g., node_modules/lodash)
          const parts = pkgPath.split('/');
          name = parts[1].startsWith('@')
            ? `${parts[1]}/${parts[2]}`
            : parts[1];
          version = (pkgInfo as any).version;
        } else {
          // Handle other formats
          const pkgId = pkgPath as string;
          const idParts = pkgId.split('@');

          if (idParts.length >= 2) {
            if (pkgId.startsWith('@')) {
              const scopeParts = pkgId.substring(1).split('@');
              name = `@${scopeParts[0]}`;
              version = scopeParts[1] || (pkgInfo as any).version;
            } else {
              name = idParts[0];
              version = idParts[1] || (pkgInfo as any).version;
            }
          } else {
            name = (pkgInfo as any).name;
            version = (pkgInfo as any).version;
          }
        }

        if (!name || !version) continue;

        // Create node for this package
        const isDirect = directDependencies.has(name);
        const depType = isDirect
          ? this.determineDependencyType(lockData, name)
          : 'transitive';

        const node: DependencyNode = {
          name,
          version,
          dependencies: new Map(),
          isVulnerable: false, // Will be populated later
          vulnerabilityCount: 0,
          isOutdated: false, // Will be populated later
          depth: isDirect ? 1 : 2,
          dependencyType: depType,
        };

        if (isDirect) {
          rootNodes.push(node);
        }

        packageCache.set(`${name}@${version}`, node);
      }

      // Connect dependencies
      for (const [pkgPath, pkgInfo] of Object.entries(lockData.packages)) {
        if (pkgPath === '') continue;

        let name, version;

        if (pkgPath.startsWith('node_modules/')) {
          const parts = pkgPath.split('/');
          name = parts[1].startsWith('@')
            ? `${parts[1]}/${parts[2]}`
            : parts[1];
          version = (pkgInfo as any).version;
        } else {
          const pkgId = pkgPath as string;
          const idParts = pkgId.split('@');

          if (idParts.length >= 2) {
            if (pkgId.startsWith('@')) {
              const scopeParts = pkgId.substring(1).split('@');
              name = `@${scopeParts[0]}`;
              version = scopeParts[1] || (pkgInfo as any).version;
            } else {
              name = idParts[0];
              version = idParts[1] || (pkgInfo as any).version;
            }
          } else {
            name = (pkgInfo as any).name;
            version = (pkgInfo as any).version;
          }
        }

        if (!name || !version) continue;

        // Get node for this package
        const node = packageCache.get(`${name}@${version}`);
        if (!node) continue;

        // Connect dependencies
        if ((pkgInfo as any).dependencies) {
          for (const [depName, depVersionRange] of Object.entries(
            (pkgInfo as any).dependencies
          )) {
            // Find the actual version used for this dependency
            const resolvedVersion = this.findResolvedVersion(
              lockData,
              depName,
              depVersionRange as string
            );

            if (resolvedVersion) {
              const depNode = packageCache.get(`${depName}@${resolvedVersion}`);
              if (depNode) {
                node.dependencies.set(depName, depNode);
              }
            }
          }
        }
      }
    }
  }

  /**
   * Find the resolved version for a dependency
   */
  private findResolvedVersion(
    lockData: any,
    name: string,
    versionRange: string
  ): string | null {
    // In npm 7+, we look for the entry in the dependencies section
    if (lockData.dependencies && lockData.dependencies[name]) {
      return lockData.dependencies[name].version;
    }

    // Otherwise, try to find in packages
    for (const [pkgPath, pkgInfo] of Object.entries(lockData.packages || {})) {
      if (pkgPath === '') continue;

      const pkgName = this.extractPackageName(pkgPath);
      if (pkgName === name) {
        return (pkgInfo as any).version;
      }
    }

    return null;
  }

  /**
   * Extract package name from a path
   */
  private extractPackageName(pkgPath: string): string {
    if (pkgPath.startsWith('node_modules/')) {
      const parts = pkgPath.split('/');
      return parts[1].startsWith('@') ? `${parts[1]}/${parts[2]}` : parts[1];
    }

    // For other formats
    const pkgId = pkgPath as string;
    if (pkgId.startsWith('@')) {
      return pkgId.split('@')[0];
    }

    return pkgId.split('@')[0];
  }

  /**
   * Parse npm lockfile version 1 (npm 6 and earlier)
   */
  private async parseNpmLockfileV1(
    lockData: any,
    rootNodes: DependencyNode[]
  ): Promise<void> {
    // For npm 6 and earlier, dependencies are nested
    const directDeps = lockData.dependencies || {};

    // Process direct dependencies
    for (const [name, info] of Object.entries(directDeps)) {
      const version = (info as any).version;
      if (!version) continue;

      // Determine dependency type
      const depType = this.determineDependencyType(lockData, name);

      // Create node for direct dependency
      const node: DependencyNode = {
        name,
        version,
        dependencies: new Map(),
        isVulnerable: false, // Will be populated later
        vulnerabilityCount: 0,
        isOutdated: false, // Will be populated later
        depth: 1,
        dependencyType: depType,
      };

      // Process transitive dependencies
      if ((info as any).dependencies) {
        await this.processNpmDependencies(node, (info as any).dependencies, 2);
      }

      rootNodes.push(node);
    }
  }

  /**
   * Process npm dependencies recursively
   */
  private async processNpmDependencies(
    parentNode: DependencyNode,
    dependencies: Record<string, any>,
    depth: number
  ): Promise<void> {
    for (const [name, info] of Object.entries(dependencies)) {
      const version = info.version;
      if (!version) continue;

      // Create node for this dependency
      const node: DependencyNode = {
        name,
        version,
        dependencies: new Map(),
        isVulnerable: false, // Will be populated later
        vulnerabilityCount: 0,
        isOutdated: false, // Will be populated later
        depth,
        dependencyType: 'transitive',
      };

      // Process nested dependencies
      if (info.dependencies) {
        await this.processNpmDependencies(node, info.dependencies, depth + 1);
      }

      // Add to parent's dependencies
      parentNode.dependencies.set(name, node);
    }
  }

  /**
   * Determine if a package is a regular or dev dependency
   */
  private determineDependencyType(lockData: any, name: string): string {
    // Check if it's in devDependencies
    if (
      lockData.packages &&
      lockData.packages[''] &&
      lockData.packages[''].devDependencies &&
      lockData.packages[''].devDependencies[name]
    ) {
      return 'devDependencies';
    }

    // For npm 6 and earlier
    if (lockData.requires && lockData.requires[name]) {
      return 'dependencies';
    }

    // Default to regular dependencies
    return 'dependencies';
  }
}

export const npmLockParserService = new NpmLockParserService();
export default npmLockParserService;
