import type { NextFunction, Request, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '@common/errors';
import type { Permission } from '@common/constants/permissions.const';

/**
 * RBAC Guard — deny-by-default: ทุก route ที่ต้องการสิทธิ์ต้องประกาศ requirePermission() อย่างชัดเจน
 * ต้องเรียกหลัง `authenticate` middleware เสมอ (พึ่งพา req.user)
 *
 * @param permissions รายการ permission ที่ยอมรับ — ผ่านได้ถ้าผู้ใช้มี "อย่างน้อยหนึ่ง" รายการ (OR logic)
 */
export function requirePermission(...permissions: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const hasPermission = permissions.some((p) => req.user!.permissions.includes(p));
    if (!hasPermission) {
      throw new ForbiddenError(`ต้องมีสิทธิ์: ${permissions.join(' หรือ ')}`);
    }

    next();
  };
}

/** ผ่านเฉพาะ role ที่ระบุ — ใช้เมื่อ logic ผูกกับ role โดยตรง ไม่ใช่ permission ย่อย (หายากกว่า requirePermission) */
export function requireRole(...roleCodes: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError();
    }
    if (!roleCodes.includes(req.user.role)) {
      throw new ForbiddenError(`ต้องมี role: ${roleCodes.join(' หรือ ')}`);
    }
    next();
  };
}
