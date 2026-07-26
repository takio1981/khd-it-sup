import { AuditLogRepository } from '@modules/audit-log/repositories/auditLog.repository';
import { logger } from '@infrastructure/logger/logger';
import type { IRequestContext } from '@common/interfaces';

export interface IRecordAuditInput {
  action: 'LOGIN' | 'LOGOUT' | 'CREATE' | 'UPDATE' | 'DELETE' | 'PRINT' | 'EXPORT' | 'APPROVE' | 'CONFIG_CHANGE';
  module: string;
  entityType?: string;
  entityId?: string;
  description?: string;
  beforeData?: unknown;
  afterData?: unknown;
}

/**
 * เขียน Audit Log — insert-only (บังคับด้วย MariaDB trigger ในระดับ DB, ดู database/schema.sql)
 * ห้ามเพิ่มเมธอด update/delete ใน service/repository นี้โดยเด็ดขาด
 * การเขียน audit log ต้อง "ไม่ทำให้ business transaction ล้มเหลว" — ถ้าเขียน log ไม่สำเร็จ ให้ log error แล้วปล่อยผ่าน
 */
export class AuditLogService {
  private readonly repo = new AuditLogRepository();

  async record(input: IRecordAuditInput, ctx: IRequestContext | { user?: null; ipAddress: string; userAgent: string }): Promise<void> {
    try {
      await this.repo.insert({
        userId: ctx.user?.id ?? null,
        action: input.action,
        module: input.module,
        entityType: input.entityType,
        entityId: input.entityId,
        description: input.description,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        beforeData: input.beforeData === undefined ? undefined : (input.beforeData as object),
        afterData: input.afterData === undefined ? undefined : (input.afterData as object),
      });
    } catch (err) {
      logger.error(`[audit] failed to record audit log: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

export const auditLogService = new AuditLogService();
