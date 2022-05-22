import { createLogger, format, transports } from 'winston';
const { combine, printf, timestamp, colorize, splat } = format;

const logFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} [${level}] ${message}`;
});

export const logger = createLogger({
  level: 'debug',
  format: combine(timestamp({ format: 'HH:mm:ss' })),
  transports: [
    new transports.Console({
      format: format.combine(colorize(), splat(), logFormat),
    }),
    new transports.File({
      format: format.combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:SS' }),
        splat(),
        logFormat,
      ),
      filename: 'logs/app.log',
    }),
  ],
});
