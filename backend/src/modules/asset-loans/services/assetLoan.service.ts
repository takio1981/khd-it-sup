import { randomUUID } from 'node:crypto';
import type { AssetLoan } from '@prisma/client';
import { prisma } from '@infrastructure/database/prisma';
import { AssetLoanRepository, type IAssetLoanFilter } from '@modules/asset-loans/repositories/assetLoan.repository';
import type {
  CreateAssetLoanDto,
  ListAssetLoansQueryDto,
  ReturnAssetLoanDto,
  UpdateAssetLoanDto,
} from '@modules/asset-loans/dto/assetLoan.dto';
import { BadRequestError, ConflictError, NotFoundError } from '@common/errors';
import { normalizePagination, buildPaginatedResult } from '@common/utils/pagination';
import { auditLogService } from '@modules/audit-log/services/auditLog.service';
import { notificationService, type AssetLoanNotificationEvent } from '@modules/notifications/services/notification.service';
import { logger } from '@infrastructure/logger/logger';
import type { IRequestContext } from '@common/interfaces';

export type AssetLoanStatus = 'BORROWED' | 'OVERDUE' | 'RETURNED';

function computeStatus(loan: Pick<AssetLoan, 'actualReturnDate' | 'expectedReturnDate'>): AssetLoanStatus {
  if (loan.actualReturnDate) return 'RETURNED';
  if (loan.expectedReturnDate && loan.expectedReturnDate < new Date()) return 'OVERDUE';
  return 'BORROWED';
}

function withStatus<T extends Pick<AssetLoan, 'actualReturnDate' | 'expectedReturnDate'>>(loan: T) {
  return { ...loan, status: computeStatus(loan) };
}

export class AssetLoanService {
  private readonly repo = new AssetLoanRepository();

  async list(query: ListAssetLoansQueryDto) {
    const pagination = normalizePagination(query);
    const filter: IAssetLoanFilter = { status: query.status, keyword: query.keyword };
    const { items, total } = await this.repo.findMany(filter, pagination.skip, pagination.take);
    return buildPaginatedResult(items.map(withStatus), total, pagination);
  }

  async getStats() {
    return this.repo.getStats();
  }

  async getById(id: string) {
    const loan = await this.repo.findById(id);
    if (!loan) throw new NotFoundError('ไม่พบรายการยืม');
    return withStatus(loan);
  }

  async getChartData() {
    const loans = await this.repo.findAllForChart();
    const byAsset = new Map<string, number>();
    const byBorrower = new Map<string, number>();
    for (const loan of loans) {
      const assetLabel = `${loan.asset.assetNumber}${loan.asset.brand ? ' — ' + loan.asset.brand : ''}`;
      byAsset.set(assetLabel, (byAsset.get(assetLabel) ?? 0) + 1);
      byBorrower.set(loan.borrower.fullName, (byBorrower.get(loan.borrower.fullName) ?? 0) + 1);
    }
    const topAssets = Array.from(byAsset.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    const topBorrowers = Array.from(byBorrower.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    return { topAssets, topBorrowers };
  }

  async create(dto: CreateAssetLoanDto, ctx: IRequestContext) {
    const asset = await prisma.asset.findFirst({ where: { id: dto.assetId, deletedAt: null } });
    if (!asset) throw new NotFoundError('ไม่พบครุภัณฑ์ที่ระบุ');

    const borrower = await prisma.user.findFirst({ where: { id: dto.borrowerId, deletedAt: null } });
    if (!borrower) throw new NotFoundError('ไม่พบผู้ยืมที่ระบุ');

    const activeLoan = await this.repo.findActiveByAsset(dto.assetId);
    if (activeLoan) throw new ConflictError('ครุภัณฑ์นี้ถูกยืมอยู่แล้ว ยังไม่ได้คืน');

    const loan = await this.repo.create({
      id: randomUUID(),
      assetId: dto.assetId,
      borrowerId: dto.borrowerId,
      recordedBy: ctx.user.id,
      expectedReturnDate: dto.expectedReturnDate,
      purpose: dto.purpose,
      conditionOnBorrow: dto.conditionOnBorrow,
    });

    await auditLogService.record(
      {
        action: 'CREATE',
        module: 'asset',
        entityType: 'AssetLoan',
        entityId: loan.id,
        description: `บันทึกยืมครุภัณฑ์ ${asset.assetNumber} ให้ ${borrower.fullName}`,
      },
      ctx,
    );

    await this.notifySafe('BORROWED', loan);

    return withStatus(loan);
  }

  async returnLoan(id: string, dto: ReturnAssetLoanDto, ctx: IRequestContext) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError('ไม่พบรายการยืม');
    if (existing.actualReturnDate) throw new BadRequestError('รายการนี้คืนแล้ว');

    const loan = await this.repo.markReturned(id, ctx.user.id, dto.conditionOnReturn);

    await auditLogService.record(
      {
        action: 'UPDATE',
        module: 'asset',
        entityType: 'AssetLoan',
        entityId: id,
        description: `บันทึกคืนครุภัณฑ์ ${existing.asset.assetNumber}`,
      },
      ctx,
    );

    await this.notifySafe('RETURNED', loan);

    return withStatus(loan);
  }

  async update(id: string, dto: UpdateAssetLoanDto, ctx: IRequestContext) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError('ไม่พบรายการยืม');

    if (dto.assetId && dto.assetId !== existing.assetId) {
      const asset = await prisma.asset.findFirst({ where: { id: dto.assetId, deletedAt: null } });
      if (!asset) throw new NotFoundError('ไม่พบครุภัณฑ์ที่ระบุ');

      const activeLoan = await this.repo.findActiveByAsset(dto.assetId);
      if (activeLoan && activeLoan.id !== id) throw new ConflictError('ครุภัณฑ์นี้ถูกยืมอยู่แล้ว ยังไม่ได้คืน');
    }

    if (dto.borrowerId) {
      const borrower = await prisma.user.findFirst({ where: { id: dto.borrowerId, deletedAt: null } });
      if (!borrower) throw new NotFoundError('ไม่พบผู้ยืมที่ระบุ');
    }

    const loan = await this.repo.update(id, dto);

    await auditLogService.record(
      { action: 'UPDATE', module: 'asset', entityType: 'AssetLoan', entityId: id, beforeData: existing, afterData: loan },
      ctx,
    );

    return withStatus(loan);
  }

  async remove(id: string, ctx: IRequestContext) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError('ไม่พบรายการยืม');

    await this.repo.delete(id);

    await auditLogService.record(
      {
        action: 'DELETE',
        module: 'asset',
        entityType: 'AssetLoan',
        entityId: id,
        description: `ลบรายการยืมครุภัณฑ์ ${existing.asset.assetNumber} (ผู้ยืม ${existing.borrower.fullName})`,
        beforeData: existing,
      },
      ctx,
    );
  }

  /** ห่อการแจ้งเตือน (Email/Telegram/LINE) ไม่ให้ error จากช่องทางแจ้งเตือนไปกระทบ flow หลักของการยืม-คืน */
  private async notifySafe(
    event: AssetLoanNotificationEvent,
    loan: Parameters<typeof notificationService.notifyAssetLoanEvent>[1],
  ): Promise<void> {
    try {
      await notificationService.notifyAssetLoanEvent(event, loan);
    } catch (err) {
      logger.error(`[asset-loan] แจ้งเตือน ${event} ล้มเหลว: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
