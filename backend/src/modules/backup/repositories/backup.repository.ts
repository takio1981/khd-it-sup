import type { Prisma } from '@prisma/client';
import { prisma } from '@infrastructure/database/prisma';
import { randomUUID } from 'node:crypto';

export class BackupRepository {
  async create(data: Omit<Prisma.BackupLogUncheckedCreateInput, 'id'>) {
    return prisma.backupLog.create({ data: { id: randomUUID(), ...data } });
  }

  async update(id: string, data: Prisma.BackupLogUncheckedUpdateInput) {
    return prisma.backupLog.update({ where: { id }, data });
  }

  async findById(id: string) {
    return prisma.backupLog.findUnique({ where: { id } });
  }

  async findMany(where: Prisma.BackupLogWhereInput, skip: number, take: number) {
    const [items, total] = await Promise.all([
      prisma.backupLog.findMany({
        where,
        skip,
        take,
        orderBy: { startedAt: 'desc' },
        include: { triggeredByUser: { select: { id: true, fullName: true, username: true } } },
      }),
      prisma.backupLog.count({ where }),
    ]);
    return { items, total };
  }

  /** ใช้กับ retention sweep — เฉพาะรายการ backup อัตโนมัติที่สำเร็จและเก่ากว่า cutoff เท่านั้น (ไม่แตะ MANUAL/SAFETY) */
  async findExpiredAutomatic(cutoff: Date) {
    return prisma.backupLog.findMany({
      where: { action: 'BACKUP', type: 'AUTOMATIC', status: 'SUCCESS', startedAt: { lt: cutoff } },
    });
  }

  async delete(id: string) {
    return prisma.backupLog.delete({ where: { id } });
  }
}
