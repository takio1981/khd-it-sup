import { randomUUID } from 'node:crypto';
import type { Prisma, VendorRepairStatus } from '@prisma/client';
import { prisma } from '@infrastructure/database/prisma';
import type { INormalizedPagination } from '@common/utils/pagination';

const include = {
  vendor: { select: { id: true, code: true, name: true, contactPerson: true, phone: true } },
  ticket: { select: { id: true, ticketNumber: true, status: true } },
} satisfies Prisma.VendorRepairOrderInclude;

export interface IVendorOrderListFilter {
  ticketId?: string;
  vendorId?: string;
  status?: string;
}

export class VendorRepairOrderRepository {
  async findMany(filter: IVendorOrderListFilter, pagination: INormalizedPagination) {
    const where: Prisma.VendorRepairOrderWhereInput = {
      ticketId: filter.ticketId,
      vendorId: filter.vendorId,
      status: filter.status as VendorRepairStatus | undefined,
    };
    const [items, total] = await Promise.all([
      prisma.vendorRepairOrder.findMany({ where, include, orderBy: { createdAt: 'desc' }, skip: pagination.skip, take: pagination.take }),
      prisma.vendorRepairOrder.count({ where }),
    ]);
    return { items, total };
  }

  async findById(id: string) {
    return prisma.vendorRepairOrder.findUnique({ where: { id }, include });
  }

  async create(data: { ticketId: string; vendorId: string; quotationAmount?: number }) {
    return prisma.vendorRepairOrder.create({
      data: { id: randomUUID(), ticketId: data.ticketId, vendorId: data.vendorId, quotationAmount: data.quotationAmount },
      include,
    });
  }

  async update(id: string, data: Prisma.VendorRepairOrderUncheckedUpdateInput) {
    return prisma.vendorRepairOrder.update({ where: { id }, data, include });
  }
}
