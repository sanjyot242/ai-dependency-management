// api.ts

import axios from 'axios';

const API_URL = 'http://localhost:3001/api';

// Create axios instance with credentials
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Important for cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

// Repository types
interface RepositoryData {
  id: string;
}

interface RepositorySummary {
  id: string;
  name: string;
  fullName: string;
  description?: string;
  url?: string;
  isPrivate: boolean;
  language?: string;
  isRepoSelected: boolean;
}

// Config types
interface NotificationConfig {
  email?: {
    enabled?: boolean;
    vulnerabilities?: boolean;
    outdatedDependencies?: boolean;
  };
  slack?: {
    enabled?: boolean;
    webhookUrl?: string;
    vulnerabilities?: boolean;
    outdatedDependencies?: boolean;
  };
}

interface ConfigData {
  scanFrequency?: 'daily' | 'weekly' | 'monthly';
  notificationPreferences?: NotificationConfig;
  autoScanOnPush?: boolean;
}

// User type
interface User {
  id: string;
  name?: string;
  username: string;
  email?: string;
  avatarUrl?: string;
  isOnboarded: boolean;
}

// Onboarding status type
interface OnboardingStatus {
  isOnboarded: boolean;
  hasSelectedRepositories: boolean;
  hasConfig: boolean;
  scanStarted: boolean;
}

// Transitive Dependency Information
interface TransitiveDependencyInfo {
  count: number;
  vulnerableCount: number;
  outdatedCount: number;
  maxDepth: number;
  analyzed: boolean;
  storageType: 'embedded' | 'external';
  tree?: any; // Optional serialized dependency tree
}

// Vulnerability interface
interface Vulnerability {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  description: string;
  references?: string[];
  fixedIn?: string;
}

// State transition history
interface StateTransition {
  state: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

// Scan types
interface Dependency {
  packageName: string;
  currentVersion: string;
  latestVersion?: string;
  isOutdated: boolean;
  vulnerabilities?: Vulnerability[];
  filePath?: string;
  dependencyType?: 'dependencies' | 'devDependencies' | 'peerDependencies';
  // Transitive dependency information
  transitiveDependencies?: TransitiveDependencyInfo;
}

interface ScanResult {
  id: string;
  repositoryId: string;
  userId: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  // State machine fields
  state: string;
  stateHistory: StateTransition[];
  // Scan options
  includeVulnerabilities: boolean;
  createPR: boolean;
  triggerType: 'scheduled' | 'manual' | 'push';
  branch?: string;
  commit?: string;
  // Dependencies and counts
  dependencies: Dependency[];
  outdatedCount: number;
  vulnerabilityCount: number;
  highSeverityCount: number;
  // PR information
  prNumber?: number;
  prUrl?: string;
  // Error information
  errorMessage?: string;
  // Transitive dependency aggregate statistics
  transitiveDependenciesStatus?: 'not_started' | 'in_progress' | 'completed' | 'failed';
  transitiveDependencyCount?: number;
  vulnerableTransitiveDependencyCount?: number;
  outdatedTransitiveDependencyCount?: number;
  maxTransitiveDependencyDepth?: number;
  transitiveDependencyFallbackMethod?: 'lockfile' | 'api' | null;
  // Timestamps
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

interface ScanHistory {
  id: string;
  repositoryId: string;
  outdatedCount: number;
  vulnerabilityCount: number;
  highSeverityCount: number;
  startedAt?: string;
  completedAt?: string;
}

const apiClient = {
  // Repository endpoints
  getGithubRepositories: async () => {
    return api.get('/repositories/github');
  },

  getUserRepositories: async (selectedOnly = false) => {
    return api.get('/repositories', { params: { selectedOnly } });
  },

  saveSelectedRepositories: async (repositories: string[]) => {
    return api.post('/repositories/selection', { repositories });
  },

  // Onboarding endpoints
  saveConfiguration: async (config: ConfigData) => {
    return api.post('/onboarding/config', { config });
  },

  getOnboardingConfig: async () => {
    return api.get('/onboarding/config');
  },

  getOnboardingStatus: async () => {
    return api.get('/onboarding/status');
  },

  // Scan endpoints
  initiateRepositoryScan: async (repoId: string) => {
    return api.post('/dependencies/scan', { repoId });
  },

  getLatestRepositoryScan: async (repoId: string) => {
    return api.get(`/dependencies/repo/${repoId}/latest-scan`);
  },

  getScanHistory: async (repoId: string, limit = 10) => {
    return api.get(`/dependencies/repo/${repoId}/history`, {
      params: { limit },
    });
  },

  getRepositoryVulnerabilities: async (repoId: string) => {
    return api.get(`/dependencies/repo/${repoId}/vulnerabilities`);
  },

  getCurrentRepositoryScan(repoId: string) {
    console.log('apiClient.getCurrentRepositoryScan');
    return api.get(`/dependencies/repo/${repoId}/current-scan`);
  },

  analyzeUpdateRisk: async (
    repoId: string,
    packageName: string,
    currentVersion: string,
    newVersion: string
  ) => {
    return api.post('/dependencies/analyze-risk', {
      repoId,
      packageName,
      currentVersion,
      newVersion,
    });
  },

  initiateVulnerabilityScan: async (scanId: string, options = {}) => {
    return api.post('/vulnerabilities/scan', {
      scanId,
      ...options,
    });
  },

  // Get vulnerability summary for a scan
  getVulnerabilitySummary: async (scanId: string) => {
    return api.get(`/vulnerabilities/summary/${scanId}`);
  },

  // Get detailed vulnerabilities for a specific package
  getDependencyVulnerabilities: async (scanId: string, packageName: string) => {
    return api.get(`/vulnerabilities/dependency/${scanId}/${packageName}`);
  },
};

// Export types for use in components
export type {
  TransitiveDependencyInfo,
  Vulnerability,
  StateTransition,
  Dependency,
  ScanResult,
  ScanHistory,
  RepositoryData,
  RepositorySummary,
  NotificationConfig,
  ConfigData,
  User,
  OnboardingStatus,
};

export default apiClient;
