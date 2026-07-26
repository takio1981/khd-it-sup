import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';

interface IValidationSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

/**
 * Validate + sanitize req.body/query/params ด้วย Zod schema ก่อนเข้าสู่ Controller
 * เมื่อ parse สำเร็จจะ "แทนที่" req.body/query/params ด้วยผลลัพธ์ที่ผ่าน transform แล้ว (เช่น string→number)
 * ข้อผิดพลาดจะถูกโยนเป็น ZodError แล้วดักจับที่ errorHandler กลาง (ไม่ต้อง try/catch ในนี้)
 */
export function validateRequest(schemas: IValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (schemas.body) {
      req.body = schemas.body.parse(req.body);
    }
    if (schemas.query) {
      req.query = schemas.query.parse(req.query);
    }
    if (schemas.params) {
      req.params = schemas.params.parse(req.params);
    }
    next();
  };
}
