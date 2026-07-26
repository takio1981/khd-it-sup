import rateLimit from 'express-rate-limit';
import { env } from '@config/env';

/** Rate limit ทั่วไป ใช้กับทุก request ใต้ /api */
export const globalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'TOO_MANY_REQUESTS', message: 'มีการร้องขอมากเกินไป กรุณาลองใหม่ภายหลัง' } },
});

/** Rate limit เข้มกว่าสำหรับ /auth/login เพื่อป้องกัน brute-force credential */
export const loginRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.LOGIN_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    error: { code: 'TOO_MANY_LOGIN_ATTEMPTS', message: 'พยายามเข้าสู่ระบบผิดหลายครั้งเกินไป กรุณาลองใหม่ภายหลัง' },
  },
});
