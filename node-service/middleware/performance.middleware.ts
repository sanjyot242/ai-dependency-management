// middleware/performance.middleware.ts

import { Request, Response, NextFunction } from 'express';
import { configUtils } from '../utils/config.utils';
import logger from '../utils/logger';

/**
 * Performance monitoring middleware for dependency processing endpoints
 */
export class PerformanceMiddleware {
  /**
   * Monitor request performance and resource usage
   */
  public static monitor() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!configUtils.get('enablePerformanceMonitoring')) {
        return next();
      }

      const startTime = Date.now();
      const startMemory = process.memoryUsage();

      // Override res.end to capture completion metrics
      const originalEnd = res.end.bind(res);
      res.end = function(this: Response, ...args: any[]): Response {
        const endTime = Date.now();
        const endMemory = process.memoryUsage();
        const duration = endTime - startTime;

        const memoryDelta = {
          heapUsed: Math.round((endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024),
          heapTotal: Math.round((endMemory.heapTotal - startMemory.heapTotal) / 1024 / 1024),
          rss: Math.round((endMemory.rss - startMemory.rss) / 1024 / 1024)
        };

        // Log performance metrics
        const logLevel = configUtils.get('performanceLogLevel') as 'debug' | 'info' | 'warn' | 'error';
        logger[logLevel]('Request performance:', {
          method: req.method,
          url: req.url,
          duration,
          statusCode: res.statusCode,
          memoryDelta,
          currentMemoryMB: Math.round(endMemory.heapUsed / 1024 / 1024)
        });

        // Warn if request took too long or used too much memory
        if (duration > 30000) { // 30 seconds
          logger.warn(`Slow request detected: ${req.method} ${req.url} took ${duration}ms`);
        }

        if (memoryDelta.heapUsed > 100) { // 100MB memory increase
          logger.warn(`High memory usage request: ${req.method} ${req.url} used ${memoryDelta.heapUsed}MB`);
        }

        // Call original end method
        return originalEnd(...args);
      };

      next();
    };
  }

  /**
   * Health check middleware for dependency processing status
   */
  public static healthCheck() {
    return (req: Request, res: Response) => {
      const memoryInfo = configUtils.getMemoryInfo();
      const config = configUtils.getConfigSummary();

      const healthStatus = {
        status: memoryInfo.isCritical ? 'unhealthy' : 'healthy',
        timestamp: new Date().toISOString(),
        memory: {
          heapUsedMB: memoryInfo.heapUsedMB,
          heapTotalMB: memoryInfo.heapTotalMB,
          isWarning: memoryInfo.isWarning,
          isCritical: memoryInfo.isCritical
        },
        configuration: config,
        limits: {
          maxDepth: configUtils.get('maxDepth'),
          maxNodes: configUtils.get('maxNodes'),
          maxProcessingTimeMs: configUtils.get('maxProcessingTimeMs')
        },
        features: {
          vulnerabilityScanning: configUtils.get('enableVulnerabilityScanning'),
          performanceMonitoring: configUtils.get('enablePerformanceMonitoring'),
          fallbackProcessing: configUtils.get('enableFallbackProcessing')
        }
      };

      const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
      res.status(statusCode).json(healthStatus);
    };
  }

  /**
   * Resource monitoring endpoint for debugging
   */
  public static resourceMonitor() {
    return (req: Request, res: Response) => {
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      const uptime = process.uptime();

      const resourceInfo = {
        timestamp: new Date().toISOString(),
        memory: {
          rss: Math.round(memoryUsage.rss / 1024 / 1024),
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          external: Math.round(memoryUsage.external / 1024 / 1024),
          arrayBuffers: Math.round(memoryUsage.arrayBuffers / 1024 / 1024)
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system
        },
        process: {
          uptime: Math.round(uptime),
          pid: process.pid,
          version: process.version,
          platform: process.platform
        },
        configuration: configUtils.getConfigSummary()
      };

      res.json(resourceInfo);
    };
  }
}

export default PerformanceMiddleware;