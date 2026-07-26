/**
 * Base class สำหรับ error ที่ "คาดการณ์ไว้แล้ว" (operational error) ทุกตัวในระบบ
 * errorHandler middleware จะแยกแยะ AppError (ส่ง response ตาม statusCode/code ที่กำหนด)
 * ออกจาก unexpected error (log แล้วตอบ 500 แบบไม่เปิดเผยรายละเอียดภายใน)
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly isOperational = true;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'คำขอไม่ถูกต้อง', code = 'BAD_REQUEST', details?: unknown) {
    super(400, code, message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'กรุณาเข้าสู่ระบบ', code = 'UNAUTHORIZED') {
    super(401, code, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'คุณไม่มีสิทธิ์ทำรายการนี้', code = 'FORBIDDEN') {
    super(403, code, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'ไม่พบข้อมูลที่ร้องขอ', code = 'NOT_FOUND') {
    super(404, code, message);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'ข้อมูลซ้ำหรือขัดแย้งกับข้อมูลที่มีอยู่', code = 'CONFLICT', details?: unknown) {
    super(409, code, message, details);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'ข้อมูลไม่ผ่านการตรวจสอบ', details?: unknown) {
    super(422, 'VALIDATION_ERROR', message, details);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'มีการร้องขอมากเกินไป กรุณาลองใหม่ภายหลัง') {
    super(429, 'TOO_MANY_REQUESTS', message);
  }
}
