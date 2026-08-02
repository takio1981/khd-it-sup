import { SystemSettingRepository } from '@modules/settings/repositories/systemSetting.repository';
import type { UpdateNotificationSettingsDto, UpdateOrgSettingsDto } from '@modules/settings/dto/systemSetting.dto';
import { deleteUploadedFileByUrl } from '@infrastructure/storage/multer.config';
import { env } from '@config/env';

const CATEGORY = 'notification';

/**
 * ใช้ key/category ที่ seed ไว้ตั้งแต่ Phase 0 (ดู database/seed.sql § 9 SYSTEM SETTINGS) ตรงๆ — ห้ามคิด key ใหม่ซ้อน
 * เพราะ `setting_key` เป็น unique key เดี่ยว ไม่ผูกกับ category ถ้าใช้ชื่อ key ซ้ำกับที่ seed ไว้แต่ category คนละอัน
 * upsert() จะไปกระทบแถวเดิม (แก้ value ได้) แต่ findByCategory() ของ category ใหม่จะหาแถวนั้นไม่เจอ (เคยเกิดบั๊กนี้จริง
 * ระหว่างพัฒนา — org.name_th ถูก seed ไว้ category="ORGANIZATION" แต่โค้ดแรกเขียนอ่านจาก category="org" เลยว่างตลอด)
 */
const ORG_CATEGORY = 'ORGANIZATION';
const THEME_CATEGORY = 'THEME';
const SMTP_CATEGORY = 'SMTP';
const ORG_SETTING_CATEGORIES = [ORG_CATEGORY, THEME_CATEGORY, SMTP_CATEGORY];

const ORG_NAME_KEY = 'org.name_th';
const ORG_LOGO_KEY = 'org.logo_url';
const THEME_COLOR_KEY = 'theme.primary';
const SMTP_HOST_KEY = 'smtp.host';
const SMTP_PORT_KEY = 'smtp.port';
const SMTP_SECURE_KEY = 'smtp.secure';
const SMTP_USER_KEY = 'smtp.user';
const SMTP_PASS_KEY = 'smtp.pass';
const SMTP_FROM_EMAIL_KEY = 'smtp.from_email';
const SMTP_FROM_NAME_KEY = 'smtp.from_name';
const DEFAULT_THEME_COLOR = '#006C45';
/** ค่า default ที่ seed ไว้ตั้งแต่ Phase 0 (ยังไม่มีระบบอัปโหลดไฟล์ตอนนั้น) ไม่ใช่ path ไฟล์ที่อัปโหลดผ่าน /files/logos/ จริง — ถือว่า "ยังไม่มีโลโก้ที่กำหนดเอง" */
function isUploadedLogoUrl(url: string | null | undefined): url is string {
  return Boolean(url && url.includes('/files/logos/'));
}

export interface IOrgSettings {
  orgNameTh: string;
  orgLogoUrl: string | null;
  themeColor: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassConfigured: boolean;
  smtpFromEmail: string;
  smtpFromName: string;
}

export interface IBranding {
  orgNameTh: string;
  orgLogoUrl: string | null;
}

export interface ISmtpRuntimeConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
}

const BOOL_KEYS = {
  emailEnabled: 'notification.email.enabled',
  telegramEnabled: 'notification.telegram.enabled',
  lineEnabled: 'notification.line.enabled',
  notifyNewTicket: 'notification.event.new_ticket',
  notifyAssign: 'notification.event.assign',
  notifyStatusChange: 'notification.event.status_change',
  notifyComplete: 'notification.event.complete',
  notifyCancel: 'notification.event.cancel',
  notifyAssetBorrowed: 'notification.event.asset_borrowed',
  notifyAssetReturned: 'notification.event.asset_returned',
  notifyAssetOverdue: 'notification.event.asset_overdue',
} as const;
type BoolKey = keyof typeof BOOL_KEYS;

const BOOL_DEFAULTS: Record<BoolKey, boolean> = {
  emailEnabled: true,
  telegramEnabled: false,
  lineEnabled: false,
  notifyNewTicket: true,
  notifyAssign: true,
  notifyStatusChange: true,
  notifyComplete: true,
  notifyCancel: true,
  notifyAssetBorrowed: true,
  notifyAssetReturned: true,
  notifyAssetOverdue: true,
};

