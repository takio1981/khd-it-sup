import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@infrastructure/database/prisma';
import type { INormalizedPagination } from '@common/utils/pagination';

export interface IGeneratedDocumentFilter {
  ticketId?: string;
  templateCode?: string;
}

export class DocumentRepository {
  async findActiveTemplates() {
    return prisma.documentTemplate.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } });
  }

  async findTemplateByCode(code: string) {
    return prisma.documentTemplate.findUnique({ where: { code } });
  }

  async findManyGenerated(filter: IGeneratedDocumentFilter, pagination: INormalizedPagination) {
    const where: Prisma.GeneratedDocumentWhereInput = { ticketId: filter.ticketId, templateCode: filter.templateCode };
    const [items, total] = await Promise.all([
      prisma.generatedDocument.findMany({
        where,
        include: { ticket: { select: { id: true, ticketNumber: true } } },
        orderBy: { generatedAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.generatedDocument.count({ where }),
    ]);
    return { items, total };
  }

  async createGenerated(data: { ticketId?: string; templateCode: string; runningNumber: string; fileUrl: string; generatedBy?: string }) {
    return prisma.generatedDocument.create({
      data: { id: randomUUID(), ...data },
      include: { ticket: { select: { id: true, ticketNumber: true } } },
    });
  }
}
