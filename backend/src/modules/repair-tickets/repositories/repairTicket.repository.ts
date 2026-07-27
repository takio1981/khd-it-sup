import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma, type PrismaClientOrTx } from '@infrastructure/database/prisma';
import type { INormalizedPagination } from '@common/utils/pagination';

export interface ITicketListFilter {
  status?: string;
  urgency?: string;
  departmentId?: string;
  assignedTechnicianId?: string;
  keyword?: string;
  /** จำกัดเฉพาะ ticket ของผู้ใช้คนนี้ — ใช้เมื่อผู้ใช้มีสิทธิ์แค่ ticket:track (เห็นเฉพาะของตน) */
  reportedByUserId?: string;
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
  workflowInstance: { include: { currentStep: true } },
} satisfies Prisma.RepairTicketInclude;

function buildWhere(filter: ITicketListFilter): Prisma.RepairTicketWhereInput {
  return {
    status: filter.status,
    urgency: filter.urgency as Prisma.EnumTicketUrgencyFilter['equals'],
    departmentId: filter.departmentId,
    assignedTechnicianId: filter.assignedTechnicianId,
    reportedByUserId: filter.reportedByUserId,
    ...(filter.keyword
      ? {
          OR: [
            { ticketNumber: { contains: filter.keyword } },
            { description: { contains: filter.keyword } },
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
            category: { select: { nameTh: true } },
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
}
