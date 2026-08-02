import nodemailer from 'nodemailer';
import { env } from '@config/env';
import { logger } from '@infrastructure/logger/logger';

export interface ISmtpRuntimeConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
}

type SmtpConfigProvider = () => Promise<ISmtpRuntimeConfig>;

let configProvider: SmtpConfigProvider | null = null;

/**
 * ผูก provider ที่อ่านค่า SMTP จาก system_settings (fallback .env) — เรียกครั้งเดียวตอน bootstrap ใน server.ts
 * เก็บไว้ที่นี่แทนที่จะ import systemSettingService ตรงๆ เพื่อไม่ให้ infrastructure/ ผูกกับ modules/ (ผิดทิศทาง dependency)
 */
export function setSmtpConfigProvider(fn: SmtpConfigProvider): void {
  configProvider = fn;
}

async function resolveConfig(): Promise<ISmtpRuntimeConfig> {
  if (configProvider) return configProvider();
  return {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    fromEmail: env.SMTP_FROM_EMAIL,
    fromName: env.SMTP_FROM_NAME,
  };
}

export interface ISendMailOptions {
  to: string;
  subject: string;
  html: string;
}

/** SMTP ยังไม่ได้ตั้งค่า (user/fromEmail ว่าง) — throw แทนการคืนค่า "สำเร็จ" ปลอม
 *  เพื่อให้ NotificationService บันทึก log เป็น FAILED ตามความจริง ไม่ใช่ SENT ทั้งที่ไม่ได้ส่งจริง */
export class SmtpNotConfiguredError extends Error {
  constructor() {
    super('SMTP ยังไม่ได้ตั้งค่า — กรุณาตั้งค่าใน "ตั้งค่าระบบทั่วไป" หรือไฟล์ .env (SMTP_USER, SMTP_PASS, SMTP_FROM_EMAIL)');
    this.name = 'SmtpNotConfiguredError';
  }
}

/**
 * สร้าง transporter ใหม่ทุกครั้งที่ส่ง (ไม่ cache) — ปลอดภัยกว่าเก็บ singleton เพราะ config อาจถูกแก้ผ่าน UI
 * ระหว่างรันได้ตลอดเวลา และ nodemailer SMTP transport ไม่ใช่ persistent connection (ไม่ pool) จึงไม่มี cost เพิ่ม
 */
export async function sendMail(options: ISendMailOptions): Promise<{ messageId: string }> {
  const config = await resolveConfig();

  if (!config.user || !config.fromEmail) {
    logger.warn(`[mailer] SMTP ยังไม่ได้ตั้งค่า — ข้ามการส่งอีเมลถึง ${options.to}: ${options.subject}`);
    throw new SmtpNotConfiguredError();
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
  });

  const info = await transporter.sendMail({
    from: `"${config.fromName}" <${config.fromEmail}>`,
    to: options.to,
    subject: options.subject,
    html: options.html,
  });

  return { messageId: info.messageId };
}
