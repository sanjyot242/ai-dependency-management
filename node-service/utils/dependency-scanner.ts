// utils/dependency-scanner.ts
import axios from 'axios';
import { updateScanStatus, updateScanResults } from '../services/scan.service';
import { IDependency, IVulnerability } from '../models/Scan';

/**
 * Simple utility to scan dependencies in a repository
 * In a real application, this would be more sophisticated and integrated with GitHub API
 * to fetch actual package.json files and analyze them.
 */

// Sample vulnerability database (in a real application, this would be a call to a security API)
interface VulnerabilityRecord {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  description: string;
  references: string[];
  fixedIn: string;
}

interface VulnerabilityDatabase {
  [packageName: string]: {
    [version: string]: VulnerabilityRecord[];
  };
}

const vulnerabilityDatabase: VulnerabilityDatabase = {
  axios: {
    '0.21.4': [
      {
        id: 'CVE-2023-45857',
        severity: 'high',
        description: 'Axios vulnerable to Reflected Cross-Site Scripting',
        references: ['https://nvd.nist.gov/vuln/detail/CVE-2023-45857'],
        fixedIn: '1.3.2',
      },
    ],
  },
  lodash: {
    '4.17.15': [
      {
        id: 'CVE-2021-23337',
        severity: 'high',
        description: 'Prototype Pollution in Lodash',
        references: ['https://nvd.nist.gov/vuln/detail/CVE-2021-23337'],
        fixedIn: '4.17.21',
      },
    ],
  },
  react: {
    '16.13.1': [],
    '17.0.2': [],
  },
  express: {
    '4.17.1': [],
  },
};

/**
 * Check if a package has vulnerabilities
 * @param packageName - The name of the package
 * @param version - The version of the package
 * @returns Array of vulnerabilities
 */
const checkVulnerabilities = (
  packageName: string,
  version: string
): IVulnerability[] => {
  if (
    vulnerabilityDatabase[packageName] &&
    vulnerabilityDatabase[packageName][version]
  ) {
    return vulnerabilityDatabase[packageName][version];
  }
  return [];
};

/**
 * Get the latest version of a package from npm
 * @param packageName - The name of the package
 * @returns The latest version
 */
const getLatestVersion = async (
  packageName: string
): Promise<string | null> => {
  try {
    const response = await axios.get(
      `https://registry.npmjs.org/${packageName}/latest`
    );
    return response.data.version;
  } catch (error) {
    console.error(`Error fetching latest version for ${packageName}:`, error);
    return null;
  }
};

interface MockDependency {
  packageName: string;
  currentVersion: string;
}

/**
 * Scan dependencies in a repository
 * @param scanId - The ID of the scan
 * @param repoId - The ID of the repository
 * @param branch - The branch to scan (optional)
 */
export const scanRepositoryDependencies = async (
  scanId: string,
  repoId: string,
  branch: string = 'main'
): Promise<IDependency[]> => {
  try {
    // Update scan status to in-progress
    await updateScanStatus(scanId, 'in-progress', { branch });

    // In a real application, you would:
    // 1. Clone or fetch the repository
    // 2. Read package.json and/or other dependency files
    // 3. Parse and extract the dependencies

    // For this example, we'll use mock data
    const mockDependencies: MockDependency[] = [
      { packageName: 'react', currentVersion: '17.0.2' },
      { packageName: 'axios', currentVersion: '0.21.4' },
      { packageName: 'lodash', currentVersion: '4.17.15' },
      { packageName: 'express', currentVersion: '4.17.1' },
    ];

    // Process each dependency
    const processedDependencies = await Promise.all(
      mockDependencies.map(async (dep) => {
        // Get latest version
        const latestVersion = await getLatestVersion(dep.packageName);

        // Check for vulnerabilities
        const vulnerabilities = checkVulnerabilities(
          dep.packageName,
          dep.currentVersion
        );

        // Check if outdated
        const isOutdated =
          latestVersion !== null && dep.currentVersion !== latestVersion;

        return {
          packageName: dep.packageName,
          currentVersion: dep.currentVersion,
          latestVersion: latestVersion || undefined,
          isOutdated: isOutdated || false,
          vulnerabilities:
            vulnerabilities.length > 0 ? vulnerabilities : undefined,
        } as IDependency;
      })
    );

    // Update scan with results
    await updateScanResults(scanId, processedDependencies);

    return processedDependencies;
  } catch (error) {
    console.error(`Error scanning repository (${repoId}):`, error);

    // Update scan status to failed
    await updateScanStatus(scanId, 'failed', {
      errorMessage:
        error instanceof Error ? error.message : 'Unknown error during scan',
    });

    throw error;
  }
};

// For production use, you would implement a job queue system for scans
// Example using Bull queue (you would need to install and set up Redis)
/*
import Queue from 'bull';
import { scanRepositoryDependencies } from './dependency-scanner';

// Create a queue
const scanQueue = new Queue('dependency-scans', 'redis://localhost:6379');

// Process jobs
scanQueue.process(async (job) => {
  const { scanId, repoId, branch } = job.data;
  await scanRepositoryDependencies(scanId, repoId, branch);
  return { success: true };
});

// Add job to queue
export const queueDependencyScan = async (
  scanId: string, 
  repoId: string, 
  branch: string = 'main'
): Promise<any> => {
  return await scanQueue.add(
    { scanId, repoId, branch },
    { 
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000
      }
    }
  );
};
*/

export default {
  scanRepositoryDependencies,
};
