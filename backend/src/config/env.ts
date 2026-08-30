import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_NAME: z.string().default('KHD-IT-SUP'),
  API_PREFIX: z.string().default('/api/v1'),
  CORS_ORIGIN: z.string().default('http://localhost:4200'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  REFRESH_TOKEN_COOKIE_NAME: z.string().default('khd_refresh_token'),

  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  QR_AES_SECRET: z.string().min(32, 'QR_AES_SECRET must be exactly 32 characters for AES-256').max(32),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),

  PIN_DEVICE_COOKIE_NAME: z.string().default('khd_pin_device'),
  PIN_DEVICE_TTL: z.string().default('90d'),
  PIN_MAX_FAILED_ATTEMPTS: z.coerce.number().int().positive().default(5),
  PIN_LOCKOUT_MINUTES: z.coerce.number().int().positive().default(15),
  PIN_REVOKE_AFTER_ATTEMPTS: z.coerce.number().int().positive().default(10),
  PIN_LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),

  UPLOAD_DIR: z.string().default('./uploads'),
  UPLOAD_MAX_FILE_SIZE_MB: z.coerce.number().int().positive().default(10),

  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  // หมายเหตุ: ห้ามใช้ z.coerce.boolean() กับ env string — Boolean("false") ใน JS เป็น true เสมอ (บั๊กเงียบ)
  SMTP_SECURE: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  SMTP_FROM_NAME: z.string().default('KHD IT Service Desk'),
  SMTP_FROM_EMAIL: z.string().default(''),

  TELEGRAM_BOT_TOKEN: z.string().default(''),
  TELEGRAM_DEFAULT_CHAT_ID: z.string().default(''),

  LINE_CHANNEL_ACCESS_TOKEN: z.string().default(''),
  LINE_CHANNEL_SECRET: z.string().default(''),

  FRONTEND_BASE_URL: z.string().default('http://localhost:4200'),

  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),
  LOG_DIR: z.string().default('./logs'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables — see .env.example for required keys');
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';
export const isTest = env.NODE_ENV === 'test';
