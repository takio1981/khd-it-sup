import path from 'node:path';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import type { BackupLog, Prisma } from '@prisma/client';
import { prisma } from '@infrastructure/database/prisma';
import { BackupRepository } from '@modules/backup/repositories/backup.repository';
import { SystemSettingRepository } from '@modules/settings/repositories/systemSetting.repository';
import { isMariadbClientAvailable, runDump, runRestore } from '@modules/backup/utils/mariadbCli.util';
import { auditLogService } from '@modules/audit-log/services/auditLog.service';
import { notificationService } from '@modules/notifications/services/notification.service';
import { logger } from '@infrastructure/logger/logger';
import { env } from '@config/env';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '@common/errors';
import { normalizePagination, buildPaginatedResult } from '@common/utils/pagination';
import type { IRequestContext } from '@common/interfaces';
import type { ListBackupLogsQueryDto, RestoreDto, RunBackupDto, UpdateBackupSettingsDto } from '@modules/backup/dto/backup.dto';

const CATEGORY = 'backup';
const ENABLED_KEY = 'backup.schedule.enabled';
const SCOPE_KEY = 'backup.schedule.scope';
const TABLES_KEY = 'backup.schedule.included_tables';
const RETENTION_KEY = 'backup.retention_days';

type BackupOperationType = 'MANUAL' | 'AUTOMATIC' | 'SAFETY';
type BackupScopeValue = 'FULL' | 'PARTIAL';

export interface IBackupSettings {
  enabled: boolean;
  scope: BackupScopeValue;
  includedTables: string[];
  retentionDays: number;
}

export interface IBackupStatus {
  isRunning: boolean;
  currentOperation: 'BACKUP' | 'RESTORE' | null;
  startedAt: string | null;
  mariadbClientAvailable: boolean;
}

interface IRunState {
  isRunning: boolean;
  currentOperation: 'BACKUP' | 'RESTORE' | null;
  startedAt: Date | null;
}

function buildFileName(prefix: 'backup' | 'safety'): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return `${prefix}_${ts}_${randomUUID().slice(0, 8)}.sql`;
}

/**
 * สำรอง/กู้คืนข้อมูล — orchestration เต็มรูปแบบ (dump/restore ผ่าน mariadbCli.util, lock กันงานซ้อนกัน,
 * audit log, แจ้งเตือน SUPER_ADMIN, retention sweep) ใช้ in-memory lock เดียวกับรูปแบบของ equipment-sync
 * (deployment เป็น backend container เดียว ไม่มี replica จึงไม่มีปัญหา lock ค้างข้ามเครื่อง)
 *
 * Restore เป็นปฏิบัติการทำลายข้อมูลจริงได้ — ทุกครั้งต้อง re-authenticate ด้วยรหัสผ่านผู้ใช้ปัจจุบัน + พิมพ์ชื่อไฟล์
 * ยืนยันให้ตรงเป๊ะ + สำรองข้อมูลนิรภัย (SAFETY) แบบเต็มก่อนเสมอโดยไม่มี field ให้ปิดใน DTO เลย
 */
export class BackupService {
  private readonly repo = new BackupRepository();
  private readonly settingsRepo = new SystemSettingRepository();

  private readonly state: IRunState = {
    isRunning: false,
    currentOperation: null,
    startedAt: null,
  };

  async getStatus(): Promise<IBackupStatus> {
    const mariadbClientAvailable = await isMariadbClientAvailable();
    return {
      isRunning: this.state.isRunning,
      currentOperation: this.state.currentOperation,
      startedAt: this.state.startedAt?.toISOString() ?? null,
      mariadbClientAvailable,
    };
  }

  private lock(operation: 'BACKUP' | 'RESTORE'): void {
    this.state.isRunning = true;
    this.state.currentOperation = operation;
    this.state.startedAt = new Date();
  }

  private unlock(): void {
    this.state.isRunning = false;
    this.state.currentOperation = null;
    this.state.startedAt = null;
  }

  // ---------------------------------------------------------------------------------
  // Backup
  // ---------------------------------------------------------------------------------

  async runManual(dto: RunBackupDto, ctx: IRequestContext): Promise<{ started: true }> {
    if (this.state.isRunning) {
      throw new ConflictError('กำลังมีการสำรอง/กู้คืนข้อมูลทำงานอยู่ กรุณารอให้เสร็จก่อน');
    }
    this.lock('BACKUP');
    this.performBackup('MANUAL', dto.scope, dto.includedTables, ctx)
      .catch((err) => {
        logger.error(`[backup] สำรองข้อมูลล้มเหลว (manual): ${err instanceof Error ? err.message : String(err)}`);
      })
      .finally(() => this.unlock());
    return { started: true };
  }

