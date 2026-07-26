import type { Prisma } from '@prisma/client';
import { prisma } from '@infrastructure/database/prisma';

const departmentSelect = { department: { select: { id: true, nameTh: true } } } satisfies Prisma.DivisionInclude;

export class DivisionRepository {
  async findAll() {
    return prisma.division.findMany({
      where: { isActive: true },
      include: departmentSelect,
      orderBy: { nameTh: 'asc' },
    });
  }

  async findById(id: string) {
    return prisma.division.findUnique({ where: { id }, include: departmentSelect });
  }

  async findByCode(code: string) {
    return prisma.division.findUnique({ where: { code } });
  }

  async create(data: Prisma.DivisionUncheckedCreateInput) {
    return prisma.division.create({ data, include: departmentSelect });
  }

  async update(id: string, data: Prisma.DivisionUncheckedUpdateInput) {
    return prisma.division.update({ where: { id }, data, include: departmentSelect });
  }

  async softDeactivate(id: string) {
    return prisma.division.update({ where: { id }, data: { isActive: false } });
  }
}
