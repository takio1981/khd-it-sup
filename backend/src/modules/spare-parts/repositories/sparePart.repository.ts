import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@infrastructure/database/prisma';
import type { INormalizedPagination } from '@common/utils/pagination';

export interface ISparePartListFilter {
  keyword?: string;
  lowStockOnly?: boolean;
}

function buildWhere(filter: ISparePartListFilter): Prisma.SparePartWhereInput {
  return {
    ...(filter.keyword
      ? {
          OR: [
            { code: { contains: filter.keyword } },
            { name: { contains: filter.keyword } },
          ],
        }
      : {}),
  };
}

export class SparePartRepository {
  async findMany(filter: ISparePartListFilter, pagination: INormalizedPagination) {
    const where = buildWhere(filter);
    // lowStockOnly ต้อง filter หลัง query เพราะเทียบ 2 คอลัมน์กันเอง (quantityOnHand <= reorderLevel) — Prisma ไม่รองรับตรงๆ ใน where
    if (filter.lowStockOnly) {
      const all = await prisma.sparePart.findMany({ where, orderBy: { code: 'asc' } });
      const lowStock = all.filter((p) => p.quantityOnHand <= p.reorderLevel);
      const total = lowStock.length;
      const items = lowStock.slice(pagination.skip, pagination.skip + pagination.take);
      return { items, total };
    }

    const [items, total] = await Promise.all([
      prisma.sparePart.findMany({ where, orderBy: { code: 'asc' }, skip: pagination.skip, take: pagination.take }),
      prisma.sparePart.count({ where }),
    ]);
    return { items, total };
  }

  async findById(id: string) {
    return prisma.sparePart.findUnique({ where: { id } });
  }

  async findByCode(code: string) {
    return prisma.sparePart.findUnique({ where: { code } });
  }

  async create(data: { code: string; name: string; unit?: string; reorderLevel?: number; unitCost?: number }) {
    return prisma.sparePart.create({
      data: {
        id: randomUUID(),
        code: data.code,
        name: data.name,
        unit: data.unit ?? 'ชิ้น',
        reorderLevel: data.reorderLevel ?? 0,
        unitCost: data.unitCost,
      },
    });
  }

  async update(id: string, data: Prisma.SparePartUncheckedUpdateInput) {
    return prisma.sparePart.update({ where: { id }, data });
  }

  async findTransactions(filter: { sparePartId?: string; ticketId?: string }, pagination: INormalizedPagination) {
    const where: Prisma.SparePartTransactionWhereInput = {
      sparePartId: filter.sparePartId,
      ticketId: filter.ticketId,
    };
    const [items, total] = await Promise.all([
      prisma.sparePartTransaction.findMany({
        where,
        include: {
          sparePart: { select: { id: true, code: true, name: true, unit: true } },
          ticket: { select: { id: true, ticketNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.sparePartTransaction.count({ where }),
    ]);
    return { items, total };
  }

  /** อ่าน + อัปเดต quantityOnHand + สร้างแถว transaction ทั้งหมดในธุรกรรมเดียว (atomic — กันสต็อกติดลบจาก race condition) */
  async recordTransactionTx(
    sparePartId: string,
    data: { type: string; quantity: number; delta: number; ticketId?: string; note?: string; performedBy?: string },
  ) {
    return prisma.$transaction(async (tx) => {
      const part = await tx.sparePart.findUnique({ where: { id: sparePartId } });
      if (!part) return { error: 'NOT_FOUND' as const };

      const newQuantity = part.quantityOnHand + data.delta;
      if (newQuantity < 0) {
        return { error: 'INSUFFICIENT_STOCK' as const, currentQuantity: part.quantityOnHand };
      }

      await tx.sparePart.update({ where: { id: sparePartId }, data: { quantityOnHand: newQuantity } });

      const txn = await tx.sparePartTransaction.create({
        data: {
          id: randomUUID(),
          sparePartId,
          ticketId: data.ticketId,
          type: data.type as Prisma.SparePartTransactionUncheckedCreateInput['type'],
          quantity: data.quantity,
          balanceAfter: newQuantity,
          performedBy: data.performedBy,
          note: data.note,
        },
        include: { sparePart: { select: { id: true, code: true, name: true, unit: true } } },
      });

      return { txn };
    });
  }
}
