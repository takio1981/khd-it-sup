import path from 'node:path';
import fs from 'node:fs';
import type { Request, Response } from 'express';
import { env } from '@config/env';
import { NotFoundError, BadRequestError } from '@common/errors';
import { asyncHandler } from '@common/utils/asyncHandler';

const ALLOWED_SUBDIRS = new Set(['assets', 'tickets', 'avatars', 'logos']);

/**
 * Endpoint ที่ตรวจสิทธิ์ (authenticate) ก่อน stream ไฟล์จาก UPLOAD_DIR เสมอ — ไม่ใช้ express.static
 * เพื่อไม่ให้ไฟล์แนบ (รูปครุภัณฑ์/ไฟล์ประกอบการซ่อม) เข้าถึงได้แบบสาธารณะโดยไม่ login (ดู multer.config.ts)
 */
export const serveFile = asyncHandler(async (req: Request, res: Response) => {
  const { subdir, filename } = req.params;

  if (!ALLOWED_SUBDIRS.has(subdir) || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    throw new BadRequestError('เส้นทางไฟล์ไม่ถูกต้อง');
  }

  const filePath = path.resolve(env.UPLOAD_DIR, subdir, filename);
  const uploadRoot = path.resolve(env.UPLOAD_DIR);
  if (!filePath.startsWith(uploadRoot)) {
    throw new BadRequestError('เส้นทางไฟล์ไม่ถูกต้อง');
  }
  if (!fs.existsSync(filePath)) {
    throw new NotFoundError('ไม่พบไฟล์');
  }

  res.sendFile(filePath);
});
