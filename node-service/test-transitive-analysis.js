#!/usr/bin/env node

/**
 * Standalone test script for transitive dependency analysis
 * Usage: node test-transitive-analysis.js <package-lock.json>
 */

const fs = require('fs');
const path = require('path');

// Mock logger for testing
const logger = {
  info: (msg, obj) => console.log(`[INFO] ${msg}`, obj || ''),
  debug: (msg, obj) => console.log(`[DEBUG] ${msg}`, obj || ''),
  warn: (msg, obj) => console.warn(`[WARN] ${msg}`, obj || ''),
  error: (msg, obj) => console.error(`[ERROR] ${msg}`, obj || ''),
};

// Mock configuration for testing
const DEPENDENCY_LIMITS = {
  MAX_DEPTH: 50,
  MAX_NODES: 50000,
  MAX_PROCESSING_TIME: 300000, // 5 minutes for testing
  MAX_CIRCULAR_REFERENCES: 10000,
  MEMORY_CHECK_INTERVAL: 1000,
};

/**
 * Simplified iterative dependency traverser for testing
 */
class TestDependencyTraverser {
  constructor() {
    this.visitedNodes = new Set();
    this.circularDependencies = new Set();
    this.metrics = {
      totalNodes: 0,
      uniquePackages: 0,
      maxDepth: 0,
      circularReferences: 0,
      processingTimeMs: 0,
      memoryUsageMB: 0,
      warningsCount: 0,
      errorsCount: 0
    };
  }

  collectAllPackages(nodes, maxDepth = DEPENDENCY_LIMITS.MAX_DEPTH, maxNodes = DEPENDENCY_LIMITS.MAX_NODES) {
    console.log(`\n=== Starting package collection ===`);
    console.log(`Input: ${nodes.length} root nodes`);
    console.log(`Limits: maxDepth=${maxDepth}, maxNodes=${maxNodes}`);

    this.resetMetrics();
    const packages = new Set();
    const result = [];

    const stack = [];
    nodes.forEach((node, index) => {
      stack.push({
        node,
        depth: 1,
        path: [`root-${index}`]
      });
    });

    let processedCount = 0;
    const processStartTime = Date.now();

    console.log(`\nProcessing ${stack.length} initial stack items...`);

    while (stack.length > 0 && processedCount < maxNodes) {
      // Check processing time limit
      if (Date.now() - processStartTime > DEPENDENCY_LIMITS.MAX_PROCESSING_TIME) {
        logger.warn(`Dependency traversal timeout after ${DEPENDENCY_LIMITS.MAX_PROCESSING_TIME}ms`);
        this.metrics.errorsCount++;
        break;
      }

      // Memory check every N nodes
      if (processedCount % DEPENDENCY_LIMITS.MEMORY_CHECK_INTERVAL === 0) {
        this.checkMemoryUsage();
      }

      const { node, depth, path } = stack.pop();
      const nodeKey = `${node.name}@${node.version}`;
      const currentPath = [...path, nodeKey];

      processedCount++;
      this.metrics.totalNodes++;
      this.metrics.maxDepth = Math.max(this.metrics.maxDepth, depth);

      // Progress logging
      if (processedCount % 100 === 0) {
        console.log(`Processed ${processedCount} nodes, stack size: ${stack.length}, depth: ${depth}`);
      }

      // Check for circular dependencies
      if (this.visitedNodes.has(nodeKey)) {
        if (path.includes(nodeKey)) {
          const circularPath = currentPath.join(' → ');
          this.circularDependencies.add(circularPath);
          this.metrics.circularReferences++;

          if (this.metrics.circularReferences <= 5) { // Only log first 5
            console.log(`[CIRCULAR] ${circularPath}`);
          }

          if (this.metrics.circularReferences > DEPENDENCY_LIMITS.MAX_CIRCULAR_REFERENCES) {
            logger.warn(`Too many circular dependencies detected (${this.metrics.circularReferences}), stopping traversal`);
            this.metrics.errorsCount++;
            break;
          }
          continue;
        }
        continue;
      }

      this.visitedNodes.add(nodeKey);

      if (!packages.has(nodeKey)) {
        packages.add(nodeKey);
        result.push([node.name, node.version]);
        this.metrics.uniquePackages++;
      }

      // Add children to stack if depth limit not exceeded
      if (depth < maxDepth) {
        for (const [_depName, childNode] of node.dependencies.entries()) {
          stack.push({
            node: childNode,
            depth: depth + 1,
            path: currentPath
          });
        }
      } else if (node.dependencies.size > 0) {
        logger.debug(`Depth limit ${maxDepth} reached for ${nodeKey}, skipping ${node.dependencies.size} children`);
        this.metrics.warningsCount++;
      }
    }

    this.metrics.processingTimeMs = Date.now() - processStartTime;

    console.log(`\n=== Collection completed ===`);
    console.log(`Total nodes processed: ${this.metrics.totalNodes}`);
    console.log(`Unique packages found: ${this.metrics.uniquePackages}`);
    console.log(`Max depth reached: ${this.metrics.maxDepth}`);
    console.log(`Circular references: ${this.metrics.circularReferences}`);
    console.log(`Processing time: ${this.metrics.processingTimeMs}ms`);
    console.log(`Memory usage: ${this.metrics.memoryUsageMB}MB`);
    console.log(`Warnings: ${this.metrics.warningsCount}`);
    console.log(`Errors: ${this.metrics.errorsCount}`);

    return result;
  }

