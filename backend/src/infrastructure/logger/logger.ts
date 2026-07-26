import path from 'node:path';
import winston from 'winston';
import 'winston-daily-rotate-file';
import { env, isProduction } from '@config/env';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

const consoleFormat = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${String(ts)} [${level}] ${String(stack ?? message)}${metaStr}`;
  }),
);

const fileRotateTransport = new winston.transports.DailyRotateFile({
  dirname: path.resolve(env.LOG_DIR),
  filename: 'khd-it-sup-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxFiles: '30d',
  maxSize: '20m',
  zippedArchive: true,
  format: combine(timestamp(), errors({ stack: true }), json()),
});

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  transports: [
    new winston.transports.Console({ format: consoleFormat }),
    fileRotateTransport,
  ],
  exitOnError: false,
  silent: false,
});

// ใน production ลด verbosity ของ console เพื่อลด noise บน stdout ที่ container log รวบรวมอยู่แล้วผ่าน file
if (isProduction) {
  logger.transports[0].level = 'info';
}
