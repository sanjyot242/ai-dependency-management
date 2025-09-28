// utils/config.utils.ts

import dotenv from 'dotenv';
import logger from './logger';

// Load environment variables
dotenv.config();

/**
 * Configuration interface for dependency processing
 */
export interface DependencyProcessingConfig {
  // Processing limits
  maxDepth: number;
  maxNodes: number;
  maxProcessingTimeMs: number;
  maxCircularRefs: number;

  // Memory management
  memoryWarningMB: number;
  memoryCriticalMB: number;
  memoryCheckInterval: number;

  // Batch processing
  defaultBatchSize: number;
  maxBatchSize: number;
  batchDelayMs: number;
  maxBatchTimeoutMs: number;

  // Lock file processing
  maxLockFileSizeMB: number;
  lockFileTimeoutMs: number;

  // API rate limits
  npmRegistryRateLimit: number;
  osvApiRateLimit: number;
  githubApiRateLimit: number;

  // Vulnerability scanning
  enableVulnerabilityScanning: boolean;
  vulnerabilityBatchSize: number;
  vulnerabilityTimeoutMs: number;

  // Error handling
  maxRetryAttempts: number;
  retryDelayMs: number;
  enableFallbackProcessing: boolean;
  fallbackMaxDepth: number;

  // Performance monitoring
  enablePerformanceMonitoring: boolean;
  performanceLogLevel: string;
  enableDebugMetrics: boolean;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: DependencyProcessingConfig = {
  // Processing limits
  maxDepth: 50,
  maxNodes: 50000,
  maxProcessingTimeMs: 900000, // 15 minutes
  maxCircularRefs: 10000,

  // Memory management
  memoryWarningMB: 2048, // 2GB
  memoryCriticalMB: 6144, // 6GB
  memoryCheckInterval: 1000,

  // Batch processing
  defaultBatchSize: 10,
  maxBatchSize: 20,
  batchDelayMs: 100,
  maxBatchTimeoutMs: 120000, // 2 minutes

  // Lock file processing
  maxLockFileSizeMB: 500,
  lockFileTimeoutMs: 300000, // 5 minutes

  // API rate limits
  npmRegistryRateLimit: 300,
  osvApiRateLimit: 100,
  githubApiRateLimit: 5000,

  // Vulnerability scanning
  enableVulnerabilityScanning: true,
  vulnerabilityBatchSize: 1000,
  vulnerabilityTimeoutMs: 30000,

  // Error handling
  maxRetryAttempts: 3,
  retryDelayMs: 1000,
  enableFallbackProcessing: true,
  fallbackMaxDepth: 10,

  // Performance monitoring
  enablePerformanceMonitoring: true,
  performanceLogLevel: 'info',
  enableDebugMetrics: false,
};

/**
 * Configuration utility class
 */
export class ConfigUtils {
  private static instance: ConfigUtils;
  private config: DependencyProcessingConfig;

  private constructor() {
    this.config = this.loadConfiguration();
    this.validateConfiguration();
  }

  public static getInstance(): ConfigUtils {
    if (!ConfigUtils.instance) {
      ConfigUtils.instance = new ConfigUtils();
    }
    return ConfigUtils.instance;
  }

  /**
   * Get the current configuration
   */
  public getConfig(): DependencyProcessingConfig {
    return { ...this.config };
  }

  /**
   * Get a specific configuration value
   */
  public get<K extends keyof DependencyProcessingConfig>(key: K): DependencyProcessingConfig[K] {
    return this.config[key];
  }

  /**
   * Update configuration at runtime (for testing/debugging)
   */
  public updateConfig(updates: Partial<DependencyProcessingConfig>): void {
    this.config = { ...this.config, ...updates };
    this.validateConfiguration();
    logger.info('Configuration updated:', updates);
  }

