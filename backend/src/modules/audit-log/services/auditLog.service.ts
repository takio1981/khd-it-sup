import type { Prisma } from '@prisma/client';
import { AuditLogRepository } from '@modules/audit-log/repositories/auditLog.repository';
import { logger } from '@infrastructure/logger/logger';
import type { IRequestContext } from '@common/interfaces';
import type { ExportAuditLogsQueryDto, ListAuditLogsQueryDto } from '@modules/audit-log/dto/auditLog.dto';
import { normalizePagination, buildPaginatedResult } from '@common/utils/pagination';

const EXPORT_MAX_ROWS = 5000;

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

  /** อ่านย้อนหลัง — read-only, ใช้สำหรับหน้าจอ Audit Log UI (permission: audit:view) */
  async list(query: ListAuditLogsQueryDto) {
    const pagination = normalizePagination(query);
    const where: Prisma.AuditLogWhereInput = {
      module: query.module || undefined,
      action: query.action || undefined,
      userId: query.userId || undefined,
      createdAt:
        query.dateFrom || query.dateTo
          ? { gte: query.dateFrom, lte: query.dateTo }
          : undefined,
    };
    const { items, total } = await this.repo.findMany(where, pagination.skip, pagination.take);
    return buildPaginatedResult(items, total, pagination);
  }

  async listForExport(query: Omit<ExportAuditLogsQueryDto, 'format'>) {
    const where: Prisma.AuditLogWhereInput = {
      module: query.module || undefined,
      action: query.action || undefined,
      userId: query.userId || undefined,
      createdAt:
        query.dateFrom || query.dateTo
          ? { gte: query.dateFrom, lte: query.dateTo }
          : undefined,
    };
    const { items } = await this.repo.findMany(where, 0, EXPORT_MAX_ROWS);
    return items;
  }
}

export const auditLogService = new AuditLogService();