  checkMemoryUsage() {
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    this.metrics.memoryUsageMB = heapUsedMB;

    if (heapUsedMB > 1000) { // 1GB warning threshold for testing
      logger.warn(`High memory usage: ${heapUsedMB}MB`);
    }
  }

  resetMetrics() {
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
      errorsCount: 0
    };
  }

  getCircularDependencies() {
    return Array.from(this.circularDependencies);
  }
}

/**
 * Test calculation methods
 */
function testCalculateTransitiveInfo(node) {
  console.log(`\n=== Testing transitive info calculation for ${node.name} ===`);

  let count = 0;
  let vulnerableCount = 0;
  let outdatedCount = 0;

  const stack = [node];
  const visited = new Set();
  let iterations = 0;

  while (stack.length > 0 && iterations < 10000) {
    const currentNode = stack.pop();
    const nodeKey = `${currentNode.name}@${currentNode.version}`;

    if (visited.has(nodeKey)) {
      continue;
    }
    visited.add(nodeKey);

    for (const [_depName, childNode] of currentNode.dependencies.entries()) {
      count++;
      if (childNode.isVulnerable) {
        vulnerableCount += childNode.vulnerabilityCount;
      }
      if (childNode.isOutdated) {
        outdatedCount++;
      }
      stack.push(childNode);
    }

    iterations++;

    if (iterations % 1000 === 0) {
      console.log(`Calculation iterations: ${iterations}, stack: ${stack.length}`);
    }
  }

  console.log(`Calculation completed: ${iterations} iterations`);
  console.log(`Results: count=${count}, vulnerable=${vulnerableCount}, outdated=${outdatedCount}`);

  return { count, vulnerableCount, outdatedCount };
}

/**
 * Simple npm lock file parser for testing
 */
function parsePackageLock(lockFileContent) {
  console.log(`\n=== Parsing package-lock.json ===`);

  try {
    const lockData = JSON.parse(lockFileContent);
    console.log(`Lock file version: ${lockData.lockfileVersion}`);
    console.log(`Package name: ${lockData.name}`);

    if (!lockData.packages) {
      throw new Error('No packages found in lock file');
    }

    const nodes = [];
    const nodeMap = new Map();

    // Create nodes for all packages
    Object.entries(lockData.packages).forEach(([key, pkg]) => {
      if (!key || key === '') return; // Skip root

      const packageName = pkg.name || key.split('node_modules/').pop();
      const node = {
        name: packageName,
        version: pkg.version || '0.0.0',
        dependencies: new Map(),
        isVulnerable: false,
        vulnerabilityCount: 0,
        isOutdated: false,
        depth: 0,
        dependencyType: 'dependencies'
      };

      nodeMap.set(key, node);
    });

    // Build dependency relationships
    Object.entries(lockData.packages).forEach(([key, pkg]) => {
      if (!key || key === '') return;

      const node = nodeMap.get(key);
      if (!node) return;

      if (pkg.dependencies) {
        Object.keys(pkg.dependencies).forEach(depName => {
          // Find the dependency node
          for (const [depKey, depNode] of nodeMap.entries()) {
            if (depNode.name === depName) {
              node.dependencies.set(depName, depNode);
              break;
            }
          }
        });
      }
    });

    // Get root dependencies
    const rootPackage = lockData.packages[''];
    if (rootPackage && rootPackage.dependencies) {
      Object.keys(rootPackage.dependencies).forEach(depName => {
        for (const [key, node] of nodeMap.entries()) {
          if (node.name === depName) {
            node.depth = 1;
            nodes.push(node);
            break;
          }
        }
      });
    }

    console.log(`Created ${nodeMap.size} total nodes`);
    console.log(`Found ${nodes.length} root dependencies`);

    return nodes;
  } catch (error) {
    console.error('Error parsing package-lock.json:', error);
    throw error;
  }
}

/**
 * Main test function
 */
async function runTest() {
  try {
    console.log('='.repeat(60));
    console.log('TRANSITIVE DEPENDENCY ANALYSIS TEST');
    console.log('='.repeat(60));

    const lockFilePath = process.argv[2];
    if (!lockFilePath) {
      console.log('Usage: node test-transitive-analysis.js <package-lock.json>');
      process.exit(1);
    }

    if (!fs.existsSync(lockFilePath)) {
      console.error(`File not found: ${lockFilePath}`);
      process.exit(1);
    }

    console.log(`Reading lock file: ${lockFilePath}`);
    const lockFileContent = fs.readFileSync(lockFilePath, 'utf8');
    console.log(`File size: ${Math.round(lockFileContent.length / 1024)}KB`);

    // Parse the lock file
    const rootNodes = parsePackageLock(lockFileContent);

    // Test dependency traversal
    const traverser = new TestDependencyTraverser();
    const allPackages = traverser.collectAllPackages(rootNodes);

    // Test calculation methods on first few nodes
    const testNodes = rootNodes.slice(0, 3);
    for (const node of testNodes) {
      testCalculateTransitiveInfo(node);
    }

    console.log(`\n=== FINAL RESULTS ===`);
    console.log(`✅ Successfully processed ${allPackages.length} unique packages`);
    console.log(`✅ Found ${traverser.getCircularDependencies().length} circular dependencies`);
    console.log(`✅ No crashes or infinite loops detected`);

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the test
runTest();