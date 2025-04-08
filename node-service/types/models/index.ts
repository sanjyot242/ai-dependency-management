// types/models/index.ts
import { Document, Types } from 'mongoose';

/**
 * Interface for User model
 */
export interface IUser extends Document {
  _id: Types.ObjectId;
  username: string;
  email: string;
  githubId?: string;
  githubToken?: string;
  githubRefreshToken?: string;
  avatarUrl?: string;
  name?: string;
  isOnboarded: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Interface for Repository model
 */
export interface IRepository extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  githubId: string;
  name: string;
  fullName: string;
  description?: string;
  url?: string;
  isPrivate: boolean;
  isRepoSelected: boolean;
  defaultBranch?: string;
  language?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Interface for a vulnerability
 */
export interface IVulnerability {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  description: string;
  references?: string[];
  fixedIn?: string;
}

/**
 * Interface for a dependency
 */
export interface IDependency {
  packageName: string;
  currentVersion: string;
  latestVersion?: string;
  isOutdated: boolean;
  vulnerabilities?: IVulnerability[];
  filePath?: string;
  dependencyType?: string;
}

/**
 * State transition history record
 */
export interface StateTransition {
  state: ScanState;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * Define all possible scan states
 */
export type ScanState =
  | 'initiated'
  | 'dependency-scanning'
  | 'dependencies-scanned'
  | 'vulnerability-scanning'
  | 'vulnerabilities-scanned'
  | 'pr-creation'
  | 'pr-created'
  | 'completed'
  | 'failed';

/**
 * Interface for Scan model
 */
export interface IScan extends Document {
  _id: Types.ObjectId;
  repositoryId: Types.ObjectId;
  userId: Types.ObjectId;

  // Traditional status fields
  status: 'pending' | 'in-progress' | 'completed' | 'failed';

  // State machine fields
  state: ScanState;
  stateHistory: StateTransition[];

  // Options
  includeVulnerabilities: boolean;
  createPR: boolean;

  //new field for trigger type
  triggerType: {
    type: String;
    enum: ['scheduled', 'manual', 'push'];
    default: 'manual';
  };

  branch?: string;
  commit?: string;
  dependencies: IDependency[];
  outdatedCount: number;
  vulnerabilityCount: number;
  highSeverityCount: number;

  // PR information
  prNumber?: number;
  prUrl?: string;

  // Error information
  errorMessage?: string;

  // Timestamps
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Interface for email notification preferences
 */
export interface IEmailNotificationPreferences {
  enabled: boolean;
  vulnerabilities: boolean;
  outdatedDependencies: boolean;
}

/**
 * Interface for Slack notification preferences
 */
export interface ISlackNotificationPreferences {
  enabled: boolean;
  webhookUrl?: string;
  vulnerabilities: boolean;
  outdatedDependencies: boolean;
}

/**
 * Interface for all notification preferences
 */
export interface INotificationPreferences {
  email: IEmailNotificationPreferences;
  slack: ISlackNotificationPreferences;
}

/**
 * Interface for OnboardingConfig model
 */
export interface IOnboardingConfig extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  scanFrequency: 'daily' | 'weekly' | 'monthly';
  notificationPreferences: INotificationPreferences;
  scanVulnerabilities?: boolean;
  autoScanOnPush: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Interface for RiskAnalysis model
 */
export interface IRiskAnalysis extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  repositoryId: Types.ObjectId;
  packageName: string;
  currentVersion: string;
  targetVersion: string;
  riskScore: number;
  breakingChanges: boolean;
  confidenceLevel?: number;
  recommendations: string[];
  aiAnalysisDetails?: any;
  createdAt: Date;
}
