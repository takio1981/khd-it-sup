import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '@config/env';
import { logger } from '@infrastructure/logger/logger';

let transporter: Transporter | null = null;

/** Lazy singleton — สร้าง connection เมื่อถูกใช้งานจริงครั้งแรกเท่านั้น (ไม่ block startup ถ้ายังไม่ตั้งค่า SMTP) */
function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

export interface ISendMailOptions {
  to: string;
  subject: string;
  html: string;
}

/** SMTP ยังไม่ได้ตั้งค่า (SMTP_USER/SMTP_FROM_EMAIL ว่าง) — throw แทนการคืนค่า "สำเร็จ" ปลอม
 *  เพื่อให้ NotificationService บันทึก log เป็น FAILED ตามความจริง ไม่ใช่ SENT ทั้งที่ไม่ได้ส่งจริง */
export class SmtpNotConfiguredError extends Error {
  constructor() {
    super('SMTP ยังไม่ได้ตั้งค่า — กรุณาตั้งค่า SMTP_USER, SMTP_PASS, SMTP_FROM_EMAIL ในไฟล์ .env');
    this.name = 'SmtpNotConfiguredError';
  }
}

export async function sendMail(options: ISendMailOptions): Promise<{ messageId: string }> {
  if (!env.SMTP_USER || !env.SMTP_FROM_EMAIL) {
    logger.warn(`[mailer] SMTP ยังไม่ได้ตั้งค่า — ข้ามการส่งอีเมลถึง ${options.to}: ${options.subject}`);
    throw new SmtpNotConfiguredError();
  }

  const info = await getTransporter().sendMail({
    from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`,
    to: options.to,
    subject: options.subject,
    html: options.html,
  });

  return { messageId: info.messageId };
}
