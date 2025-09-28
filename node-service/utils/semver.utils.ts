// utils/semver.utils.ts
import semver from 'semver';
import logger from './logger';

/**
 * Utility functions for handling semver version strings
 */
export class SemverUtils {
  /**
   * Extract a clean version string from a package.json version range
   * Handles special cases like GitHub URLs, git references, local paths, etc.
   *
   * @param versionRange The version range from package.json
   * @returns A cleaned version string that can be used with semver, or null if it can't be determined
   */
  public static cleanVersion(versionRange: string): string | null {
    try {
      // Handle special version formats
      if (this.isSpecialVersionFormat(versionRange)) {
        return null;
      }

      // Extract basic version number from various formats
      // 1. Remove any leading characters like ^, ~, >=, etc.
      let cleanVersion = versionRange.replace(/^[^0-9]*/, '');

      // 2. Handle ranges - just take the first part
      cleanVersion = cleanVersion.split(' - ')[0].split(' ')[0].split('||')[0];

      // 3. Handle x-ranges: 1.x.x, 1.2.x, etc.
      if (cleanVersion.includes('x')) {
        cleanVersion = cleanVersion.replace(/\.x/g, '.0');
      }

      // 4. Remove any trailing characters or comments
      cleanVersion = cleanVersion.split('#')[0].trim();

      // Validate format
      if (semver.valid(cleanVersion)) {
        return cleanVersion;
      }

      // Try to coerce a valid version
      const coerced = semver.coerce(cleanVersion);
      if (coerced) {
        return coerced.version;
      }

      // If we can't coerce a valid version, log and return null
      logger.warn(`Could not parse version ${versionRange}, returning null`);
      return null;
    } catch (error) {
      logger.error(`Error cleaning version ${versionRange}:`, error);
      return null;
    }
  }

  /**
   * Check if a version string is a special format that can't be handled by semver
   */
  private static isSpecialVersionFormat(version: string): boolean {
    // Check for URLs, git references, and file paths
    return (
      version.includes('://') || // URLs
      version.includes('github:') || // GitHub shorthand
      version.includes('git+') || // Git URLs
      version.includes('git:') || // Git URLs
      version.includes('gitlab:') || // GitLab shorthand
      version.startsWith('file:') || // Local file path
      version.startsWith('/') || // Absolute path
      version.startsWith('./') || // Relative path
      version.startsWith('../') || // Relative path
      version === '*' || // Any version
      version === 'latest' || // Latest version
      version.includes('workspace:') || // Workspace reference
      version.includes('link:') // Linked package
    );
  }

  /**
   * Check if a version is greater than another version
   * Safely handles invalid version strings
   *
   * @param versionA First version to compare
   * @param versionB Second version to compare
   * @returns true if versionA > versionB, false otherwise or if comparison can't be made
   */
  public static isGreaterThan(versionA: string, versionB: string): boolean {
    try {
      const cleanA = this.cleanVersion(versionA);
      const cleanB = this.cleanVersion(versionB);

      // If either version can't be parsed, can't compare
      if (!cleanA || !cleanB) {
        return false;
      }

      return semver.gt(cleanA, cleanB);
    } catch (error) {
      logger.error(
        `Error comparing versions ${versionA} and ${versionB}:`,
        error
      );
      return false;
    }
  }

  /**
   * Get prefix from a version string (^, ~, etc.)
   */
  public static getVersionPrefix(version: string): string {
    if (version.startsWith('^')) return '^';
    if (version.startsWith('~')) return '~';
    if (version.startsWith('>=')) return '>=';
    if (version.startsWith('>')) return '>';
    return '';
  }
}

export default SemverUtils;
