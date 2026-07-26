import type { Prisma } from '@prisma/client';
import { prisma } from '@infrastructure/database/prisma';
import { randomUUID } from 'node:crypto';

export class AuditLogRepository {
  async insert(data: Omit<Prisma.AuditLogUncheckedCreateInput, 'id'>) {
    return prisma.auditLog.create({ data: { id: randomUUID(), ...data } });
  }

  async findMany(where: Prisma.AuditLogWhereInput, skip: number, take: number) {
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      prisma.auditLog.count({ where }),
    ]);
    return { items, total };
  }
}
