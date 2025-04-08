// types/dto/index.ts
import { Types } from 'mongoose';
import { INotificationPreferences } from '../models';

/**
 * GitHub related interfaces
 */
export interface GithubUserData {
  id: number;
  login: string;
  name?: string;
  email?: string;
  avatar_url?: string;
}

export interface GithubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  private: boolean;
  default_branch: string;
  language: string | null;
}

export interface GithubFile {
  path: string;
  type: string;
  url?: string;
  download_url?: string;
}

export interface GithubContent {
  name: string;
  path: string;
  sha: string;
  content: string;
  encoding: string;
}

export interface GithubBranch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
}

export interface GithubPullRequest {
  html_url: string;
  number: number;
  title: string;
}

/**
 * Auth related interfaces
 */
export interface JwtPayload {
  githubToken: any;
  id: string;
  username: string;
  githubId?: string;
  iat?: number;
  exp?: number;
}

export interface StateStore {
  [key: string]: {
    redirectUri: string;
    expiresAt: number;
  };
}

/**
 * API Request/Response interfaces
 */
export interface CreatePRRequestBody {
  scanId: string;
  repoId: string;
}

export interface OnboardingConfigInput {
  scanFrequency?: 'daily' | 'weekly' | 'monthly';
  scanVulnerabilities?: boolean;
  notificationPreferences?: Partial<INotificationPreferences>;
  autoScanOnPush?: boolean;
}

export interface OnboardingStatus {
  isOnboarded: boolean;
  hasSelectedRepositories: boolean;
  hasConfig: boolean;
  scanStarted: boolean;
}

export interface ScanStatusUpdateData {
  startedAt?: Date;
  completedAt?: Date;
  branch?: string;
  commit?: string;
  errorMessage?: string;
}

export interface VulnerabilitiesResult {
  scanId: Types.ObjectId;
  scannedAt: Date;
  vulnerableDependencies: any[];
  totalVulnerabilities: number;
}

export interface RiskAnalysisData {
  packageName: string;
  currentVersion: string;
  targetVersion: string;
  riskScore: number;
  breakingChanges: boolean;
  confidenceLevel?: number;
  recommendations: string[];
  aiAnalysisDetails?: any;
}

export interface VulnerabilityScanOptions {
  quickScan?: boolean; // If true, use heuristics for a faster scan with less accuracy
  excludeDevDependencies?: boolean; // If true, don't scan dev dependencies
  excludeHighRiskOnly?: boolean; // If true, only flag high/critical vulnerabilities
  batchSize?: number; // Number of packages to check in a single batch request
}

export interface PackageJson {
  name: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

export interface WebhookConfig {
  url: string;
  content_type: string;
  secret: string;
  events: string[];
}
