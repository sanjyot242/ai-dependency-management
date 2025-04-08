// utils/logger.ts
import { createLogger, format, transports, Logger } from 'winston';
const { combine, timestamp, colorize, printf } = format;

// Custom format that safely handles circular references
const safeStringify = (obj: any) => {
  if (obj === null || obj === undefined) {
    return '';
  }

  try {
    // Use a cache to detect circular references
    const cache: any[] = [];
    return JSON.stringify(
      obj,
      (key, value) => {
        if (typeof value === 'object' && value !== null) {
          // Check for circular references
          if (cache.includes(value)) {
            return '[Circular]';
          }
          cache.push(value);
        }
        return value;
      },
      2
    );
  } catch (err) {
    return `[Unserializable Object: ${
      err instanceof Error ? err.message : 'Unknown error'
    }]`;
  }
};

const customFormat = printf(({ level, message, timestamp, ...meta }) => {
  let metaString = '';
  if (Object.keys(meta).length) {
    metaString = safeStringify(meta);
  }
  return `${timestamp} [${level.toUpperCase()}] ${message} ${metaString}`;
});

const logger: Logger = createLogger({
  level: process.env.LOG_LEVEL || 'debug',
  transports: [
    new transports.Console({
      format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        colorize(),
        customFormat
      ),
    }),
    new transports.File({
      filename: 'app.log',
      format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        customFormat
      ),
    }),
  ],
});

export default logger;