const TELEGRAM_CHAT_ID_KEY = 'notification.telegram.chat_id';
const TELEGRAM_BOT_TOKEN_KEY = 'notification.telegram.bot_token';
const LINE_ACCESS_TOKEN_KEY = 'notification.line.access_token';
const LINE_TARGET_ID_KEY = 'notification.line.target_id';

export type INotificationSettings = Record<BoolKey, boolean> & {
  telegramChatId: string;
  telegramBotTokenConfigured: boolean;
  lineTargetId: string;
  lineAccessTokenConfigured: boolean;
};

/**
 * ตั้งค่าระบบแจ้งเตือน — เก็บแบบ key-value ใน system_settings (category="notification") เพื่อไม่ต้องเพิ่มตารางใหม่
 * ค่าที่ตั้งผ่านหน้าเว็บ (DB) มีผลก่อนเสมอ ถ้ายังไม่ได้ตั้งจะ fallback ไปใช้ค่าจาก .env (TELEGRAM_BOT_TOKEN ฯลฯ)
 * Bot token / Access token ไม่คืนค่าจริงกลับไปที่ frontend เด็ดขาด (isSecret) — ส่งแค่ boolean ว่าตั้งค่าไว้แล้วหรือยัง
 */
export class SystemSettingService {
  private readonly repo = new SystemSettingRepository();

  async getNotificationSettings(): Promise<INotificationSettings> {
    const valueByKey = await this.loadValues();

    const bools = {} as Record<BoolKey, boolean>;
    for (const key of Object.keys(BOOL_KEYS) as BoolKey[]) {
      const raw = valueByKey.get(BOOL_KEYS[key]);
      bools[key] = raw === undefined ? BOOL_DEFAULTS[key] : raw === 'true';
    }

    const telegramChatId = valueByKey.get(TELEGRAM_CHAT_ID_KEY) || env.TELEGRAM_DEFAULT_CHAT_ID;
    const telegramBotToken = valueByKey.get(TELEGRAM_BOT_TOKEN_KEY) || env.TELEGRAM_BOT_TOKEN;
    const lineTargetId = valueByKey.get(LINE_TARGET_ID_KEY);
    const lineAccessToken = valueByKey.get(LINE_ACCESS_TOKEN_KEY) || env.LINE_CHANNEL_ACCESS_TOKEN;

    return {
      ...bools,
      telegramChatId: telegramChatId ?? '',
      telegramBotTokenConfigured: Boolean(telegramBotToken),
      lineTargetId: lineTargetId ?? '',
      lineAccessTokenConfigured: Boolean(lineAccessToken),
    };
  }

  async updateNotificationSettings(dto: UpdateNotificationSettingsDto, updatedBy: string): Promise<INotificationSettings> {
    const boolEntries = (Object.keys(BOOL_KEYS) as BoolKey[]).filter((key) => dto[key] !== undefined);
    await Promise.all(boolEntries.map((key) => this.repo.upsert(BOOL_KEYS[key], String(dto[key]), CATEGORY, updatedBy)));

    if (dto.telegramChatId !== undefined) {
      await this.repo.upsert(TELEGRAM_CHAT_ID_KEY, dto.telegramChatId, CATEGORY, updatedBy);
    }
    if (dto.telegramBotToken) {
      await this.repo.upsert(TELEGRAM_BOT_TOKEN_KEY, dto.telegramBotToken, CATEGORY, updatedBy, true);
    }
    if (dto.lineTargetId !== undefined) {
      await this.repo.upsert(LINE_TARGET_ID_KEY, dto.lineTargetId, CATEGORY, updatedBy);
    }
    if (dto.lineAccessToken) {
      await this.repo.upsert(LINE_ACCESS_TOKEN_KEY, dto.lineAccessToken, CATEGORY, updatedBy, true);
    }

    return this.getNotificationSettings();
  }

