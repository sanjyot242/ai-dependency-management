/**
 * Message for triggering a dependency scan on a repository
 */
export interface ScanRepositoryMessage {
  scanId: string;
  repositoryId: string;
  userId: string;
  includeVulnerabilities?: boolean;
  initiatedAt?: Date;
}

/**
 * Message for triggering a vulnerability scan on dependencies
 */
export interface VulnerabilityScanMessage {
  scanId: string;
  userId: string;
  options?: {
    quickScan?: boolean;
    excludeDevDependencies?: boolean;
    excludeHighRiskOnly?: boolean;
    batchSize?: number;
  };
}

/**
 * Message for creating a PR for updates
 */
export interface CreatePRMessage {
  scanId: string;
  repositoryId: string;
  userId: string;
}

/**
 * Message sent when a scan is completed or failed
 */
export interface ScanCompleteMessage {
  scanId: string;
  repositoryId: string;
  userId: string;
  status: 'completed' | 'failed';
  scanType: string;
  completedAt: Date;
  outdatedCount?: number;
  vulnerabilityCount?: number;
  highSeverityCount?: number;
  error?: string;
}

/**
 * Message for scheduled scanning
 */
export interface ScheduledScanMessage {
  userId: string;
  repositoryIds: string[];
  includeVulnerabilities: boolean;
  scheduledAt: Date;
}

/**
 * Message for WebSocket notifications
 */
export interface WebSocketNotificationMessage {
  type: 'scan_complete' | 'pr_created' | 'test_message';
  data: any;
}
