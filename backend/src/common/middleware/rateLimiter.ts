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

/**
 * Rate limit สำหรับ /auth/pin/login — เป็นเกราะชั้นรองอิง IP เท่านั้น (max สูงกว่า loginRateLimiter
 * เพราะ PIN ถูกใช้บ่อยทุกวันโดยผู้ใช้ตัวจริง) ตัวป้องกัน brute-force หลักคือ per-credential lockout
 * ใน AuthService.loginWithPin (failedAttempts/lockedUntil ต่อแถว pin_credentials)
 */
export const pinLoginRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.PIN_LOGIN_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    error: { code: 'TOO_MANY_PIN_ATTEMPTS', message: 'พยายามเข้าสู่ระบบด้วย PIN ผิดหลายครั้งเกินไป กรุณาลองใหม่ภายหลัง' },
  },
});
