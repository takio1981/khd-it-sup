import { NotificationRepository } from '@modules/notifications/repositories/notification.repository';
import { buildTicketEmailHtml } from '@modules/notifications/templates/ticketEmail.template';
import { buildPasswordResetEmailHtml } from '@modules/notifications/templates/passwordResetEmail.template';
import { buildTicketMessageText } from '@modules/notifications/templates/ticketMessage.template';
import { buildAssetLoanEmailHtml } from '@modules/notifications/templates/assetLoanEmail.template';
import { buildAssetLoanMessageText } from '@modules/notifications/templates/assetLoanMessage.template';
import { sendMail } from '@infrastructure/mailer/mailer';
import { sendTelegramMessage } from '@infrastructure/telegram/telegram.client';
import { sendLinePush } from '@infrastructure/line/line.client';
import { emitToUser } from '@infrastructure/socket/socket.server';
import { logger } from '@infrastructure/logger/logger';
import { env } from '@config/env';
import { prisma } from '@infrastructure/database/prisma';
import { normalizePagination, buildPaginatedResult } from '@common/utils/pagination';
import { systemSettingService } from '@modules/settings/services/systemSetting.service';
import type { ListNotificationLogsQueryDto } from '@modules/notifications/dto/notification.dto';

export type TicketNotificationEvent = 'NEW_TICKET' | 'ASSIGN' | 'STATUS_CHANGE' | 'COMPLETE' | 'CANCEL';

const EVENT_SETTING_KEY: Record<TicketNotificationEvent, 'notifyNewTicket' | 'notifyAssign' | 'notifyStatusChange' | 'notifyComplete' | 'notifyCancel'> = {
  NEW_TICKET: 'notifyNewTicket',
  ASSIGN: 'notifyAssign',
  STATUS_CHANGE: 'notifyStatusChange',
  COMPLETE: 'notifyComplete',
  CANCEL: 'notifyCancel',
};

const EVENT_LABEL_TH: Record<TicketNotificationEvent, string> = {
  NEW_TICKET: 'มีใบแจ้งซ่อมใหม่เข้าระบบ',
  ASSIGN: 'มีการมอบหมายงานซ่อมให้คุณ',
  STATUS_CHANGE: 'สถานะงานซ่อมของคุณมีการเปลี่ยนแปลง',
  COMPLETE: 'งานซ่อมของคุณเสร็จสิ้นแล้ว',
  CANCEL: 'ใบแจ้งซ่อมถูกยกเลิก',
};

interface ITicketForNotification {
  id: string;
  ticketNumber: string;
  description: string;
  urgency: string;
  status: string;
  reportedBy: { id: string; fullName: string; email?: string | null } | null;
  assignedTechnician?: { id: string; fullName: string; email?: string | null } | null;
  asset: { assetNumber: string; model: string | null; brand: string | null } | null;
}

export type AssetLoanNotificationEvent = 'BORROWED' | 'RETURNED';

const ASSET_LOAN_EVENT_SETTING_KEY: Record<AssetLoanNotificationEvent, 'notifyAssetBorrowed' | 'notifyAssetReturned'> = {
  BORROWED: 'notifyAssetBorrowed',
  RETURNED: 'notifyAssetReturned',
};

const ASSET_LOAN_EVENT_LABEL_TH: Record<AssetLoanNotificationEvent, string> = {
  BORROWED: 'มีการยืมครุภัณฑ์-อุปกรณ์',
  RETURNED: 'มีการคืนครุภัณฑ์-อุปกรณ์',
};

interface IAssetLoanForNotification {
  id: string;
  asset: { assetNumber: string; brand: string | null; model: string | null };
  borrower: { id: string; fullName: string; email: string };
  borrowDate: Date;
  expectedReturnDate: Date | null;
  actualReturnDate: Date | null;
  purpose: string | null;
  conditionOnBorrow: string | null;
  conditionOnReturn: string | null;
}

/**
 * Notification Service — ช่องทาง Email (Gmail SMTP) ใช้งานได้เต็มรูปแบบใน Phase นี้
 * Telegram/LINE เป็น interface เดียวกัน (channel enum พร้อมใน schema) แต่ client จริงจะเพิ่มใน Phase ถัดไป
 * ทุกการแจ้งเตือนถูกบันทึกลง notification_logs เสมอ ไม่ว่าจะส่งสำเร็จหรือไม่ (audit trail สำหรับ "Notification Timeline")
 */
export class NotificationService {
  private readonly repo = new NotificationRepository();

