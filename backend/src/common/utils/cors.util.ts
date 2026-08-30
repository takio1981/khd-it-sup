import { env } from '@config/env';

const allowedOrigins = env.CORS_ORIGIN.split(',')
  .map((o) => o.trim())
  .filter(Boolean);

/**
 * ยอมรับทุก origin ที่เป็น localhost/loopback หรืออยู่ใน private LAN range (RFC 1918: 10.0.0.0/8,
 * 172.16.0.0/12, 192.168.0.0/16) ไม่ว่าพอร์ตไหน — เครื่อง server นี้ถูกเข้าถึงผ่าน IP ของเครื่องเองบน
 * LAN (เช่นจากมือถือ/เครื่องอื่นในสำนักงาน) ซึ่ง IP อาจเปลี่ยนได้ตาม DHCP จึง fix เป็น origin เดียวใน
 * CORS_ORIGIN ไม่ได้ — nginx เสิร์ฟทั้ง frontend และ backend ใต้ origin เดียวกันเสมออยู่แล้ว (ดู
 * docker/nginx/nginx.conf) ระบบยืนยันตัวตนจริงจึงยังเป็น JWT + httpOnly cookie ไม่ใช่ CORS whitelist
 */
const privateNetworkPattern =
  /^https?:\/\/(localhost|127\.\d{1,3}\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})(:\d+)?$/;

/** ใช้ร่วมกันทั้ง Express `cors()` middleware และ Socket.IO server — ต้องยอมรับ signature เดียวกัน */
export function corsOriginResolver(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void): void {
  if (!origin || allowedOrigins.includes(origin) || privateNetworkPattern.test(origin)) {
    callback(null, true);
    return;
  }
  callback(new Error(`Origin ${origin} not allowed by CORS`));
}