  /**
   * Load configuration from environment variables
   */
  private loadConfiguration(): DependencyProcessingConfig {
    const config: DependencyProcessingConfig = {
      // Processing limits
      maxDepth: this.getEnvNumber('MAX_DEPENDENCY_DEPTH', DEFAULT_CONFIG.maxDepth),
      maxNodes: this.getEnvNumber('MAX_DEPENDENCY_NODES', DEFAULT_CONFIG.maxNodes),
      maxProcessingTimeMs: this.getEnvNumber('MAX_PROCESSING_TIME_MS', DEFAULT_CONFIG.maxProcessingTimeMs),
      maxCircularRefs: this.getEnvNumber('MAX_CIRCULAR_REFS', DEFAULT_CONFIG.maxCircularRefs),

      // Memory management
      memoryWarningMB: this.getEnvNumber('MEMORY_WARNING_MB', DEFAULT_CONFIG.memoryWarningMB),
      memoryCriticalMB: this.getEnvNumber('MEMORY_CRITICAL_MB', DEFAULT_CONFIG.memoryCriticalMB),
      memoryCheckInterval: this.getEnvNumber('MEMORY_CHECK_INTERVAL', DEFAULT_CONFIG.memoryCheckInterval),

      // Batch processing
      defaultBatchSize: this.getEnvNumber('DEFAULT_BATCH_SIZE', DEFAULT_CONFIG.defaultBatchSize),
      maxBatchSize: this.getEnvNumber('MAX_BATCH_SIZE', DEFAULT_CONFIG.maxBatchSize),
      batchDelayMs: this.getEnvNumber('BATCH_DELAY_MS', DEFAULT_CONFIG.batchDelayMs),
      maxBatchTimeoutMs: this.getEnvNumber('MAX_BATCH_TIMEOUT_MS', DEFAULT_CONFIG.maxBatchTimeoutMs),

      // Lock file processing
      maxLockFileSizeMB: this.getEnvNumber('MAX_LOCK_FILE_SIZE_MB', DEFAULT_CONFIG.maxLockFileSizeMB),
      lockFileTimeoutMs: this.getEnvNumber('LOCK_FILE_TIMEOUT_MS', DEFAULT_CONFIG.lockFileTimeoutMs),

      // API rate limits
      npmRegistryRateLimit: this.getEnvNumber('NPM_REGISTRY_RATE_LIMIT', DEFAULT_CONFIG.npmRegistryRateLimit),
      osvApiRateLimit: this.getEnvNumber('OSV_API_RATE_LIMIT', DEFAULT_CONFIG.osvApiRateLimit),
      githubApiRateLimit: this.getEnvNumber('GITHUB_API_RATE_LIMIT', DEFAULT_CONFIG.githubApiRateLimit),

      // Vulnerability scanning
      enableVulnerabilityScanning: this.getEnvBoolean('ENABLE_VULNERABILITY_SCANNING', DEFAULT_CONFIG.enableVulnerabilityScanning),
      vulnerabilityBatchSize: this.getEnvNumber('VULNERABILITY_BATCH_SIZE', DEFAULT_CONFIG.vulnerabilityBatchSize),
      vulnerabilityTimeoutMs: this.getEnvNumber('VULNERABILITY_TIMEOUT_MS', DEFAULT_CONFIG.vulnerabilityTimeoutMs),

      // Error handling
      maxRetryAttempts: this.getEnvNumber('MAX_RETRY_ATTEMPTS', DEFAULT_CONFIG.maxRetryAttempts),
      retryDelayMs: this.getEnvNumber('RETRY_DELAY_MS', DEFAULT_CONFIG.retryDelayMs),
      enableFallbackProcessing: this.getEnvBoolean('ENABLE_FALLBACK_PROCESSING', DEFAULT_CONFIG.enableFallbackProcessing),
      fallbackMaxDepth: this.getEnvNumber('FALLBACK_MAX_DEPTH', DEFAULT_CONFIG.fallbackMaxDepth),

      // Performance monitoring
      enablePerformanceMonitoring: this.getEnvBoolean('ENABLE_PERFORMANCE_MONITORING', DEFAULT_CONFIG.enablePerformanceMonitoring),
      performanceLogLevel: process.env.PERFORMANCE_LOG_LEVEL || DEFAULT_CONFIG.performanceLogLevel,
      enableDebugMetrics: this.getEnvBoolean('ENABLE_DEBUG_METRICS', DEFAULT_CONFIG.enableDebugMetrics),
    };

    return config;
  }