  private async sendEmail(
    to: string,
    subject: string,
    html: string,
    relatedEntityType?: string,
    relatedEntityId?: string,
  ): Promise<void> {
    const log = await this.repo.create({ channel: 'EMAIL', recipient: to, subject, message: html, relatedEntityType, relatedEntityId });
    try {
      await sendMail({ to, subject, html });
      await this.repo.markSent(log.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`[notification] ส่งอีเมลไม่สำเร็จถึง ${to}: ${message}`);
      await this.repo.markFailed(log.id, message);
    }
  }

  /** เรียกจาก RepairTicketService หลัง commit transaction สำเร็จเสมอ (ไม่ block flow หลักถ้าแจ้งเตือนล้มเหลว) */
  async notifyTicketEvent(event: TicketNotificationEvent, ticket: ITicketForNotification, statusNameTh: string): Promise<void> {
    const settings = await systemSettingService.getNotificationSettings();
    if (!settings[EVENT_SETTING_KEY[event]]) return;

    const detailUrl = `${env.FRONTEND_BASE_URL}/repair-tickets/${ticket.id}`;
    const assetLabel = ticket.asset ? `${ticket.asset.assetNumber} — ${ticket.asset.brand ?? ''} ${ticket.asset.model ?? ''}`.trim() : null;
    const actionLabel = EVENT_LABEL_TH[event];

    const recipients = await this.resolveRecipients(event, ticket);

    if (settings.emailEnabled) {
      const html = buildTicketEmailHtml({
        ticketNumber: ticket.ticketNumber,
        description: ticket.description,
        urgency: ticket.urgency,
        statusNameTh,
        reporterName: ticket.reportedBy?.fullName ?? 'ไม่ระบุ',
        assetLabel,
        actionLabel,
        detailUrl,
      });
      const subject = `[${ticket.ticketNumber}] ${actionLabel}`;
      await Promise.all(recipients.map((r) => this.sendEmail(r.email, subject, html, 'RepairTicket', ticket.id)));
    }

    if (settings.telegramEnabled || settings.lineEnabled) {
      const text = buildTicketMessageText({
        ticketNumber: ticket.ticketNumber,
        description: ticket.description,
        urgency: ticket.urgency,
        statusNameTh,
        reporterName: ticket.reportedBy?.fullName ?? 'ไม่ระบุ',
        assetLabel,
        actionLabel,
        detailUrl,
      });
      if (settings.telegramEnabled) {
        await this.sendTelegram(text, 'RepairTicket', ticket.id);
        for (const r of recipients) {
          if (r.telegramChatId) await this.sendTelegramPersonal(r.telegramChatId, text, 'RepairTicket', ticket.id);
        }
      }
      if (settings.lineEnabled) {
        await this.sendLine(text, 'RepairTicket', ticket.id);
        for (const r of recipients) {
          if (r.lineUserId) await this.sendLinePersonal(r.lineUserId, text, 'RepairTicket', ticket.id);
        }
      }
    }

    // Realtime push ผ่าน Socket.IO ให้ผู้ใช้ที่เกี่ยวข้อง (ถ้า client เชื่อมต่ออยู่) — ทำงานอิสระจากช่องทางภายนอก (email/telegram/line)
    for (const r of recipients) {
      try {
        emitToUser(r.userId, 'ticket:notification', { ticketId: ticket.id, ticketNumber: ticket.ticketNumber, event, statusNameTh });
      } catch {
        // Socket.IO server อาจยังไม่ initialize (เช่นตอนรัน test) — ไม่ถือเป็นข้อผิดพลาดร้ายแรง
      }
    }
  }