  /** เรียกจาก backup.job.ts (cron 03:00 Asia/Bangkok) — ข้าม run นี้เงียบๆ ถ้าปิดใช้งานอยู่หรือมีงานอื่นทำงานอยู่ */
  async runScheduled(): Promise<void> {
    if (this.state.isRunning) {
      logger.warn('[backup] ข้าม schedule run เพราะมีการสำรอง/กู้คืนข้อมูลทำงานอยู่แล้ว');
      return;
    }
    const settings = await this.getSettings();
    if (!settings.enabled) {
      logger.info('[backup] ข้ามสำรองข้อมูลอัตโนมัติ (ปิดใช้งานอยู่ในหน้าตั้งค่า)');
      return;
    }

    this.lock('BACKUP');
    try {
      await this.performBackup('AUTOMATIC', settings.scope, settings.includedTables);
    } catch (err) {
      logger.error(`[backup] สำรองข้อมูลล้มเหลว (scheduled): ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      this.unlock();
    }

    await this.sweepRetention(settings.retentionDays).catch((err) => {
      logger.error(`[backup] ลบไฟล์สำรองข้อมูลเก่าล้มเหลว: ${err instanceof Error ? err.message : String(err)}`);
    });
  }

  /**
   * งานจริง (ไม่จัดการ lock เอง — ผู้เรียกต้อง lock ไว้ก่อนเสมอ) เพราะถูกเรียกซ้อนจาก performRestore()
   * เป็น SAFETY backup ระหว่างที่ lock ของ RESTORE ถูกถืออยู่แล้ว ถ้าฟังก์ชันนี้ unlock เอง จะปลด lock ก่อนเวลา
   * อันควร (restore จริงยังไม่ทันเริ่ม)
   */
  private async performBackup(
    type: BackupOperationType,
    scope: BackupScopeValue,
    includedTables: string[] | undefined,
    ctx?: IRequestContext,
  ): Promise<BackupLog> {
    const startedAt = new Date();
    const fileName = buildFileName(type === 'SAFETY' ? 'safety' : 'backup');
    const filePath = path.join(env.BACKUP_DIR, fileName);
    const tables = scope === 'PARTIAL' ? includedTables : undefined;

    const log = await this.repo.create({
      action: 'BACKUP',
      type,
      scope,
      includedTables: tables as Prisma.InputJsonValue | undefined,
      fileName,
      status: 'FAILED', // อัปเดตเป็น SUCCESS ท้ายสุดถ้าสำเร็จ — กันเคส process ล่มกลางทางค้างเป็นสถานะไม่ชัดเจนตลอดไป
      triggeredBy: ctx?.user.id,
      startedAt,
    });

    try {
      await fs.mkdir(env.BACKUP_DIR, { recursive: true });
      await runDump({ tables, outputPath: filePath });
      const stat = await fs.stat(filePath);
      const finishedAt = new Date();
      const updated = await this.repo.update(log.id, { status: 'SUCCESS', fileSizeBytes: BigInt(stat.size), finishedAt });

      const scopeLabel = scope === 'FULL' ? 'ทั้งหมด' : 'เฉพาะบางตาราง';
      if (ctx) {
        await auditLogService.record(
          {
            action: 'BACKUP',
            module: 'backup',
            entityType: 'BackupLog',
            entityId: log.id,
            description: `สำรองข้อมูล${scopeLabel} (${fileName})`,
          },
          ctx,
        );
      }
      if (type !== 'SAFETY') {
        notificationService.notifyBackupEvent('BACKUP_SUCCESS', { fileName, scope, errorMessage: null }).catch(() => {});
      }
      return updated;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const updated = await this.repo.update(log.id, { status: 'FAILED', errorMessage: message.slice(0, 500), finishedAt: new Date() });
      if (ctx) {
        await auditLogService.record(
          {
            action: 'BACKUP',
            module: 'backup',
            entityType: 'BackupLog',
            entityId: log.id,
            description: `สำรองข้อมูลล้มเหลว: ${message.slice(0, 200)}`,
          },
          ctx,
        );
      }
      if (type !== 'SAFETY') {
        notificationService.notifyBackupEvent('BACKUP_FAILED', { fileName, scope, errorMessage: message }).catch(() => {});
      }
      void updated;
      throw err;
    }
  }

  // ---------------------------------------------------------------------------------
  // Restore
  // ---------------------------------------------------------------------------------

  async restore(sourceLogId: string, dto: RestoreDto, ctx: IRequestContext): Promise<{ started: true }> {
    if (this.state.isRunning) {
      throw new ConflictError('กำลังมีการสำรอง/กู้คืนข้อมูลทำงานอยู่ กรุณารอให้เสร็จก่อน');
    }

    const user = await prisma.user.findUnique({ where: { id: ctx.user.id }, select: { passwordHash: true } });
    if (!user) throw new ForbiddenError();
    const passwordMatches = await bcrypt.compare(dto.confirmPassword, user.passwordHash);
    if (!passwordMatches) {
      throw new BadRequestError('รหัสผ่านไม่ถูกต้อง', 'INVALID_CURRENT_PASSWORD');
    }

    const sourceLog = await this.repo.findById(sourceLogId);
    if (!sourceLog || sourceLog.action !== 'BACKUP' || sourceLog.status !== 'SUCCESS') {
      throw new NotFoundError('ไม่พบไฟล์สำรองข้อมูลที่ระบุ');
    }
    if (dto.confirmFileName !== sourceLog.fileName) {
      throw new BadRequestError('ชื่อไฟล์ที่พิมพ์ยืนยันไม่ตรงกับไฟล์ที่เลือก กรุณาตรวจสอบให้ถูกต้อง', 'FILENAME_MISMATCH');
    }

    const sourcePath = this.resolveBackupFilePath(sourceLog.fileName);
    try {
      await fs.access(sourcePath);
    } catch {
      throw new NotFoundError('ไม่พบไฟล์สำรองข้อมูลบนดิสก์ (อาจถูกลบไปแล้ว)');
    }

    this.lock('RESTORE');
    this.performRestore(sourceLog, sourcePath, ctx)
      .catch((err) => {
        logger.error(`[backup] กู้คืนข้อมูลล้มเหลว: ${err instanceof Error ? err.message : String(err)}`);
      })
      .finally(() => this.unlock());
    return { started: true };
  }

  private async performRestore(sourceLog: BackupLog, sourcePath: string, ctx: IRequestContext): Promise<void> {
    const startedAt = new Date();
    const log = await this.repo.create({
      action: 'RESTORE',
      type: sourceLog.type === 'SAFETY' ? 'MANUAL' : sourceLog.type,
      scope: sourceLog.scope,
      includedTables: (sourceLog.includedTables ?? undefined) as Prisma.InputJsonValue | undefined,
      sourceBackupLogId: sourceLog.id,
      fileName: sourceLog.fileName,
      status: 'FAILED',
      triggeredBy: ctx.user.id,
      startedAt,
    });

    try {
      // Safety backup บังคับเสมอก่อน restore ทุกครั้ง — lock ของ RESTORE ถูกถืออยู่แล้วโดยผู้เรียก (restore())
      // ถ้าขั้นตอนนี้ล้มเหลว ให้ยกเลิก restore ทั้งหมดทันที ไม่ดำเนินการต่อไม่ว่ากรณีใด (throw ออกไปเข้า catch ด้านล่าง)
      await this.performBackup('SAFETY', 'FULL', undefined, ctx);

      await runRestore({ inputPath: sourcePath });
      const finishedAt = new Date();
      await this.repo.update(log.id, { status: 'SUCCESS', finishedAt });

      await auditLogService.record(
        { action: 'RESTORE', module: 'backup', entityType: 'BackupLog', entityId: log.id, description: `กู้คืนข้อมูลจากไฟล์ ${sourceLog.fileName}` },
        ctx,
      );
      await notificationService.notifyBackupEvent('RESTORE_SUCCESS', { fileName: sourceLog.fileName, scope: sourceLog.scope, errorMessage: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.repo.update(log.id, { status: 'FAILED', errorMessage: message.slice(0, 500), finishedAt: new Date() });
      await auditLogService.record(
        { action: 'RESTORE', module: 'backup', entityType: 'BackupLog', entityId: log.id, description: `กู้คืนข้อมูลล้มเหลว: ${message.slice(0, 200)}` },
        ctx,
      );
      await notificationService.notifyBackupEvent('RESTORE_FAILED', { fileName: sourceLog.fileName, scope: sourceLog.scope, errorMessage: message });
    }
  }

  // ---------------------------------------------------------------------------------
  // List / Download / Delete
  // ---------------------------------------------------------------------------------

  async list(query: ListBackupLogsQueryDto) {
    const pagination = normalizePagination(query);
    const where: Prisma.BackupLogWhereInput = {
      action: query.action || undefined,
      type: query.type || undefined,
      status: query.status || undefined,
      startedAt: query.dateFrom || query.dateTo ? { gte: query.dateFrom, lte: query.dateTo } : undefined,
    };
    const { items, total } = await this.repo.findMany(where, pagination.skip, pagination.take);
    // fileSizeBytes เป็น BigInt ใน Prisma (คอลัมน์ DB เป็น BIGINT) — JSON.stringify ไม่รองรับ BigInt โดยตรง
    // แปลงเป็น number ก่อนส่งออก API เสมอ (ขนาดไฟล์ backup ไม่มีทางเกิน Number.MAX_SAFE_INTEGER ในทางปฏิบัติ)
    const serialized = items.map((item) => ({ ...item, fileSizeBytes: item.fileSizeBytes === null ? null : Number(item.fileSizeBytes) }));
    return buildPaginatedResult(serialized, total, pagination);
  }

  async getDownloadTarget(id: string): Promise<{ filePath: string; fileName: string }> {
    const log = await this.repo.findById(id);
    if (!log || log.action !== 'BACKUP' || log.status !== 'SUCCESS') {
      throw new NotFoundError('ไม่พบไฟล์สำรองข้อมูลที่ระบุ');
    }
    const filePath = this.resolveBackupFilePath(log.fileName);
    return { filePath, fileName: log.fileName };
  }

  async deleteBackup(id: string, ctx: IRequestContext): Promise<void> {
    const log = await this.repo.findById(id);
    if (!log) throw new NotFoundError('ไม่พบรายการที่ระบุ');
    if (log.action !== 'BACKUP') {
      throw new BadRequestError('ลบได้เฉพาะรายการสำรองข้อมูล (ไม่ใช่ประวัติการกู้คืน ซึ่งต้องเก็บไว้เป็นหลักฐาน)');
    }
    const filePath = this.resolveBackupFilePath(log.fileName);
    await fs.rm(filePath, { force: true });
    await this.repo.delete(id);
    await auditLogService.record(
      { action: 'DELETE', module: 'backup', entityType: 'BackupLog', entityId: id, description: `ลบไฟล์สำรองข้อมูล ${log.fileName}` },
      ctx,
    );
  }

  private async sweepRetention(retentionDays: number): Promise<void> {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const expired = await this.repo.findExpiredAutomatic(cutoff);
    for (const row of expired) {
      try {
        const filePath = this.resolveBackupFilePath(row.fileName);
        await fs.rm(filePath, { force: true });
        await this.repo.delete(row.id);
      } catch (err) {
        logger.error(`[backup] ลบไฟล์สำรองข้อมูลเก่าไม่สำเร็จ (${row.fileName}): ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    if (expired.length > 0) {
      logger.info(`[backup] ลบไฟล์สำรองข้อมูลอัตโนมัติที่หมดอายุ ${expired.length} ไฟล์ (เก่ากว่า ${retentionDays} วัน)`);
    }
  }

  /** traversal guard เดียวกับ serveFile.controller.ts — fileName มาจาก DB เสมอ (ไม่ใช่จาก request ตรงๆ) แต่ยังกันไว้อีกชั้น */
  private resolveBackupFilePath(fileName: string): string {
    if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      throw new BadRequestError('ชื่อไฟล์ไม่ถูกต้อง');
    }
    const filePath = path.resolve(env.BACKUP_DIR, fileName);
    const backupRoot = path.resolve(env.BACKUP_DIR);
    if (!filePath.startsWith(backupRoot)) {
      throw new BadRequestError('เส้นทางไฟล์ไม่ถูกต้อง');
    }
    return filePath;
  }

  // ---------------------------------------------------------------------------------
  // Settings (เก็บใน system_settings แบบ key-value เดียวกับ notification/org settings)
  // ---------------------------------------------------------------------------------

  async getSettings(): Promise<IBackupSettings> {
    const rows = await this.settingsRepo.findByCategory(CATEGORY);
    const v = new Map(rows.map((r) => [r.settingKey, r.settingValue]));
    const rawTables = v.get(TABLES_KEY);
    let includedTables: string[] = [];
    if (rawTables) {
      try {
        includedTables = JSON.parse(rawTables) as string[];
      } catch {
        includedTables = [];
      }
    }
    return {
      enabled: v.get(ENABLED_KEY) === 'true',
      scope: (v.get(SCOPE_KEY) as BackupScopeValue) || 'FULL',
      includedTables,
      retentionDays: Number(v.get(RETENTION_KEY)) || env.BACKUP_RETENTION_DAYS,
    };
  }

  async updateSettings(dto: UpdateBackupSettingsDto, updatedBy: string): Promise<IBackupSettings> {
    if (dto.enabled !== undefined) await this.settingsRepo.upsert(ENABLED_KEY, String(dto.enabled), CATEGORY, updatedBy);
    if (dto.scope !== undefined) await this.settingsRepo.upsert(SCOPE_KEY, dto.scope, CATEGORY, updatedBy);
    if (dto.includedTables !== undefined) await this.settingsRepo.upsert(TABLES_KEY, JSON.stringify(dto.includedTables), CATEGORY, updatedBy);
    if (dto.retentionDays !== undefined) await this.settingsRepo.upsert(RETENTION_KEY, String(dto.retentionDays), CATEGORY, updatedBy);
    return this.getSettings();
  }
}

export const backupService = new BackupService();
