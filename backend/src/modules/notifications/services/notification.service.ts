import { NotificationRepository } from '@modules/notifications/repositories/notification.repository';
import { buildTicketEmailHtml } from '@modules/notifications/templates/ticketEmail.template';
import { buildPasswordResetEmailHtml } from '@modules/notifications/templates/passwordResetEmail.template';
import { buildForgotPasswordEmailHtml } from '@modules/notifications/templates/forgotPasswordEmail.template';
import { buildTicketMessageText } from '@modules/notifications/templates/ticketMessage.template';
import { buildAssetLoanEmailHtml } from '@modules/notifications/templates/assetLoanEmail.template';
import { buildAssetLoanMessageText } from '@modules/notifications/templates/assetLoanMessage.template';
import { buildBackupEmailHtml } from '@modules/notifications/templates/backupEmail.template';
import { buildBackupMessageText } from '@modules/notifications/templates/backupMessage.template';
import { sendMail } from '@infrastructure/mailer/mailer';
import { sendTelegramMessage } from '@infrastructure/telegram/telegram.client';
import { sendLinePush } from '@infrastructure/line/line.client';
import { emitToUser } from '@infrastructure/socket/socket.server';
import { logger } from '@infrastructure/logger/logger';
import { env } from '@config/env';
import { prisma } from '@infrastructure/database/prisma';
import { normalizePagination, buildPaginatedResult } from '@common/utils/pagination';
import { systemSettingService } from '@modules/settings/services/systemSetting.service';
import { STAFF_ROLES } from '@common/constants/roles.const';
import { BadRequestError } from '@common/errors';
import type { ListNotificationLogsQueryDto } from '@modules/notifications/dto/notification.dto';
import type { NotificationChannel, NotificationStatus } from '@prisma/client';

const EXPORT_MAX_ROWS = 5000;

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

/** เหตุการณ์ realtime ที่ดันไปแค่ตารางรายการงานแจ้งซ่อมของแอดมิน/ช่าง (ไม่ผ่าน notification_logs/email/telegram/line เหมือน TicketNotificationEvent — เบากว่ามาก แค่ให้หน้าตารางที่เปิดค้างไว้อัปเดตสด) */
export type TicketLiveListEvent = 'ticket:created' | 'ticket:viewed';

export interface ITicketLiveListPayload {
  ticketId: string;
  ticketNumber: string;
  urgency?: string;
  viewedByUserId?: string;
  viewedByName?: string;
}

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

export type AssetLoanNotificationEvent = 'BORROWED' | 'RETURNED' | 'OVERDUE';

const ASSET_LOAN_EVENT_SETTING_KEY: Record<
  AssetLoanNotificationEvent,
  'notifyAssetBorrowed' | 'notifyAssetReturned' | 'notifyAssetOverdue'
> = {
  BORROWED: 'notifyAssetBorrowed',
  RETURNED: 'notifyAssetReturned',
  OVERDUE: 'notifyAssetOverdue',
};

const ASSET_LOAN_EVENT_LABEL_TH: Record<AssetLoanNotificationEvent, string> = {
  BORROWED: 'มีการยืมครุภัณฑ์-อุปกรณ์',
  RETURNED: 'มีการคืนครุภัณฑ์-อุปกรณ์',
  OVERDUE: 'ยืมครุภัณฑ์-อุปกรณ์เกินกำหนดคืน',
};

export type TestNotificationChannel = 'EMAIL' | 'TELEGRAM' | 'LINE' | 'PUSH';

export type BackupNotificationEvent = 'BACKUP_SUCCESS' | 'BACKUP_FAILED' | 'RESTORE_SUCCESS' | 'RESTORE_FAILED';

const BACKUP_EVENT_LABEL_TH: Record<BackupNotificationEvent, string> = {
  BACKUP_SUCCESS: 'สำรองข้อมูลสำเร็จ',
  BACKUP_FAILED: 'สำรองข้อมูลล้มเหลว',
  RESTORE_SUCCESS: 'กู้คืนข้อมูลสำเร็จ',
  RESTORE_FAILED: 'กู้คืนข้อมูลล้มเหลว',
};

