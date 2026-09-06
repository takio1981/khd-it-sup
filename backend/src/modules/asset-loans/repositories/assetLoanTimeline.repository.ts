import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma, type PrismaClientOrTx } from '@infrastructure/database/prisma';

export class AssetLoanTimelineRepository {
  /** insert-only — ห้ามเพิ่มเมธอด update/delete (บังคับซ้ำที่ระดับ DB ด้วย trigger ใน database/schema.sql) */
  async insert(data: Omit<Prisma.AssetLoanTimelineEventUncheckedCreateInput, 'id'>, db: PrismaClientOrTx = prisma) {
    return db.assetLoanTimelineEvent.create({ data: { id: randomUUID(), ...data } });
  }

  async findByLoanId(loanId: string, db: PrismaClientOrTx = prisma) {
    return db.assetLoanTimelineEvent.findMany({
      where: { loanId },
      include: {
        holder: { select: { id: true, fullName: true } },
        responsible: { select: { id: true, fullName: true } },
        building: { select: { id: true, name: true } },
        floor: { select: { id: true, name: true } },
        room: { select: { id: true, name: true } },
      },
      orderBy: { eventTime: 'asc' },
    });
  }
}