  /** เรียกจาก AssetLoanService หลังบันทึกยืม/คืนสำเร็จเสมอ (ไม่ block flow หลักถ้าแจ้งเตือนล้มเหลว) */
  async notifyAssetLoanEvent(event: AssetLoanNotificationEvent, loan: IAssetLoanForNotification): Promise<void> {
    const settings = await systemSettingService.getNotificationSettings();
    if (!settings[ASSET_LOAN_EVENT_SETTING_KEY[event]]) return;

    const assetLabel = `${loan.asset.assetNumber} — ${loan.asset.brand ?? ''} ${loan.asset.model ?? ''}`.trim();
    const actionLabel = ASSET_LOAN_EVENT_LABEL_TH[event];
    const detailUrl = `${env.FRONTEND_BASE_URL}/asset-loans`;

    if (settings.emailEnabled && loan.borrower.email) {
      const html = buildAssetLoanEmailHtml({
        assetLabel,
        borrowerName: loan.borrower.fullName,
        actionLabel,
        borrowDate: loan.borrowDate,
        expectedReturnDate: loan.expectedReturnDate,
        actualReturnDate: loan.actualReturnDate,
        purpose: loan.purpose,
        conditionOnBorrow: loan.conditionOnBorrow,
        conditionOnReturn: loan.conditionOnReturn,
        detailUrl,
      });
      const subject = `[ยืมครุภัณฑ์-อุปกรณ์] ${actionLabel}`;
      await this.sendEmail(loan.borrower.email, subject, html, 'AssetLoan', loan.id);
    }

    if (settings.telegramEnabled || settings.lineEnabled) {
      const text = buildAssetLoanMessageText({
        assetLabel,
        borrowerName: loan.borrower.fullName,
        actionLabel,
        borrowDate: loan.borrowDate,
        expectedReturnDate: loan.expectedReturnDate,
        actualReturnDate: loan.actualReturnDate,
        purpose: loan.purpose,
        conditionOnBorrow: loan.conditionOnBorrow,
        conditionOnReturn: loan.conditionOnReturn,
        detailUrl,
      });

      const borrowerChannels = await prisma.user.findUnique({
        where: { id: loan.borrower.id },
        select: { telegramChatId: true, lineUserId: true },
      });

      if (settings.telegramEnabled) {
        await this.sendTelegram(text, 'AssetLoan', loan.id);
        if (borrowerChannels?.telegramChatId) {
          await this.sendTelegramPersonal(borrowerChannels.telegramChatId, text, 'AssetLoan', loan.id);
        }
      }
      if (settings.lineEnabled) {
        await this.sendLine(text, 'AssetLoan', loan.id);
        if (borrowerChannels?.lineUserId) {
          await this.sendLinePersonal(borrowerChannels.lineUserId, text, 'AssetLoan', loan.id);
        }
      }
    }
  }

  /** ส่งข้อความ Telegram เข้าแชท/กลุ่มที่ตั้งค่าไว้ (broadcast เดียว ไม่ผูกรายบุคคล) */
  private async sendTelegram(text: string, relatedEntityType?: string, relatedEntityId?: string): Promise<void> {
    const config = await systemSettingService.getTelegramConfig();
    const log = await this.repo.create({
      channel: 'TELEGRAM',
      recipient: config?.chatId ?? 'ยังไม่ได้ตั้งค่า',
      message: text,
      relatedEntityType,
      relatedEntityId,
    });
    try {
      if (!config) throw new Error('Telegram ยังไม่ได้ตั้งค่า Bot Token/Chat ID');
      await sendTelegramMessage(config.botToken, config.chatId, text);
      await this.repo.markSent(log.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`[notification] ส่ง Telegram ไม่สำเร็จ: ${message}`);
      await this.repo.markFailed(log.id, message);
    }
  }

  /** ส่งข้อความ LINE เข้ากลุ่ม/แชทเดียวที่ตั้งค่าไว้ (push ไม่ใช่ broadcast เพราะต้องเข้าถึง group chat ได้) */
  private async sendLine(text: string, relatedEntityType?: string, relatedEntityId?: string): Promise<void> {
    const config = await systemSettingService.getLineConfig();
    const log = await this.repo.create({
      channel: 'LINE',
      recipient: config?.targetId ?? 'ยังไม่ได้ตั้งค่า',
      message: text,
      relatedEntityType,
      relatedEntityId,
    });
    try {
      if (!config) throw new Error('LINE ยังไม่ได้ตั้งค่า Channel Access Token/Group ID');
      await sendLinePush(config.accessToken, config.targetId, text);
      await this.repo.markSent(log.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`[notification] ส่ง LINE ไม่สำเร็จ: ${message}`);
      await this.repo.markFailed(log.id, message);
    }
  }

  /** ส่ง Telegram ตรงถึง Chat ID ส่วนตัวของผู้ใช้แต่ละคน (คู่ขนานกับกลุ่มไอทีกลาง ใช้ Bot Token เดียวกัน) */
  private async sendTelegramPersonal(chatId: string, text: string, relatedEntityType?: string, relatedEntityId?: string): Promise<void> {
    const config = await systemSettingService.getTelegramConfig();
    if (!config) return; // ไม่มี Bot Token ตั้งค่าไว้ — sendTelegram (กลุ่มกลาง) จะ log ความล้มเหลวนี้ให้แล้ว ไม่ต้อง log ซ้ำ
    const log = await this.repo.create({ channel: 'TELEGRAM', recipient: chatId, message: text, relatedEntityType, relatedEntityId });
    try {
      await sendTelegramMessage(config.botToken, chatId, text);
      await this.repo.markSent(log.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`[notification] ส่ง Telegram ส่วนตัวไม่สำเร็จ (${chatId}): ${message}`);
      await this.repo.markFailed(log.id, message);
    }
  }

