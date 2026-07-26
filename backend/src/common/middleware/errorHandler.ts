import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { MulterError } from 'multer';
import { AppError } from '@common/errors';
import { logger } from '@infrastructure/logger/logger';
import { isProduction } from '@config/env';

interface IErrorBody {
  success: false;
  error: { code: string; message: string; details?: unknown };
}

/**
 * Express error-handling middleware (4 argument signature บังคับโดย Express ให้เป็น error handler)
 * ต้องอยู่หลังสุดใน middleware chain ของ app.ts เสมอ
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const requestId = req.headers['x-request-id'] ?? '-';

  if (err instanceof AppError) {
    logger.warn(`[${String(requestId)}] ${err.code}: ${err.message}`);
    const body: IErrorBody = { success: false, error: { code: err.code, message: err.message, details: err.details } };
    res.status(err.statusCode).json(body);
    return;
  }

  if (err instanceof ZodError) {
    const body: IErrorBody = {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'ข้อมูลไม่ผ่านการตรวจสอบ', details: err.flatten() },
    };
    res.status(422).json(body);
    return;
  }

  if (err instanceof MulterError) {
    logger.warn(`[${String(requestId)}] Multer ${err.code}: ${err.message}`);
    const mapped = mapMulterError(err);
    res.status(mapped.statusCode).json({ success: false, error: mapped.error });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const mapped = mapPrismaError(err);
    logger.warn(`[${String(requestId)}] Prisma ${err.code}: ${err.message}`);
    res.status(mapped.statusCode).json({ success: false, error: mapped.error });
    return;
  }

  logger.error(`[${String(requestId)}] Unhandled error: ${err instanceof Error ? err.stack : String(err)}`);
  const body: IErrorBody = {
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: isProduction ? 'เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่ภายหลัง' : (err as Error)?.message ?? 'Unknown error',
    },
  };
  res.status(500).json(body);
}

function mapMulterError(err: MulterError): { statusCode: number; error: IErrorBody['error'] } {
  switch (err.code) {
    case 'LIMIT_FILE_SIZE':
      return { statusCode: 413, error: { code: 'FILE_TOO_LARGE', message: 'ไฟล์มีขนาดใหญ่เกินกำหนด' } };
    case 'LIMIT_FILE_COUNT':
    case 'LIMIT_UNEXPECTED_FILE':
      return { statusCode: 400, error: { code: 'TOO_MANY_FILES', message: 'แนบไฟล์เกินจำนวนที่กำหนด' } };
    default:
      return { statusCode: 400, error: { code: 'UPLOAD_ERROR', message: 'อัปโหลดไฟล์ไม่สำเร็จ' } };
  }
}

function mapPrismaError(err: Prisma.PrismaClientKnownRequestError): {
  statusCode: number;
  error: IErrorBody['error'];
} {
  switch (err.code) {
    case 'P2002':
      return {
        statusCode: 409,
        error: { code: 'DUPLICATE_ENTRY', message: 'ข้อมูลซ้ำกับที่มีอยู่ในระบบ', details: err.meta },
      };
    case 'P2025':
      return { statusCode: 404, error: { code: 'NOT_FOUND', message: 'ไม่พบข้อมูลที่ร้องขอ' } };
    case 'P2003':
      return {
        statusCode: 409,
        error: { code: 'FOREIGN_KEY_CONSTRAINT', message: 'ไม่สามารถทำรายการได้เนื่องจากมีข้อมูลอื่นอ้างอิงอยู่' },
      };
    default:
      return { statusCode: 500, error: { code: 'DATABASE_ERROR', message: 'เกิดข้อผิดพลาดกับฐานข้อมูล' } };
  }
}
