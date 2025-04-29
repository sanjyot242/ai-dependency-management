import { DependencyNode } from '../types/services/dependency-tree';
import logger from '../utils/logger';

/**
 * Service for parsing npm package-lock.json files to extract dependency trees
 */
export class NpmLockParserService {
  /**
   * Check if the content is a valid lock file
   * @param lockData Parsed lock file data
   * @returns Whether it's a valid lock file
   */
  private isValidLockFile(lockData: any): boolean {
    // Check for lockfileVersion property (most reliable indicator)
    if ('lockfileVersion' in lockData) {
      return true;
    }

    // Check for other lock file indicators
    const hasPackages =
      'packages' in lockData && typeof lockData.packages === 'object';
    const hasDependencies =
      'dependencies' in lockData && typeof lockData.dependencies === 'object';
    const hasRequires =
      'requires' in lockData && typeof lockData.requires === 'object';

    // Check for npm v1 lock file structure
    if (hasDependencies && (hasRequires || 'name' in lockData)) {
      return true;
    }

    // Check for npm v2+ lock file structure
    if (hasPackages) {
      return true;
    }

    return false;
  }

  /**
   * Get or infer lock file version
   * @param lockData Parsed lock file data
   * @returns Lock file version (defaults to 1 if not present)
   */
  private getLockFileVersion(lockData: any): number {
    // If explicitly defined, use that
    if (
      'lockfileVersion' in lockData &&
      typeof lockData.lockfileVersion === 'number'
    ) {
      return lockData.lockfileVersion;
    }

    // Infer based on structure
    if ('packages' in lockData) {
      // npm v7+ uses a flat packages structure
      return 2;
    }

    // Default to v1 for npm v6 and earlier
    return 1;
  }
  /**
   * Parse a package-lock.json file to extract the dependency tree
   * @param lockFileContent Content of package-lock.json
   * @returns Array of root dependency nodes
   */
  public async parseLockFile(
    lockFileContent: string | any
  ): Promise<DependencyNode[]> {
    try {
      // Check if the content is already an object (could happen if it's pre-parsed)
      let lockData;
      if (typeof lockFileContent === 'string') {
        try {
          lockData = JSON.parse(lockFileContent);
        } catch (jsonError) {
          logger.error('Error parsing lock file JSON:', jsonError);

          // Try to debug what's wrong with the content
          if (lockFileContent.startsWith('object')) {
            // Content might already be stringified or an object reference
            logger.error(
              `Invalid JSON content starts with "object". Content type: ${typeof lockFileContent}`
            );
            logger.debug(
              `Content preview: ${lockFileContent.substring(0, 100)}...`
            );
            throw new Error('Invalid JSON content, starts with "object"');
          }

          throw jsonError;
        }
      } else if (typeof lockFileContent === 'object') {
        // Content is already an object
        lockData = lockFileContent;
      } else {
        throw new Error(
          `Unexpected lock file content type: ${typeof lockFileContent}`
        );
      }

      // Check if it's a valid lock file
      if (!this.isValidLockFile(lockData)) {
        logger.warn(`Provided content doesn't appear to be a valid lock file`);
        logger.debug(
          `Lock file content keys: ${Object.keys(lockData).join(', ')}`
        );
        return [];
      }

      // Get or infer lock file version
      const lockfileVersion = this.getLockFileVersion(lockData);
      logger.info(`Processing lock file with version ${lockfileVersion}`);

      const rootNodes: DependencyNode[] = [];

      // Parse based on lockfile version
      if (lockData.lockfileVersion >= 2) {
        // npm 7+ (lockfileVersion 2+)
        await this.parseNpmLockfileV2(lockData, rootNodes);
      } else {
        // npm 6 and earlier (lockfileVersion 1)
        await this.parseNpmLockfileV1(lockData, rootNodes);
      }

      logger.info(
        `Successfully parsed lock file, found ${rootNodes.length} root dependencies`
      );
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

    // Handle case where there's no root package information
    if (directDependencies.size === 0 && lockData.dependencies) {
      Object.keys(lockData.dependencies).forEach((name) => {
        directDependencies.add(name);
      });
    }

    // Log for debugging
    logger.debug(
      `Found ${directDependencies.size} direct dependencies in lock file`
    );

    // Build a cache of all packages
    if (lockData.packages) {
      for (const [pkgPath, pkgInfo] of Object.entries(lockData.packages)) {
        if (pkgPath === '') continue; // Skip root package

        // Extract name and version from path or package info
        let name, version;

        if (pkgPath.startsWith('node_modules/')) {
          // Extract from path (e.g., node_modules/lodash)
          const parts = pkgPath.split('/');
          if (parts.length < 2) continue;

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

        if (!name || !version) {
          logger.debug(
            `Skipping package with missing name or version: ${pkgPath}`
          );
          continue;
        }

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
          if (parts.length < 2) continue;

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

    // Handle case where no root nodes were found
    if (rootNodes.length === 0 && packageCache.size > 0) {
      logger.warn(
        `No direct dependencies found, but ${packageCache.size} packages in cache. Creating synthetic root nodes.`
      );

      // Find all packages that aren't referenced by others - they might be root nodes
      const referencedPackages = new Set<string>();

      for (const node of packageCache.values()) {
        for (const [depName, depNode] of node.dependencies.entries()) {
          referencedPackages.add(`${depNode.name}@${depNode.version}`);
        }
      }

      // Add unreferenced packages as root nodes
      for (const [key, node] of packageCache.entries()) {
        if (!referencedPackages.has(key)) {
          node.depth = 1;
          node.dependencyType = 'dependencies';
          rootNodes.push(node);
        }
      }

      logger.info(`Added ${rootNodes.length} synthetic root nodes`);
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
      if (parts.length < 2) return '';
      return parts[1].startsWith('@') ? `${parts[1]}/${parts[2]}` : parts[1];
    }

    // For other formats
    const pkgId = pkgPath as string;
    if (pkgId.startsWith('@')) {
      const parts = pkgId.split('@');
      if (parts.length > 0) {
        return `@${parts[1]}`;
      }
      return '';
    }

    const parts = pkgId.split('@');
    return parts[0] || '';
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

    // Log for debugging
    logger.debug(
      `Found ${
        Object.keys(directDeps).length
      } direct dependencies in v1 lock file`
    );

    // Process direct dependencies
    for (const [name, info] of Object.entries(directDeps)) {
      if (!info) {
        logger.debug(`Skipping null/undefined dependency info for ${name}`);
        continue;
      }

      const version = (info as any).version;
      if (!version) {
        logger.debug(`Skipping dependency without version: ${name}`);
        continue;
      }

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
      if (!info) continue;

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