  /** ส่ง LINE push ตรงถึง User ID ส่วนตัวของผู้ใช้แต่ละคน (คู่ขนานกับกลุ่มไอทีกลาง ใช้ Channel Access Token เดียวกัน) */
  private async sendLinePersonal(userId: string, text: string, relatedEntityType?: string, relatedEntityId?: string): Promise<void> {
    const config = await systemSettingService.getLineConfig();
    if (!config) return; // ไม่มี Channel Access Token ตั้งค่าไว้ — sendLine (กลุ่มกลาง) จะ log ความล้มเหลวนี้ให้แล้ว ไม่ต้อง log ซ้ำ
    const log = await this.repo.create({ channel: 'LINE', recipient: userId, message: text, relatedEntityType, relatedEntityId });
    try {
      await sendLinePush(config.accessToken, userId, text);
      await this.repo.markSent(log.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`[notification] ส่ง LINE ส่วนตัวไม่สำเร็จ (${userId}): ${message}`);
      await this.repo.markFailed(log.id, message);
    }
  }

  /** เรียกจาก UserService หลังรีเซ็ตรหัสผ่านสำเร็จ — ส่งรหัสผ่านชั่วคราวไปยังอีเมลผู้ใช้แทนการแสดงให้ admin คัดลอก */
  async sendPasswordResetEmail(user: { fullName: string; username: string; email: string }, temporaryPassword: string): Promise<void> {
    const html = buildPasswordResetEmailHtml({
      fullName: user.fullName,
      username: user.username,
      temporaryPassword,
      loginUrl: `${env.FRONTEND_BASE_URL}/auth/login`,
    });
    const subject = 'รหัสผ่านชั่วคราวสำหรับเข้าใช้งานระบบ IT Service Desk';
    await this.sendEmail(user.email, subject, html);
  }

  private async resolveRecipients(
    event: TicketNotificationEvent,
    ticket: ITicketForNotification,
  ): Promise<{ userId: string; email: string; telegramChatId: string | null; lineUserId: string | null }[]> {
    const recipients = new Map<string, string>();

    if (event === 'NEW_TICKET') {
      const officers = await prisma.user.findMany({
        where: { isActive: true, deletedAt: null, role: { code: 'IT_OFFICER' } },
        select: { id: true, email: true },
      });
      officers.forEach((o) => recipients.set(o.id, o.email));
    }

    if (ticket.reportedBy?.email && ['STATUS_CHANGE', 'COMPLETE', 'CANCEL'].includes(event)) {
      recipients.set(ticket.reportedBy.id, ticket.reportedBy.email);
    }

    if (event === 'ASSIGN' && ticket.assignedTechnician?.email) {
      recipients.set(ticket.assignedTechnician.id, ticket.assignedTechnician.email);
    }

    if (recipients.size === 0) return [];

    // ดึงช่องทางส่วนตัว (Telegram/LINE) ของผู้รับแต่ละคนเพิ่มเติมจาก email — ทำแยกจาก query หลักเพื่อไม่ให้ ticketListInclude
    // ต้อง select ฟิลด์ส่วนตัวนี้ (ซึ่งจะรั่วไปกับ response ของ list/detail API ที่ frontend เรียกใช้ตรง ๆ)
    const channels = await prisma.user.findMany({
      where: { id: { in: Array.from(recipients.keys()) } },
      select: { id: true, telegramChatId: true, lineUserId: true },
    });
    const channelById = new Map(channels.map((c) => [c.id, c]));

    return Array.from(recipients.entries()).map(([userId, email]) => ({
      userId,
      email,
      telegramChatId: channelById.get(userId)?.telegramChatId ?? null,
      lineUserId: channelById.get(userId)?.lineUserId ?? null,
    }));
  }

  async listLogs(query: ListNotificationLogsQueryDto) {
    const pagination = normalizePagination(query);
    const { items, total } = await this.repo.findMany({ channel: query.channel, status: query.status }, pagination.skip, pagination.take);
    return buildPaginatedResult(items, total, pagination);
  }
}

export const notificationService = new NotificationService();
