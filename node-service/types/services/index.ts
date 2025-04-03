import { ScanState } from '../models';

/**
 * OSV Service interface definitions
 */
export interface OSVVulnerability {
  id: string;
  summary: string;
  details: string;
  modified: string;
  published: string;
  severity: {
    score: number;
    type: string;
  }[];
  affected: {
    package: {
      name: string;
      ecosystem: string;
    };
    ranges: {
      type: string;
      events: {
        introduced?: string;
        fixed?: string;
      }[];
    }[];
    versions?: string[];
  }[];
  references: {
    type: string;
    url: string;
  }[];
  database_specific?: {
    cwe_ids?: string[];
    severity?: string;
    github_reviewed?: boolean;
  };
  schema_version: string;
}

/**
 * Scan process interfaces
 */
export interface StateInfo {
  currentState: ScanState;
  history: any[];
}

/**
 * Mock dependency interfaces for testing
 */
export interface MockDependency {
  packageName: string;
  currentVersion: string;
}
