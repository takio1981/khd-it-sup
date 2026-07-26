import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma, type PrismaClientOrTx } from '@infrastructure/database/prisma';

export class TimelineRepository {
  /** insert-only — ห้ามเพิ่มเมธอด update/delete (บังคับซ้ำที่ระดับ DB ด้วย trigger ใน database/schema.sql) */
  async insert(data: Omit<Prisma.RepairTicketTimelineEventUncheckedCreateInput, 'id'>, db: PrismaClientOrTx = prisma) {
    return db.repairTicketTimelineEvent.create({ data: { id: randomUUID(), ...data } });
  }

  async findLastEventByTicket(ticketId: string, db: PrismaClientOrTx = prisma) {
    return db.repairTicketTimelineEvent.findFirst({
      where: { ticketId },
      orderBy: { eventTime: 'desc' },
    });
  }

  async findByTicketId(ticketId: string, db: PrismaClientOrTx = prisma) {
    return db.repairTicketTimelineEvent.findMany({
      where: { ticketId },
      include: { responsible: { select: { id: true, fullName: true, username: true } }, department: { select: { nameTh: true } } },
      orderBy: { eventTime: 'asc' },
    });
  }
}
