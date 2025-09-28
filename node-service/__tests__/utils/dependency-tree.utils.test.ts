// __tests__/utils/dependency-tree.utils.test.ts

import IterativeDependencyTraverser from '../../utils/dependency-tree.utils';
import { DependencyNode } from '../../types/services/dependency-tree';
import { configUtils } from '../../utils/config.utils';

describe('IterativeDependencyTraverser', () => {
  let traverser: IterativeDependencyTraverser;

  beforeEach(() => {
    traverser = new IterativeDependencyTraverser();

    // Override config for testing
    configUtils.updateConfig({
      maxDepth: 10,
      maxNodes: 1000,
      maxProcessingTimeMs: 60000, // 60 seconds for tests (minimum allowed)
      maxCircularRefs: 100
    });
  });

  afterEach(() => {
    // Reset config to defaults
    configUtils.updateConfig({
      maxDepth: 50,
      maxNodes: 50000,
      maxProcessingTimeMs: 900000,
      maxCircularRefs: 10000
    });
  });

  describe('collectAllPackages', () => {
    it('should handle empty dependency tree', () => {
      const nodes: DependencyNode[] = [];
      const result = traverser.collectAllPackages(nodes);

      expect(result).toEqual([]);
      expect(traverser.getMetrics().totalNodes).toBe(0);
    });

    it('should collect packages from simple dependency tree', () => {
      const nodes: DependencyNode[] = [
        {
          name: 'package-a',
          version: '1.0.0',
          dependencies: new Map([
            ['package-b', {
              name: 'package-b',
              version: '2.0.0',
              dependencies: new Map(),
              isVulnerable: false,
              vulnerabilityCount: 0,
              isOutdated: false,
              depth: 2,
              dependencyType: 'transitive'
            }]
          ]),
          isVulnerable: false,
          vulnerabilityCount: 0,
          isOutdated: false,
          depth: 1,
          dependencyType: 'dependencies'
        }
      ];

      const result = traverser.collectAllPackages(nodes);

      expect(result).toHaveLength(2);
      expect(result).toContainEqual(['package-a', '1.0.0']);
      expect(result).toContainEqual(['package-b', '2.0.0']);

      const metrics = traverser.getMetrics();
      expect(metrics.totalNodes).toBe(2);
      expect(metrics.uniquePackages).toBe(2);
      expect(metrics.maxDepth).toBe(2);
    });

    it('should handle circular dependencies without infinite loop', () => {
      // Create circular dependency: A -> B -> A
      const nodeB: DependencyNode = {
        name: 'package-b',
        version: '1.0.0',
        dependencies: new Map(),
        isVulnerable: false,
        vulnerabilityCount: 0,
        isOutdated: false,
        depth: 2,
        dependencyType: 'transitive'
      };

      const nodeA: DependencyNode = {
        name: 'package-a',
        version: '1.0.0',
        dependencies: new Map([['package-b', nodeB]]),
        isVulnerable: false,
        vulnerabilityCount: 0,
        isOutdated: false,
        depth: 1,
        dependencyType: 'dependencies'
      };

      // Create circular reference
      nodeB.dependencies.set('package-a', nodeA);

      const result = traverser.collectAllPackages([nodeA]);

      expect(result).toHaveLength(2);
      expect(traverser.getCircularDependencies().length).toBeGreaterThan(0);

      const metrics = traverser.getMetrics();
      expect(metrics.circularReferences).toBeGreaterThan(0);
    });

    it('should respect depth limits', () => {
      // Create a deep dependency tree
      let currentNode: DependencyNode = {
        name: 'root',
        version: '1.0.0',
        dependencies: new Map(),
        isVulnerable: false,
        vulnerabilityCount: 0,
        isOutdated: false,
        depth: 1,
        dependencyType: 'dependencies'
      };

      const rootNode = currentNode;

      // Create chain of 15 dependencies (exceeds test limit of 10)
      for (let i = 1; i <= 15; i++) {
        const childNode: DependencyNode = {
          name: `package-${i}`,
          version: '1.0.0',
          dependencies: new Map(),
          isVulnerable: false,
          vulnerabilityCount: 0,
          isOutdated: false,
          depth: i + 1,
          dependencyType: 'transitive'
        };

        currentNode.dependencies.set(`package-${i}`, childNode);
        currentNode = childNode;
      }

      const result = traverser.collectAllPackages([rootNode], 10); // Limit to 10 levels

      // Should stop at depth limit, not process all 16 nodes
      expect(result.length).toBeLessThan(16);

      const metrics = traverser.getMetrics();
      expect(metrics.maxDepth).toBeLessThanOrEqual(10);
    });

    it('should handle large number of dependencies efficiently', () => {
      // Create a wide dependency tree (many siblings)
      const dependencies = new Map<string, DependencyNode>();

      for (let i = 0; i < 500; i++) {
        dependencies.set(`package-${i}`, {
          name: `package-${i}`,
          version: '1.0.0',
          dependencies: new Map(),
          isVulnerable: false,
          vulnerabilityCount: 0,
          isOutdated: false,
          depth: 2,
          dependencyType: 'transitive'
        });
      }

      const rootNode: DependencyNode = {
        name: 'root',
        version: '1.0.0',
        dependencies,
        isVulnerable: false,
        vulnerabilityCount: 0,
        isOutdated: false,
        depth: 1,
        dependencyType: 'dependencies'
      };

      const startTime = Date.now();
      const result = traverser.collectAllPackages([rootNode]);
      const endTime = Date.now();

      expect(result).toHaveLength(501); // root + 500 dependencies
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second

      const metrics = traverser.getMetrics();
      expect(metrics.totalNodes).toBe(501);
      expect(metrics.uniquePackages).toBe(501);
    });

    it('should detect memory warnings during processing', () => {
      // This test would need to be configured to trigger memory warnings
      // For now, we'll just verify the memory tracking works
      const nodes: DependencyNode[] = [{
        name: 'test-package',
        version: '1.0.0',
        dependencies: new Map(),
        isVulnerable: false,
        vulnerabilityCount: 0,
        isOutdated: false,
        depth: 1,
        dependencyType: 'dependencies'
      }];

      traverser.collectAllPackages(nodes);

      const metrics = traverser.getMetrics();
      expect(metrics.memoryUsageMB).toBeGreaterThan(0);
    });
  });

  describe('processTreeIteratively', () => {
    it('should process npm-style dependency object iteratively', () => {
      const dependencies = {
        'lodash': {
          version: '4.17.21',
          dependencies: {
            'lodash.debounce': {
              version: '4.0.8'
            }
          }
        },
        'express': {
          version: '4.18.2',
          dependencies: {
            'accepts': {
              version: '1.3.8'
            }
          }
        }
      };

      const result = traverser.processTreeIteratively(dependencies);

      expect(result.size).toBeGreaterThan(0);
      expect(result.has('lodash@4.17.21')).toBe(true);
      expect(result.has('express@4.18.2')).toBe(true);
    });

    it('should respect node limits', () => {
      const largeDependencies: Record<string, any> = {};

      // Create more dependencies than the test limit
      for (let i = 0; i < 1500; i++) {
        largeDependencies[`package-${i}`] = {
          version: '1.0.0'
        };
      }

      const result = traverser.processTreeIteratively(largeDependencies, 1000);

      // Should respect the 1000 node limit
      expect(result.size).toBeLessThanOrEqual(1000);
    });
  });

  describe('detectCycles', () => {
    it('should detect simple circular dependency', () => {
      const nodeB: DependencyNode = {
        name: 'package-b',
        version: '1.0.0',
        dependencies: new Map(),
        isVulnerable: false,
        vulnerabilityCount: 0,
        isOutdated: false,
        depth: 2,
        dependencyType: 'transitive'
      };

      const nodeA: DependencyNode = {
        name: 'package-a',
        version: '1.0.0',
        dependencies: new Map([['package-b', nodeB]]),
        isVulnerable: false,
        vulnerabilityCount: 0,
        isOutdated: false,
        depth: 1,
        dependencyType: 'dependencies'
      };

      // Create circular reference
      nodeB.dependencies.set('package-a', nodeA);

      const cycles = IterativeDependencyTraverser.detectCycles([nodeA]);

      expect(cycles.length).toBeGreaterThan(0);
      expect(cycles[0]).toContain('package-a');
      expect(cycles[0]).toContain('package-b');
    });

    it('should not detect cycles in acyclic graph', () => {
      const nodeC: DependencyNode = {
        name: 'package-c',
        version: '1.0.0',
        dependencies: new Map(),
        isVulnerable: false,
        vulnerabilityCount: 0,
        isOutdated: false,
        depth: 3,
        dependencyType: 'transitive'
      };

      const nodeB: DependencyNode = {
        name: 'package-b',
        version: '1.0.0',
        dependencies: new Map([['package-c', nodeC]]),
        isVulnerable: false,
        vulnerabilityCount: 0,
        isOutdated: false,
        depth: 2,
        dependencyType: 'transitive'
      };

      const nodeA: DependencyNode = {
        name: 'package-a',
        version: '1.0.0',
        dependencies: new Map([['package-b', nodeB]]),
        isVulnerable: false,
        vulnerabilityCount: 0,
        isOutdated: false,
        depth: 1,
        dependencyType: 'dependencies'
      };

      const cycles = IterativeDependencyTraverser.detectCycles([nodeA]);

      expect(cycles).toHaveLength(0);
    });
  });

  describe('performance metrics', () => {
    it('should track processing time accurately', () => {
      const nodes: DependencyNode[] = [{
        name: 'test-package',
        version: '1.0.0',
        dependencies: new Map(),
        isVulnerable: false,
        vulnerabilityCount: 0,
        isOutdated: false,
        depth: 1,
        dependencyType: 'dependencies'
      }];

      traverser.collectAllPackages(nodes);

      const metrics = traverser.getMetrics();
      expect(metrics.processingTimeMs).toBeGreaterThanOrEqual(0);
      expect(metrics.processingTimeMs).toBeLessThan(1000); // Should be fast for simple case
    });

    it('should provide complete metrics', () => {
      const nodes: DependencyNode[] = [{
        name: 'test-package',
        version: '1.0.0',
        dependencies: new Map(),
        isVulnerable: false,
        vulnerabilityCount: 0,
        isOutdated: false,
        depth: 1,
        dependencyType: 'dependencies'
      }];

      traverser.collectAllPackages(nodes);

      const metrics = traverser.getMetrics();

      expect(metrics).toHaveProperty('totalNodes');
      expect(metrics).toHaveProperty('uniquePackages');
      expect(metrics).toHaveProperty('maxDepth');
      expect(metrics).toHaveProperty('circularReferences');
      expect(metrics).toHaveProperty('processingTimeMs');
      expect(metrics).toHaveProperty('memoryUsageMB');
      expect(metrics).toHaveProperty('warningsCount');
      expect(metrics).toHaveProperty('errorsCount');
    });
  });
});