// node-service/utils/logger.js
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, colorize, printf } = format;

const customFormat = printf(({ level, message, timestamp, ...meta }) => {
  const metaString = Object.keys(meta).length ? JSON.stringify(meta) : '';
  return `${timestamp} [${level.toUpperCase()}] ${message} ${metaString}`;
});

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'debug',
  // No "format" here at the root, because we'll set format per transport.
  transports: [
    // 1) Colorized Console Output
    new transports.Console({
      format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        colorize(), // colorize for terminal
        customFormat
      ),
    }),

    // 2) File Transport (uncolored logs)
    new transports.File({
      filename: 'app.log',
      // No colorize here
      format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        customFormat
      ),
    }),
  ],
});

module.exports = logger;