interface IBackupNotificationPayload {
  fileName: string;
  scope: string;
  errorMessage?: string | null;
}

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
        // ส่งหาผู้รับแต่ละคนพร้อมกัน (ไม่ใช่ทีละคนตามลำดับ) — ตอนที่ทำเป็น sequential loop เจอว่าถ้ามีผู้รับเยอะ
        // (เช่น ไอที/ช่างทั้งหมด) ทำให้ตอบสนองการแจ้งซ่อมช้าลงมาก โดยเฉพาะช่วงคนใช้งานพร้อมกันหลายคน (วัดจาก load test)
        await Promise.all(
          recipients.map((r) => (r.telegramChatId ? this.sendTelegramPersonal(r.telegramChatId, text, 'RepairTicket', ticket.id) : Promise.resolve())),
        );
      }
      if (settings.lineEnabled) {
        await this.sendLine(text, 'RepairTicket', ticket.id);
        await Promise.all(
          recipients.map((r) => (r.lineUserId ? this.sendLinePersonal(r.lineUserId, text, 'RepairTicket', ticket.id) : Promise.resolve())),
        );
      }
    }

    // แจ้งเตือนในแอป (bell) + realtime push ผ่าน Socket.IO ให้ผู้ใช้ที่เกี่ยวข้อง — ทำงานอิสระจากช่องทางภายนอก (email/telegram/line)
    // ส่งพร้อมกันทุกคนเช่นกัน (เหตุผลเดียวกับ telegram/line ด้านบน)
    await Promise.all(
      recipients.map((r) =>
        this.pushInApp(r.userId, actionLabel, `[${ticket.ticketNumber}] ${statusNameTh}`, 'RepairTicket', ticket.id).catch(() => {
          // Socket.IO server อาจยังไม่ initialize (เช่นตอนรัน test) — ไม่ถือเป็นข้อผิดพลาดร้ายแรง
        }),
      ),
    );
  }

  /** เรียกจาก RepairTicketService ตอนสร้าง ticket ใหม่ และตอนมีคนเข้าดูรายละเอียดเป็นคนแรก — ดัน realtime ไปหาแอดมิน/ช่างที่
   *  ล็อกอินอยู่ทุกคน (ไม่จำกัดแค่ IT_OFFICER เหมือน resolveRecipients ของ NEW_TICKET) เพื่อให้สัญลักษณ์ "งานใหม่" กระพริบ/หยุด
   *  ในหน้าตารางแบบสดโดยไม่ต้อง refresh — แยกจาก notifyTicketEvent เพราะไม่ต้องบันทึก notification_logs/ส่ง email-telegram-line */
  async notifyTicketLiveList(event: TicketLiveListEvent, payload: ITicketLiveListPayload): Promise<void> {
    const staff = await prisma.user.findMany({
      where: { isActive: true, deletedAt: null, role: { code: { in: [...STAFF_ROLES] } } },
      select: { id: true },
    });
    for (const s of staff) {
      try {
        emitToUser(s.id, event, payload);
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

    // BORROWED/RETURNED (ไม่รวม OVERDUE ซึ่งมี flow แจ้งเตือนอัตโนมัติของตัวเองอยู่แล้ว) ต้องแจ้งเจ้าหน้าที่ไอทีด้วย
    // เดิมแจ้งแค่ผู้ยืม — สำคัญมากขึ้นตอนนี้เพราะพนักงานทั่วไปยืม-คืนเองผ่านสแกน QR ได้แล้ว (ไม่ผ่าน IT บันทึกให้เหมือนก่อน)
    const notifyItOfficers = event === 'BORROWED' || event === 'RETURNED';
    const itOfficers = notifyItOfficers ? await this.resolveItOfficers() : [];

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
      await Promise.all(itOfficers.map((o) => this.sendEmail(o.email, subject, html, 'AssetLoan', loan.id)));
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

    // แจ้งเตือนในแอป (bell) + realtime push ผ่าน Socket.IO ให้ผู้ยืม + เจ้าหน้าที่ไอที — ทำงานอิสระจากช่องทางภายนอก (email/telegram/line)
    for (const userId of [loan.borrower.id, ...itOfficers.map((o) => o.id)]) {
      try {
        await this.pushInApp(userId, actionLabel, `${assetLabel} — ${actionLabel}`, 'AssetLoan', loan.id);
      } catch {
        // Socket.IO server อาจยังไม่ initialize (เช่นตอนรัน test) — ไม่ถือเป็นข้อผิดพลาดร้ายแรง
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

  /**
   * เรียกจาก BackupService หลังทำ backup/restore เสร็จเสมอ (ไม่ว่าสำเร็จหรือล้มเหลว) — แจ้งเฉพาะ SUPER_ADMIN ที่ active
   * เท่านั้น (ต่างจาก resolveItOfficers ของยืม-คืนครุภัณฑ์ เพราะ backup/restore เข้าถึงข้อมูลทั้งฐานข้อมูลและเป็นปฏิบัติการ
   * ที่เสี่ยงทำลายข้อมูลได้ จึงจำกัดเฉพาะสิทธิ์สูงสุดในระบบ) กรณีล้มเหลว (BACKUP_FAILED/RESTORE_FAILED) ส่งอีเมลเสมอ
   * ไม่เช็ค settings.emailEnabled เพราะ severity สูงพอไม่ควรพึ่ง toggle เดียวกับการแจ้งเตือนทั่วไป
   */
  async notifyBackupEvent(event: BackupNotificationEvent, payload: IBackupNotificationPayload): Promise<void> {
    const isFailure = event === 'BACKUP_FAILED' || event === 'RESTORE_FAILED';
    const settings = await systemSettingService.getNotificationSettings();
    const superAdmins = await prisma.user.findMany({
      where: { isActive: true, deletedAt: null, role: { code: 'SUPER_ADMIN' } },
      select: { id: true, email: true },
    });
    if (superAdmins.length === 0) return;

    const actionLabel = BACKUP_EVENT_LABEL_TH[event];
    const detailUrl = `${env.FRONTEND_BASE_URL}/settings/backup`;
    const errorMessage = payload.errorMessage ?? null;

    if (isFailure || settings.emailEnabled) {
      const html = buildBackupEmailHtml({ actionLabel, fileName: payload.fileName, scope: payload.scope, errorMessage, detailUrl, isFailure });
      const subject = `[สำรอง/กู้คืนข้อมูล] ${actionLabel}`;
      await Promise.all(superAdmins.map((a) => this.sendEmail(a.email, subject, html, 'BackupLog')));
    }

    if (settings.telegramEnabled || settings.lineEnabled) {
      const text = buildBackupMessageText({ actionLabel, fileName: payload.fileName, scope: payload.scope, errorMessage, detailUrl, isFailure });
      if (settings.telegramEnabled) await this.sendTelegram(text, 'BackupLog');
      if (settings.lineEnabled) await this.sendLine(text, 'BackupLog');
    }

    await Promise.all(
      superAdmins.map((a) =>
        this.pushInApp(a.id, actionLabel, `${payload.fileName} — ${actionLabel}`, 'BackupLog').catch(() => {
          // Socket.IO server อาจยังไม่ initialize (เช่นตอนรัน test) — ไม่ถือเป็นข้อผิดพลาดร้ายแรง
        }),
      ),
    );
  }

  /**
   * ส่งข้อความทดสอบตามช่องทางที่ระบุ ใช้ค่าที่ "บันทึกไว้แล้ว" เท่านั้น (ไม่รับค่าฉบับร่างที่ยังไม่ได้บันทึกจากฟอร์ม)
   * เรียก client ของแต่ละช่องทางตรงๆ (ไม่ผ่าน sendEmail/sendTelegram/sendLine ส่วนตัวที่กลืน error ทิ้งเพื่อไม่ให้
   * business transaction ล้มเหลว) เพื่อให้ error จริงสะท้อนกลับไปหน้าเว็บทันที ผู้ดูแลระบบจะได้รู้ว่าตั้งค่าผิดตรงไหน
   */
  async sendTestNotification(channel: TestNotificationChannel, requestedBy: { id: string; fullName: string }): Promise<void> {
    const testText = `นี่คือข้อความทดสอบจากระบบ IT Service Desk — ทดสอบโดย ${requestedBy.fullName} เมื่อ ${new Date().toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}`;

    try {
      switch (channel) {
        case 'EMAIL': {
          const user = await prisma.user.findUnique({ where: { id: requestedBy.id }, select: { email: true } });
          if (!user?.email) throw new Error('บัญชีผู้ใช้ปัจจุบันไม่มีอีเมลที่ใช้ทดสอบได้');
          await sendMail({ to: user.email, subject: '[ทดสอบ] การแจ้งเตือนระบบ IT Service Desk', html: buildTestEmailHtml(testText) });
          break;
        }
        case 'TELEGRAM': {
          const config = await systemSettingService.getTelegramConfig();
          if (!config) throw new Error('ยังไม่ได้ตั้งค่า Bot Token/Chat ID ให้ครบ');
          await sendTelegramMessage(config.botToken, config.chatId, testText);
          break;
        }
        case 'LINE': {
          const config = await systemSettingService.getLineConfig();
          if (!config) throw new Error('ยังไม่ได้ตั้งค่า Channel Access Token/Group ID ให้ครบ');
          await sendLinePush(config.accessToken, config.targetId, testText);
          break;
        }
        case 'PUSH': {
          await this.pushInApp(requestedBy.id, 'ทดสอบการแจ้งเตือน', testText, 'Test');
          break;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new BadRequestError(`ทดสอบส่งไม่สำเร็จ: ${message}`, 'TEST_NOTIFICATION_FAILED');
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

  /** เรียกจาก AuthService.forgotPassword() — ส่งลิงก์ตั้งรหัสผ่านใหม่แบบ self-service (ต่างจาก sendPasswordResetEmail ที่ admin กดให้) */
  async sendForgotPasswordEmail(
    user: { fullName: string; username: string; email: string },
    resetToken: string,
    expiresInMinutes: number,
  ): Promise<void> {
    const resetUrl = `${env.FRONTEND_BASE_URL}/auth/reset-password?token=${encodeURIComponent(resetToken)}`;
    const html = buildForgotPasswordEmailHtml({ fullName: user.fullName, username: user.username, resetUrl, expiresInMinutes });
    const subject = 'คำขอตั้งรหัสผ่านใหม่ — IT Service Desk';
    await this.sendEmail(user.email, subject, html);
  }

  /** เจ้าหน้าที่ไอทีที่ยังใช้งานอยู่ทุกคน — ใช้แจ้งเตือนเหตุการณ์ยืม-คืนอุปกรณ์ (คู่ขนานกับ resolveRecipients ของใบแจ้งซ่อม) */
  private async resolveItOfficers(): Promise<{ id: string; email: string }[]> {
    return prisma.user.findMany({
      where: { isActive: true, deletedAt: null, role: { code: 'IT_OFFICER' } },
      select: { id: true, email: true },
    });
  }

  private async resolveRecipients(
    event: TicketNotificationEvent,
    ticket: ITicketForNotification,
  ): Promise<{ userId: string; email: string; telegramChatId: string | null; lineUserId: string | null }[]> {
    const recipients = new Map<string, string>();

    if (event === 'NEW_TICKET') {
      // แจ้งทุก role เจ้าหน้าที่ (แอดมิน/ไอที/ช่าง) ไม่ใช่แค่ IT_OFFICER เหมือนเดิม — ให้สอดคล้องกับสัญลักษณ์งานใหม่ที่แจ้งกลุ่มนี้เหมือนกัน
      const officers = await prisma.user.findMany({
        where: { isActive: true, deletedAt: null, role: { code: { in: [...STAFF_ROLES] } } },
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

  async listLogsForExport(filter: { channel?: NotificationChannel; status?: NotificationStatus }) {
    const { items } = await this.repo.findMany({ channel: filter.channel, status: filter.status }, 0, EXPORT_MAX_ROWS);
    return items;
  }

  /**
   * บันทึกแจ้งเตือนในแอป (bell) ลง notification_logs ด้วย channel="PUSH" (recipient = userId แทนอีเมล/chat id)
   * แล้วยิง realtime ผ่าน Socket.IO ทันทีถ้า client เชื่อมต่ออยู่ — ต่างจาก email/telegram/line ตรงที่ไม่มีทางส่ง "ไม่สำเร็จ"
   * (แค่บันทึกลง DB) จึง mark เป็น SENT ทันที
   */
  private async pushInApp(
    userId: string,
    title: string,
    message: string,
    relatedEntityType?: string,
    relatedEntityId?: string,
  ): Promise<void> {
    const log = await this.repo.create({ channel: 'PUSH', recipient: userId, subject: title, message, relatedEntityType, relatedEntityId });
    await this.repo.markSent(log.id);

    try {
      emitToUser(userId, 'notification:new', {
        id: log.id,
        title,
        message,
        relatedEntityType: relatedEntityType ?? null,
        relatedEntityId: relatedEntityId ?? null,
        createdAt: log.createdAt,
      });
    } catch {
      // Socket.IO server อาจยังไม่ initialize (เช่นตอนรัน test) — ไม่ถือเป็นข้อผิดพลาดร้ายแรง
    }
  }

  /** รายการแจ้งเตือนในแอป (bell) ของผู้ใช้ปัจจุบัน — เฉพาะ channel="PUSH" ของตนเองเท่านั้น */
  async listMyNotifications(userId: string, pagination: { page?: number; limit?: number; unreadOnly?: boolean }) {
    const normalized = normalizePagination(pagination);
    const { items, total } = await this.repo.findManyForUser(userId, normalized.skip, normalized.take, pagination.unreadOnly);
    return buildPaginatedResult(items, total, normalized);
  }

  async getMyUnreadCount(userId: string): Promise<number> {
    return this.repo.countUnreadForUser(userId);
  }

  async markMyNotificationRead(userId: string, id: string): Promise<void> {
    await this.repo.markReadForUser(userId, id);
  }

  async markAllMyNotificationsRead(userId: string): Promise<void> {
    await this.repo.markAllReadForUser(userId);
  }
}

export const notificationService = new NotificationService();

/** HTML แบบง่าย ไม่ต้องมีแบรนด์เต็มรูปแบบเหมือนอีเมลจริง เพราะเป็นแค่ข้อความ ping ตรวจสอบว่าตั้งค่า SMTP ถูกต้องหรือไม่ */
function buildTestEmailHtml(testText: string): string {
  return `
<!DOCTYPE html>
<html lang="th">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:24px;background-color:#F7FAF8;font-family:'Segoe UI',Tahoma,sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
    <div style="background-color:#006C45;padding:20px 24px;">
      <span style="color:#FFFFFF;font-size:16px;font-weight:600;">IT Service Desk — สำนักงานสาธารณสุขจังหวัดนครราชสีมา</span>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 8px;color:#111827;font-size:18px;font-weight:600;">ทดสอบการแจ้งเตือน</p>
      <p style="margin:0;color:#6B7280;font-size:14px;">${testText}</p>
    </div>
  </div>
</body>
</html>`;
}
