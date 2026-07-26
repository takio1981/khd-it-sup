import { SystemSettingRepository } from '@modules/settings/repositories/systemSetting.repository';
import type { UpdateNotificationSettingsDto } from '@modules/settings/dto/systemSetting.dto';
import { env } from '@config/env';

const CATEGORY = 'notification';

const BOOL_KEYS = {
  emailEnabled: 'notification.email.enabled',
  telegramEnabled: 'notification.telegram.enabled',
  lineEnabled: 'notification.line.enabled',
  notifyNewTicket: 'notification.event.new_ticket',
  notifyAssign: 'notification.event.assign',
  notifyStatusChange: 'notification.event.status_change',
  notifyComplete: 'notification.event.complete',
  notifyCancel: 'notification.event.cancel',
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
}

export const systemSettingService = new SystemSettingService();
