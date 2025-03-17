import { createLogger, format, transports, Logger } from 'winston';
const { combine, timestamp, colorize, printf } = format;

const customFormat = printf(({ level, message, timestamp, ...meta }) => {
  const metaString = Object.keys(meta).length
    ? JSON.stringify(meta, null, 2)
    : '';
  return `${timestamp} [${level.toUpperCase()}] ${message} ${metaString}`;
});
const logger: Logger = createLogger({
  level: process.env.LOG_LEVEL || 'debug',
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
      format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        customFormat
      ),
    }),
  ],
});

export default logger;
