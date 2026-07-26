import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '@common/errors';
import { verifyAccessToken } from '@common/utils/jwt.util';

/** ตรวจสอบ JWT Access Token จาก header `Authorization: Bearer <token>` และแนบ req.user */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError('ไม่พบ Access Token กรุณาเข้าสู่ระบบ');
  }

  const token = header.slice('Bearer '.length);

  try {
    req.user = verifyAccessToken(token);
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Access Token หมดอายุ กรุณาขอ Token ใหม่');
    }
    throw new UnauthorizedError('Access Token ไม่ถูกต้อง');
  }
}

/** เหมือน authenticate แต่ไม่ throw หาก token ไม่มี — ใช้กับ route สาธารณะที่พฤติกรรมต่างกันถ้า login อยู่ (เช่น QR resolve) */
export function optionalAuthenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next();
    return;
  }
  try {
    req.user = verifyAccessToken(header.slice('Bearer '.length));
  } catch {
    // token ไม่ถูกต้อง/หมดอายุ — ปฏิบัติเหมือนไม่ได้ login แทนที่จะ error สำหรับ route สาธารณะ
  }
  next();
}
