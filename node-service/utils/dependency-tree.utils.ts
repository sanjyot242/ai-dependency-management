// utils/dependency-tree.utils.ts

import { DependencyNode } from '../types/services/dependency-tree';
import logger from './logger';
import { configUtils } from './config.utils';

/**
 * Performance limits and thresholds (now using configuration service)
 */
export const DEPENDENCY_LIMITS = {
  get MAX_DEPTH() {
    return configUtils.get('maxDepth');
  },
  get MAX_NODES() {
    return configUtils.get('maxNodes');
  },
  get MAX_PROCESSING_TIME() {
    return configUtils.get('maxProcessingTimeMs');
  },
  get MAX_CIRCULAR_REFERENCES() {
    return configUtils.get('maxCircularRefs');
  },
  get MEMORY_CHECK_INTERVAL() {
    return configUtils.get('memoryCheckInterval');
  },
} as const;

/**
 * Performance metrics for monitoring
 */
export interface DependencyProcessingMetrics {
  totalNodes: number;
  uniquePackages: number;
  maxDepth: number;
  circularReferences: number;
  processingTimeMs: number;
  memoryUsageMB: number;
  warningsCount: number;
  errorsCount: number;
}

/**
 * Iterative dependency tree traversal utility
 * Replaces recursive approaches to prevent call stack overflow
 */
export class IterativeDependencyTraverser {
  private visitedNodes = new Set<string>();
  private circularDependencies = new Set<string>();
  private metrics: DependencyProcessingMetrics = {
    totalNodes: 0,
    uniquePackages: 0,
    maxDepth: 0,
    circularReferences: 0,
    processingTimeMs: 0,
    memoryUsageMB: 0,
    warningsCount: 0,
    errorsCount: 0
  };
  private startTime: number = Date.now();

  constructor() {
    this.resetMetrics();
    this.startTime = Date.now();
  }

  /**
   * Collect all unique packages from dependency trees using iterative approach
   * @param nodes Root dependency nodes
   * @param maxDepth Maximum traversal depth (default: 50)
   * @param maxNodes Maximum total nodes to process (default: 50000)
   * @returns Array of [packageName, version] tuples
   */
  public collectAllPackages(
    nodes: DependencyNode[],
    maxDepth = DEPENDENCY_LIMITS.MAX_DEPTH,
    maxNodes = DEPENDENCY_LIMITS.MAX_NODES
  ): Array<[string, string]> {
    this.resetMetrics();
    const packages = new Set<string>();
    const result: Array<[string, string]> = [];

    // Use stack for iterative traversal
    const stack: Array<{
      node: DependencyNode;
      depth: number;
      path: string[];
    }> = [];

    // Initialize stack with root nodes
    nodes.forEach((node, index) => {
      stack.push({
        node,
        depth: 1,
        path: [`root-${index}`],
      });
    });

    let processedCount = 0;
    const processStartTime = Date.now();

    while (stack.length > 0 && processedCount < maxNodes) {
      // Check processing time limit
      if (
        Date.now() - processStartTime >
        DEPENDENCY_LIMITS.MAX_PROCESSING_TIME
      ) {
        logger.warn(
          `Dependency traversal timeout after ${DEPENDENCY_LIMITS.MAX_PROCESSING_TIME}ms`
        );
        this.metrics.errorsCount++;
        break;
      }

      // Memory check every N nodes
      if (processedCount % DEPENDENCY_LIMITS.MEMORY_CHECK_INTERVAL === 0) {
        this.checkMemoryUsage();
      }

      const { node, depth, path } = stack.pop()!;
      const nodeKey = `${node.name}@${node.version}`;
      const currentPath = [...path, nodeKey];

      processedCount++;
      this.metrics.totalNodes++;
      this.metrics.maxDepth = Math.max(this.metrics.maxDepth, depth);

      // Check for circular dependencies
      if (this.visitedNodes.has(nodeKey)) {
        if (path.includes(nodeKey)) {
          // This is a circular dependency
          const circularPath = currentPath.join(' → ');
          this.circularDependencies.add(circularPath);
          this.metrics.circularReferences++;

          if (
            this.metrics.circularReferences >
            DEPENDENCY_LIMITS.MAX_CIRCULAR_REFERENCES
          ) {
            logger.warn(
              `Too many circular dependencies detected (${this.metrics.circularReferences}), stopping traversal`
            );
            this.metrics.errorsCount++;
            break;
          }

          logger.debug(`Circular dependency detected: ${circularPath}`);
          continue;
        }
        // Already processed this node in a different path, skip
        continue;
      }

      // Mark as visited
      this.visitedNodes.add(nodeKey);

      // Add to unique packages if not seen before
      if (!packages.has(nodeKey)) {
        packages.add(nodeKey);
        result.push([node.name, node.version]);
        this.metrics.uniquePackages++;
      }

      // Add children to stack if depth limit not exceeded
      if (depth < maxDepth) {
        for (const [, childNode] of node.dependencies.entries()) {
          stack.push({
            node: childNode,
            depth: depth + 1,
            path: currentPath,
          });
        }
      } else if (node.dependencies.size > 0) {
        logger.debug(
          `Depth limit ${maxDepth} reached for ${nodeKey}, skipping ${node.dependencies.size} children`
        );
        this.metrics.warningsCount++;
      }
    }

    this.metrics.processingTimeMs = Date.now() - processStartTime;

    // Log final metrics
    logger.info('Dependency traversal completed:', {
      totalNodes: this.metrics.totalNodes,
      uniquePackages: this.metrics.uniquePackages,
      maxDepth: this.metrics.maxDepth,
      circularReferences: this.metrics.circularReferences,
      processingTimeMs: this.metrics.processingTimeMs,
      memoryUsageMB: this.metrics.memoryUsageMB,
      warningsCount: this.metrics.warningsCount,
      errorsCount: this.metrics.errorsCount,
    });

    return result;
  }

