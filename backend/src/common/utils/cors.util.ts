import { env, isProduction } from '@config/env';

const allowedOrigins = env.CORS_ORIGIN.split(',')
  .map((o) => o.trim())
  .filter(Boolean);

/** เฉพาะ dev — editor บางตัว (เช่น VS Code) forward dev server ไปพอร์ตอื่นที่คาดเดาไม่ได้ (เช่น localhost:12740
 *  แทนที่จะเป็น localhost:4500 จริง) ทำให้ CORS_ORIGIN แบบ fix พอร์ตเดียวใช้ไม่ได้เสมอไป — ยอมรับทุก origin ที่เป็น
 *  localhost/127.0.0.1 ไม่ว่าพอร์ตไหนแทน (production ยังคงเข้มงวดตาม allowedOrigins เท่านั้น) */
const devLocalhostPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

/** ใช้ร่วมกันทั้ง Express `cors()` middleware และ Socket.IO server — ต้องยอมรับ signature เดียวกัน */
export function corsOriginResolver(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void): void {
  if (!origin || allowedOrigins.includes(origin) || (!isProduction && devLocalhostPattern.test(origin))) {
    callback(null, true);
    return;
  }
  callback(new Error(`Origin ${origin} not allowed by CORS`));
}
