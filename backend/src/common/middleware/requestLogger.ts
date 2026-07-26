import morgan from 'morgan';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { logger } from '@infrastructure/logger/logger';

/** แนบ X-Request-Id ให้ทุก request เพื่อไล่ log เดียวกันข้าม middleware/service ได้ */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = (req.headers['x-request-id'] as string) || randomUUID();
  req.headers['x-request-id'] = id;
  res.setHeader('X-Request-Id', id);
  next();
}

export const requestLogger = morgan(
  ':method :url :status :res[content-length] - :response-time ms [:req[x-request-id]]',
  {
    stream: {
      write: (message: string) => logger.http(message.trim()),
    },
  },
);