  /**
   * Validate configuration values
   */
  private validateConfiguration(): void {
    const errors: string[] = [];

    // Validate processing limits
    if (this.config.maxDepth < 1 || this.config.maxDepth > 200) {
      errors.push(`maxDepth must be between 1 and 200, got ${this.config.maxDepth}`);
    }

    if (this.config.maxNodes < 100 || this.config.maxNodes > 500000) {
      errors.push(`maxNodes must be between 100 and 500000, got ${this.config.maxNodes}`);
    }

    if (this.config.maxProcessingTimeMs < 60000 || this.config.maxProcessingTimeMs > 3600000) {
      errors.push(`maxProcessingTimeMs must be between 1 minute and 1 hour, got ${this.config.maxProcessingTimeMs}`);
    }

    // Validate memory limits
    if (this.config.memoryWarningMB >= this.config.memoryCriticalMB) {
      errors.push(`memoryWarningMB (${this.config.memoryWarningMB}) must be less than memoryCriticalMB (${this.config.memoryCriticalMB})`);
    }

    // Validate batch processing
    if (this.config.defaultBatchSize < 1 || this.config.defaultBatchSize > this.config.maxBatchSize) {
      errors.push(`defaultBatchSize must be between 1 and maxBatchSize (${this.config.maxBatchSize}), got ${this.config.defaultBatchSize}`);
    }

    // Validate timeout values
    if (this.config.lockFileTimeoutMs < 10000 || this.config.lockFileTimeoutMs > 1800000) {
      errors.push(`lockFileTimeoutMs must be between 10 seconds and 30 minutes, got ${this.config.lockFileTimeoutMs}`);
    }

    if (errors.length > 0) {
      const errorMessage = `Configuration validation failed:\\n${errors.join('\\n')}`;
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    logger.info('Configuration validation passed');
  }

  /**
   * Get environment variable as number with default
   */
  private getEnvNumber(key: string, defaultValue: number): number {
    const value = process.env[key];
    if (!value) return defaultValue;

    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      logger.warn(`Invalid number for ${key}: ${value}, using default ${defaultValue}`);
      return defaultValue;
    }

    return parsed;
  }

  /**
   * Get environment variable as boolean with default
   */
  private getEnvBoolean(key: string, defaultValue: boolean): boolean {
    const value = process.env[key];
    if (!value) return defaultValue;

    return value.toLowerCase() === 'true';
  }

  /**
   * Get current memory usage information
   */
  public getMemoryInfo(): {
    heapUsedMB: number;
    heapTotalMB: number;
    isWarning: boolean;
    isCritical: boolean;
  } {
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);

    return {
      heapUsedMB,
      heapTotalMB,
      isWarning: heapUsedMB > this.config.memoryWarningMB,
      isCritical: heapUsedMB > this.config.memoryCriticalMB,
    };
  }

  /**
   * Check if processing should be aborted due to resource constraints
   */
  public shouldAbortProcessing(startTime: number, processedNodes: number): {
    shouldAbort: boolean;
    reason?: string;
  } {
    // Check time limit
    const elapsedTime = Date.now() - startTime;
    if (elapsedTime > this.config.maxProcessingTimeMs) {
      return {
        shouldAbort: true,
        reason: `Processing time exceeded ${this.config.maxProcessingTimeMs}ms`
      };
    }

    // Check node limit
    if (processedNodes > this.config.maxNodes) {
      return {
        shouldAbort: true,
        reason: `Node count exceeded ${this.config.maxNodes}`
      };
    }

    // Check memory usage
    const memoryInfo = this.getMemoryInfo();
    if (memoryInfo.isCritical) {
      return {
        shouldAbort: true,
        reason: `Critical memory usage: ${memoryInfo.heapUsedMB}MB`
      };
    }

    return { shouldAbort: false };
  }

  /**
   * Get configuration summary for logging
   */
  public getConfigSummary(): object {
    return {
      processingLimits: {
        maxDepth: this.config.maxDepth,
        maxNodes: this.config.maxNodes,
        maxProcessingTimeMs: this.config.maxProcessingTimeMs,
      },
      memoryLimits: {
        warningMB: this.config.memoryWarningMB,
        criticalMB: this.config.memoryCriticalMB,
      },
      batchProcessing: {
        defaultBatchSize: this.config.defaultBatchSize,
        maxBatchSize: this.config.maxBatchSize,
        batchDelayMs: this.config.batchDelayMs,
      },
      features: {
        vulnerabilityScanning: this.config.enableVulnerabilityScanning,
        performanceMonitoring: this.config.enablePerformanceMonitoring,
        fallbackProcessing: this.config.enableFallbackProcessing,
      }
    };
  }
}

// Export singleton instance
export const configUtils = ConfigUtils.getInstance();
export default configUtils;