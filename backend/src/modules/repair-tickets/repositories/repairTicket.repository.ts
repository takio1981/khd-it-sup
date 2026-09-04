import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma, type PrismaClientOrTx } from '@infrastructure/database/prisma';
import type { INormalizedPagination } from '@common/utils/pagination';

export interface ITicketListFilter {
  status?: string;
  urgency?: string;
  departmentId?: string;
  assignedTechnicianId?: string;
  assetId?: string;
  keyword?: string;
  /** จำกัดเฉพาะ ticket ของผู้ใช้คนนี้ — ใช้เมื่อผู้ใช้มีสิทธิ์แค่ ticket:track (เห็นเฉพาะของตน) */
  reportedByUserId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

const ticketListInclude = {
  asset: {
    select: {
      id: true,
      assetNumber: true,
      model: true,
      brand: true,
      govAssetNumber: true,
      serialNumber: true,
      category: { select: { nameTh: true } },
    },
  },
  reportedBy: { select: { id: true, fullName: true, username: true, email: true } },
  department: { select: { id: true, nameTh: true } },
  assignedTechnician: { select: { id: true, fullName: true, username: true, email: true } },
  firstViewedBy: { select: { id: true, fullName: true } },
  workflowInstance: { include: { currentStep: true } },
} satisfies Prisma.RepairTicketInclude;

function buildWhere(filter: ITicketListFilter): Prisma.RepairTicketWhereInput {
  return {
    status: filter.status,
    urgency: filter.urgency as Prisma.EnumTicketUrgencyFilter['equals'],
    departmentId: filter.departmentId,
    assignedTechnicianId: filter.assignedTechnicianId,
    assetId: filter.assetId,
    reportedByUserId: filter.reportedByUserId,
    ...(filter.dateFrom || filter.dateTo
      ? { createdAt: { gte: filter.dateFrom, lte: filter.dateTo } }
      : {}),
    ...(filter.keyword
      ? {
          OR: [
            { ticketNumber: { contains: filter.keyword } },
            { description: { contains: filter.keyword } },
            { reportedBy: { fullName: { contains: filter.keyword } } },
            { reportedBy: { username: { contains: filter.keyword } } },
          ],
        }
      : {}),
  };
}

export class RepairTicketRepository {
  async findMany(filter: ITicketListFilter, pagination: INormalizedPagination) {
    const where = buildWhere(filter);
    const [items, total] = await Promise.all([
      prisma.repairTicket.findMany({
        where,
        include: ticketListInclude,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.repairTicket.count({ where }),
    ]);
    return { items, total };
  }

  /** จำนวนใบแจ้งซ่อมที่ยังไม่มีแอดมิน/ช่างเข้าดูรายละเอียดเลย — ใช้แสดงตัวเลขที่เมนู "งานแจ้งซ่อม" ใน sidebar */
  async countUnviewed(): Promise<number> {
    return prisma.repairTicket.count({ where: { firstViewedByUserId: null } });
  }

  /** ใบแจ้งซ่อมที่ "ยังไม่ปิดงาน" (ไม่ใช่ CLOSED/CANCELLED) ล่าสุดของครุภัณฑ์นี้ — ใช้กันแจ้งซ่อมซ้ำซ้อนตอนสร้างใหม่
   * และแสดงสถานะให้ผู้สแกน QR เห็นก่อนแจ้งซ้ำ (ดู qrcode.service.ts resolve()) */
  async findActiveByAssetId(assetId: string) {
    return prisma.repairTicket.findFirst({
      where: { assetId, status: { notIn: ['CLOSED', 'CANCELLED'] } },
      select: {
        id: true,
        ticketNumber: true,
        status: true,
        description: true,
        urgency: true,
        createdAt: true,
        reportedBy: { select: { fullName: true } },
        assignedTechnician: { select: { fullName: true } },
        workflowInstance: { select: { currentStep: { select: { stepNameTh: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, db: PrismaClientOrTx = prisma) {
    return db.repairTicket.findUnique({
      where: { id },
      include: {
        asset: {
          select: {
            id: true,
            assetNumber: true,
            model: true,
            brand: true,
            govAssetNumber: true,
            serialNumber: true,
            category: { select: { code: true, nameTh: true, icon: true } },
            photos: { select: { id: true, fileUrl: true }, orderBy: { uploadedAt: 'desc' }, take: 1 },
          },
        },
        reportedBy: {
          select: { id: true, fullName: true, username: true, email: true, position: { select: { nameTh: true } } },
        },
        department: { select: { id: true, nameTh: true } },
        assignedTechnician: { select: { id: true, fullName: true, username: true, email: true } },
        summaryByUser: { select: { id: true, fullName: true } },
        unitHeadApprovedBy: { select: { id: true, fullName: true } },
        inspectedBy: { select: { id: true, fullName: true } },
        digitalHealthHeadApprovedBy: { select: { id: true, fullName: true } },
        acceptedBy: { select: { id: true, fullName: true } },
        firstViewedBy: { select: { id: true, fullName: true } },
        attachments: { orderBy: { uploadedAt: 'desc' } },
        workflowInstance: {
          include: {
            currentStep: true,
            template: { include: { steps: { orderBy: { stepOrder: 'asc' } }, transitions: true } },
          },
        },
      },
    });
  }

  async create(data: Prisma.RepairTicketUncheckedCreateInput, db: PrismaClientOrTx = prisma) {
    return db.repairTicket.create({ data, include: ticketListInclude });
  }

  async update(id: string, data: Prisma.RepairTicketUncheckedUpdateInput, db: PrismaClientOrTx = prisma) {
    return db.repairTicket.update({ where: { id }, data, include: ticketListInclude });
  }

  async addAttachment(data: Omit<Prisma.RepairTicketAttachmentUncheckedCreateInput, 'id'>, db: PrismaClientOrTx = prisma) {
    return db.repairTicketAttachment.create({ data: { id: randomUUID(), ...data } });
  }

  /** บันทึกผู้เข้าดูรายละเอียดคนแรก — atomic update แบบมีเงื่อนไข (WHERE first_viewed_by_user_id IS NULL) กัน race
   *  ถ้าแอดมิน/ช่างสองคนเปิดพร้อมกันพอดี คืนค่า true เฉพาะคำเรียกที่ set ค่าสำเร็จจริงเท่านั้น เพื่อไม่ให้ยิงแจ้งเตือนซ้ำ */
  async markFirstViewed(id: string, userId: string): Promise<boolean> {
    const result = await prisma.repairTicket.updateMany({
      where: { id, firstViewedByUserId: null },
      data: { firstViewedByUserId: userId, firstViewedAt: new Date() },
    });
    return result.count > 0;
  }
}
