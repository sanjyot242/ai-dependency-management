// types/dependency-tree.ts

/**
 * Dependency tree node
 */
export interface DependencyNode {
  name: string;
  version: string;
  dependencies: Map<string, DependencyNode>;
  isVulnerable: boolean;
  vulnerabilityCount: number;
  isOutdated: boolean;
  latestVersion?: string;
  filePath?: string;
  dependencyType?: string;
  depth: number;
}

/**
 * Serialized dependency tree node (for storage)
 */
export interface SerializedDependencyNode {
  name: string;
  version: string;
  dependencies: Record<string, SerializedDependencyNode>;
  isVulnerable: boolean;
  vulnerabilityCount: number;
  isOutdated: boolean;
  latestVersion?: string;
  depth: number;
  dependencyType?: string;
}
