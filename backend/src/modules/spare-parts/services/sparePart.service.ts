import { SparePartRepository, type ISparePartListFilter } from '@modules/spare-parts/repositories/sparePart.repository';
import type {
  CreateSparePartDto,
  ListSparePartsQueryDto,
  ListTransactionsQueryDto,
  RecordTransactionDto,
  UpdateSparePartDto,
} from '@modules/spare-parts/dto/sparePart.dto';
import { ConflictError, NotFoundError } from '@common/errors';
import { normalizePagination, buildPaginatedResult } from '@common/utils/pagination';
import { auditLogService } from '@modules/audit-log/services/auditLog.service';
import type { IRequestContext } from '@common/interfaces';

const EXPORT_MAX_ROWS = 5000;

const INCREASE_TYPES = new Set(['RETURN', 'PURCHASE', 'RECEIVE']);
const DECREASE_TYPES = new Set(['RESERVE', 'ISSUE']);

function computeDelta(type: string, quantity: number): number {
  if (type === 'ADJUST') return quantity;
  if (INCREASE_TYPES.has(type)) return quantity;
  if (DECREASE_TYPES.has(type)) return -quantity;
  throw new ConflictError(`ไม่รู้จักประเภทธุรกรรมอะไหล่: ${type}`);
}

export class SparePartService {
  private readonly repo = new SparePartRepository();

  async list(query: ListSparePartsQueryDto) {
    const pagination = normalizePagination(query);
    const { items, total } = await this.repo.findMany({ keyword: query.keyword, lowStockOnly: query.lowStockOnly }, pagination);
    return buildPaginatedResult(items, total, pagination);
  }

  async listForExport(filter: ISparePartListFilter) {
    const { items } = await this.repo.findMany(filter, { page: 1, limit: EXPORT_MAX_ROWS, skip: 0, take: EXPORT_MAX_ROWS });
    return items;
  }

  async getById(id: string) {
    const part = await this.repo.findById(id);
    if (!part) throw new NotFoundError('ไม่พบอะไหล่');
    return part;
  }

  async create(dto: CreateSparePartDto, ctx: IRequestContext) {
    const existing = await this.repo.findByCode(dto.code);
    if (existing) throw new ConflictError('รหัสอะไหล่นี้มีอยู่แล้ว');

    const part = await this.repo.create(dto);
    await auditLogService.record(
      { action: 'CREATE', module: 'spare-part', entityType: 'SparePart', entityId: part.id, description: `สร้างอะไหล่ ${part.code} - ${part.name}` },
      ctx,
    );
    return part;
  }

  async update(id: string, dto: UpdateSparePartDto, ctx: IRequestContext) {
    await this.getById(id);
    const part = await this.repo.update(id, dto);
    await auditLogService.record(
      { action: 'UPDATE', module: 'spare-part', entityType: 'SparePart', entityId: part.id, description: `แก้ไขอะไหล่ ${part.code}` },
      ctx,
    );
    return part;
  }

  async listTransactions(query: ListTransactionsQueryDto & { sparePartId?: string }) {
    const pagination = normalizePagination(query);
    const { items, total } = await this.repo.findTransactions({ sparePartId: query.sparePartId, ticketId: query.ticketId }, pagination);
    return buildPaginatedResult(items, total, pagination);
  }

  async recordTransaction(sparePartId: string, dto: RecordTransactionDto, ctx: IRequestContext) {
    const delta = computeDelta(dto.type, dto.quantity);
    const result = await this.repo.recordTransactionTx(sparePartId, {
      type: dto.type,
      quantity: dto.quantity,
      delta,
      ticketId: dto.ticketId,
      note: dto.note,
      performedBy: ctx.user.id,
    });

    if ('error' in result) {
      if (result.error === 'NOT_FOUND') throw new NotFoundError('ไม่พบอะไหล่');
      throw new ConflictError(`สต็อกไม่พอ (คงเหลือ ${result.currentQuantity} แต่ขอเบิก ${dto.quantity})`);
    }

    await auditLogService.record(
      {
        action: 'UPDATE',
        module: 'spare-part',
        entityType: 'SparePartTransaction',
        entityId: result.txn.id,
        description: `${dto.type} อะไหล่ ${result.txn.sparePart.code} จำนวน ${dto.quantity} (คงเหลือ ${result.txn.balanceAfter})${dto.ticketId ? ` — ผูกกับใบแจ้งซ่อม` : ''}`,
      },
      ctx,
    );

    return result.txn;
  }
}

export const sparePartService = new SparePartService();