  /** ใช้ตอนส่งข้อความจริงเท่านั้น (ไม่ผ่าน controller) — คืนค่า token จริงเพื่อเรียก Telegram Bot API */
  async getTelegramConfig(): Promise<{ botToken: string; chatId: string } | null> {
    const valueByKey = await this.loadValues();
    const botToken = valueByKey.get(TELEGRAM_BOT_TOKEN_KEY) || env.TELEGRAM_BOT_TOKEN;
    const chatId = valueByKey.get(TELEGRAM_CHAT_ID_KEY) || env.TELEGRAM_DEFAULT_CHAT_ID;
    if (!botToken || !chatId) return null;
    return { botToken, chatId };
  }

  /** ใช้ตอนส่งข้อความจริงเท่านั้น — คืนค่า access token + เป้าหมาย (Group/User ID) เพื่อเรียก LINE Messaging API */
  async getLineConfig(): Promise<{ accessToken: string; targetId: string } | null> {
    const valueByKey = await this.loadValues();
    const accessToken = valueByKey.get(LINE_ACCESS_TOKEN_KEY) || env.LINE_CHANNEL_ACCESS_TOKEN;
    const targetId = valueByKey.get(LINE_TARGET_ID_KEY);
    if (!accessToken || !targetId) return null;
    return { accessToken, targetId };
  }

  private async loadValues(): Promise<Map<string, string | null>> {
    const rows = await this.repo.findByCategory(CATEGORY);
    return new Map(rows.map((r) => [r.settingKey, r.settingValue]));
  }

  /**
   * ตั้งค่าองค์กร/ธีม/SMTP — เก็บแบบ key-value ใน system_settings (category ORGANIZATION/THEME/SMTP ที่ seed ไว้ตั้งแต่
   * Phase 0 ดู database/seed.sql § 9) ค่าที่ตั้งผ่านหน้าเว็บ (DB) มีผลก่อนเสมอ ถ้ายังไม่ได้ตั้งจะ fallback ไปใช้ค่าจาก
   * .env (SMTP_HOST ฯลฯ) — smtpPass ไม่คืนค่าจริงกลับไปที่ frontend เด็ดขาด (isSecret) — ส่งแค่ boolean ว่าตั้งค่าไว้แล้วหรือยัง
   */
  async getOrgSettings(): Promise<IOrgSettings> {
    const v = await this.loadOrgValues();
    const rawLogo = v.get(ORG_LOGO_KEY);
    return {
      orgNameTh: v.get(ORG_NAME_KEY) || '',
      orgLogoUrl: isUploadedLogoUrl(rawLogo) ? rawLogo : null,
      themeColor: v.get(THEME_COLOR_KEY) || DEFAULT_THEME_COLOR,
      smtpHost: v.get(SMTP_HOST_KEY) || env.SMTP_HOST,
      smtpPort: Number(v.get(SMTP_PORT_KEY)) || env.SMTP_PORT,
      smtpSecure: v.has(SMTP_SECURE_KEY) ? v.get(SMTP_SECURE_KEY) === 'true' : env.SMTP_SECURE,
      smtpUser: v.get(SMTP_USER_KEY) || env.SMTP_USER,
      smtpPassConfigured: Boolean(v.get(SMTP_PASS_KEY) || env.SMTP_PASS),
      smtpFromEmail: v.get(SMTP_FROM_EMAIL_KEY) || env.SMTP_FROM_EMAIL,
      smtpFromName: v.get(SMTP_FROM_NAME_KEY) || env.SMTP_FROM_NAME,
    };
  }

  /** ชื่อองค์กร/โลโก้เท่านั้น — ให้ผู้ใช้ทุกคนที่ login แล้วเรียกได้ (ใช้แสดงใน topbar/sidebar) ไม่มีข้อมูล SMTP */
  async getBranding(): Promise<IBranding> {
    const v = await this.loadOrgValues();
    const rawLogo = v.get(ORG_LOGO_KEY);
    return { orgNameTh: v.get(ORG_NAME_KEY) || '', orgLogoUrl: isUploadedLogoUrl(rawLogo) ? rawLogo : null };
  }

