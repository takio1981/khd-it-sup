import type { Prisma } from '@prisma/client';
import { prisma } from '@infrastructure/database/prisma';

export class DepartmentRepository {
  async findAll() {
    return prisma.department.findMany({
      where: { isActive: true },
      orderBy: { nameTh: 'asc' },
    });
  }

  async findById(id: string) {
    return prisma.department.findUnique({ where: { id } });
  }

  async findByCode(code: string) {
    return prisma.department.findUnique({ where: { code } });
  }

  async create(data: Prisma.DepartmentUncheckedCreateInput) {
    return prisma.department.create({ data });
  }

  async update(id: string, data: Prisma.DepartmentUncheckedUpdateInput) {
    return prisma.department.update({ where: { id }, data });
  }

  async softDeactivate(id: string) {
    return prisma.department.update({ where: { id }, data: { isActive: false } });
  }

  async countChildren(id: string): Promise<number> {
    return prisma.department.count({ where: { parentId: id } });
  }

  async countUsers(id: string): Promise<number> {
    return prisma.user.count({ where: { departmentId: id, deletedAt: null } });
  }

  async countDivisions(id: string): Promise<number> {
    return prisma.division.count({ where: { departmentId: id, isActive: true } });
  }
}