  /**
   * Process dependency tree using queue-based breadth-first approach
   * @param lockData Lock file data
   * @param maxNodes Maximum nodes to process
   * @returns Processed dependency nodes
   */
  public processTreeIteratively(
    dependencies: Record<string, any>,
    maxNodes = DEPENDENCY_LIMITS.MAX_NODES,
    startDepth = 1
  ): Map<string, DependencyNode> {
    const nodeMap = new Map<string, DependencyNode>();
    const queue: Array<{
      name: string;
      info: any;
      depth: number;
      parentKey?: string;
    }> = [];

    // Initialize queue with direct dependencies
    Object.entries(dependencies).forEach(([name, info]) => {
      if (info && info.version) {
        queue.push({ name, info, depth: startDepth });
      }
    });

    let processedCount = 0;
    const processStartTime = Date.now();

    while (queue.length > 0 && processedCount < maxNodes) {
      // Check processing time limit
      if (
        Date.now() - processStartTime >
        DEPENDENCY_LIMITS.MAX_PROCESSING_TIME
      ) {
        logger.warn(
          `Tree processing timeout after ${DEPENDENCY_LIMITS.MAX_PROCESSING_TIME}ms`
        );
        break;
      }

      const { name, info, depth, parentKey } = queue.shift()!;
      const nodeKey = `${name}@${info.version}`;

      processedCount++;

      // Skip if already processed
      if (nodeMap.has(nodeKey)) {
        continue;
      }

      // Create dependency node
      const node: DependencyNode = {
        name,
        version: info.version,
        dependencies: new Map(),
        isVulnerable: false,
        vulnerabilityCount: 0,
        isOutdated: false,
        depth,
        dependencyType: depth === 1 ? 'dependencies' : 'transitive',
      };

      nodeMap.set(nodeKey, node);

      // Add to parent's dependencies if applicable
      if (parentKey && nodeMap.has(parentKey)) {
        const parentNode = nodeMap.get(parentKey)!;
        parentNode.dependencies.set(name, node);
      }

      // Add children to queue if within depth limit
      if (info.dependencies && depth < DEPENDENCY_LIMITS.MAX_DEPTH) {
        Object.entries(info.dependencies).forEach(([childName, childInfo]) => {
          if (childInfo && (childInfo as any).version) {
            queue.push({
              name: childName,
              info: childInfo,
              depth: depth + 1,
              parentKey: nodeKey,
            });
          }
        });
      }
    }

    logger.info(
      `Processed ${processedCount} nodes iteratively in ${
        Date.now() - processStartTime
      }ms`
    );
    return nodeMap;
  }

  /**
   * Get processing metrics
   */
  public getMetrics(): DependencyProcessingMetrics {
    return { ...this.metrics };
  }

  /**
   * Get circular dependency paths
   */
  public getCircularDependencies(): string[] {
    return Array.from(this.circularDependencies);
  }

  /**
   * Reset metrics for new processing
   */
  private resetMetrics(): void {
    this.visitedNodes.clear();
    this.circularDependencies.clear();
    this.metrics = {
      totalNodes: 0,
      uniquePackages: 0,
      maxDepth: 0,
      circularReferences: 0,
      processingTimeMs: 0,
      memoryUsageMB: 0,
      warningsCount: 0,
      errorsCount: 0,
    };
  }

  /**
   * Check memory usage and warn if approaching limits (using configuration)
   */
  private checkMemoryUsage(): void {
    const memoryInfo = configUtils.getMemoryInfo();
    this.metrics.memoryUsageMB = memoryInfo.heapUsedMB;

    // Warn based on configured thresholds
    if (memoryInfo.isCritical) {
      logger.error(`Critical memory usage: ${memoryInfo.heapUsedMB}MB - process may crash soon`);
      this.metrics.errorsCount++;
    } else if (memoryInfo.isWarning) {
      logger.warn(`High memory usage: ${memoryInfo.heapUsedMB}MB - consider reducing scope`);
      this.metrics.warningsCount++;
    }

    // Log memory info if debug metrics enabled
    if (configUtils.get('enableDebugMetrics')) {
      logger.debug(`Memory usage: ${memoryInfo.heapUsedMB}MB / ${memoryInfo.heapTotalMB}MB`);
    }
  }

  /**
   * Utility to detect dependency cycles in a more focused way
   */
  public static detectCycles(nodes: DependencyNode[]): string[] {
    const cycles: string[] = [];
    const visiting = new Set<string>();
    const visited = new Set<string>();

    const dfs = (node: DependencyNode, path: string[]): void => {
      const nodeKey = `${node.name}@${node.version}`;

      if (visiting.has(nodeKey)) {
        // Found a cycle
        const cycleStart = path.indexOf(nodeKey);
        const cycle = path.slice(cycleStart).concat(nodeKey).join(' → ');
        cycles.push(cycle);
        return;
      }

      if (visited.has(nodeKey)) {
        return;
      }

      visiting.add(nodeKey);
      const newPath = [...path, nodeKey];

      for (const [_depName, childNode] of node.dependencies.entries()) {
        dfs(childNode, newPath);
      }

      visiting.delete(nodeKey);
      visited.add(nodeKey);
    };

    nodes.forEach((node) => {
      const nodeKey = `${node.name}@${node.version}`;
      if (!visited.has(nodeKey)) {
        dfs(node, []);
      }
    });

    return cycles;
  }
}

export default IterativeDependencyTraverser;