  async updateOrgSettings(dto: UpdateOrgSettingsDto, updatedBy: string): Promise<IOrgSettings> {
    if (dto.orgNameTh !== undefined) await this.repo.upsert(ORG_NAME_KEY, dto.orgNameTh, ORG_CATEGORY, updatedBy);
    if (dto.themeColor !== undefined) await this.repo.upsert(THEME_COLOR_KEY, dto.themeColor, THEME_CATEGORY, updatedBy);
    if (dto.smtpHost !== undefined) await this.repo.upsert(SMTP_HOST_KEY, dto.smtpHost, SMTP_CATEGORY, updatedBy);
    if (dto.smtpPort !== undefined) await this.repo.upsert(SMTP_PORT_KEY, String(dto.smtpPort), SMTP_CATEGORY, updatedBy);
    if (dto.smtpSecure !== undefined) await this.repo.upsert(SMTP_SECURE_KEY, String(dto.smtpSecure), SMTP_CATEGORY, updatedBy);
    if (dto.smtpUser !== undefined) await this.repo.upsert(SMTP_USER_KEY, dto.smtpUser, SMTP_CATEGORY, updatedBy, true);
    if (dto.smtpPass) await this.repo.upsert(SMTP_PASS_KEY, dto.smtpPass, SMTP_CATEGORY, updatedBy, true);
    if (dto.smtpFromEmail !== undefined) await this.repo.upsert(SMTP_FROM_EMAIL_KEY, dto.smtpFromEmail, SMTP_CATEGORY, updatedBy);
    if (dto.smtpFromName !== undefined) await this.repo.upsert(SMTP_FROM_NAME_KEY, dto.smtpFromName, SMTP_CATEGORY, updatedBy);
    return this.getOrgSettings();
  }

  async setOrgLogo(fileUrl: string, updatedBy: string): Promise<IOrgSettings> {
    const current = await this.loadOrgValues();
    const oldUrl = current.get(ORG_LOGO_KEY);
    if (isUploadedLogoUrl(oldUrl)) deleteUploadedFileByUrl(oldUrl, 'logos');
    await this.repo.upsert(ORG_LOGO_KEY, fileUrl, ORG_CATEGORY, updatedBy);
    return this.getOrgSettings();
  }

  async removeOrgLogo(updatedBy: string): Promise<IOrgSettings> {
    const current = await this.loadOrgValues();
    const oldUrl = current.get(ORG_LOGO_KEY);
    if (isUploadedLogoUrl(oldUrl)) deleteUploadedFileByUrl(oldUrl, 'logos');
    await this.repo.upsert(ORG_LOGO_KEY, '', ORG_CATEGORY, updatedBy);
    return this.getOrgSettings();
  }

  /** ใช้ตอนส่งอีเมลจริงเท่านั้น (mailer.ts เรียกผ่าน config provider ที่ผูกไว้ตอน bootstrap ใน server.ts) */
  async getSmtpConfig(): Promise<ISmtpRuntimeConfig> {
    const v = await this.loadOrgValues();
    return {
      host: v.get(SMTP_HOST_KEY) || env.SMTP_HOST,
      port: Number(v.get(SMTP_PORT_KEY)) || env.SMTP_PORT,
      secure: v.has(SMTP_SECURE_KEY) ? v.get(SMTP_SECURE_KEY) === 'true' : env.SMTP_SECURE,
      user: v.get(SMTP_USER_KEY) || env.SMTP_USER,
      pass: v.get(SMTP_PASS_KEY) || env.SMTP_PASS,
      fromEmail: v.get(SMTP_FROM_EMAIL_KEY) || env.SMTP_FROM_EMAIL,
      fromName: v.get(SMTP_FROM_NAME_KEY) || env.SMTP_FROM_NAME,
    };
  }

  private async loadOrgValues(): Promise<Map<string, string | null>> {
    const rows = await this.repo.findByCategories(ORG_SETTING_CATEGORIES);
    return new Map(rows.map((r) => [r.settingKey, r.settingValue]));
  }
}

export const systemSettingService = new SystemSettingService();
