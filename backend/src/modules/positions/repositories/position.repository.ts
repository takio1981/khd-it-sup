import type { Prisma } from '@prisma/client';
import { prisma } from '@infrastructure/database/prisma';

export class PositionRepository {
  async findAll() {
    return prisma.position.findMany({
      where: { isActive: true },
      orderBy: { nameTh: 'asc' },
    });
  }

  async findById(id: string) {
    return prisma.position.findUnique({ where: { id } });
  }

  async findByCode(code: string) {
    return prisma.position.findUnique({ where: { code } });
  }

  async create(data: Prisma.PositionUncheckedCreateInput) {
    return prisma.position.create({ data });
  }

  async update(id: string, data: Prisma.PositionUncheckedUpdateInput) {
    return prisma.position.update({ where: { id }, data });
  }

  async softDeactivate(id: string) {
    return prisma.position.update({ where: { id }, data: { isActive: false } });
  }

  async countUsers(id: string): Promise<number> {
    return prisma.user.count({ where: { positionId: id, deletedAt: null } });
  }
}
