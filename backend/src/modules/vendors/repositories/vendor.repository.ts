import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@infrastructure/database/prisma';
import type { INormalizedPagination } from '@common/utils/pagination';

export interface IVendorListFilter {
  keyword?: string;
  activeOnly?: boolean;
}

function buildWhere(filter: IVendorListFilter): Prisma.VendorWhereInput {
  return {
    isActive: filter.activeOnly ? true : undefined,
    ...(filter.keyword
      ? { OR: [{ code: { contains: filter.keyword } }, { name: { contains: filter.keyword } }] }
      : {}),
  };
}

export class VendorRepository {
  async findMany(filter: IVendorListFilter, pagination: INormalizedPagination) {
    const where = buildWhere(filter);
    const [items, total] = await Promise.all([
      prisma.vendor.findMany({ where, orderBy: { name: 'asc' }, skip: pagination.skip, take: pagination.take }),
      prisma.vendor.count({ where }),
    ]);
    return { items, total };
  }

  async findById(id: string) {
    return prisma.vendor.findUnique({ where: { id } });
  }

  async findByCode(code: string) {
    return prisma.vendor.findUnique({ where: { code } });
  }

  async create(data: { code: string; name: string; contactPerson?: string; phone?: string; email?: string; address?: string; taxId?: string }) {
    return prisma.vendor.create({ data: { id: randomUUID(), ...data } });
  }

  async update(id: string, data: Prisma.VendorUncheckedUpdateInput) {
    return prisma.vendor.update({ where: { id }, data });
  }
}
