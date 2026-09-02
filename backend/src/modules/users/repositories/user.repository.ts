import type { Prisma } from '@prisma/client';
import { prisma } from '@infrastructure/database/prisma';
import type { INormalizedPagination } from '@common/utils/pagination';

export interface IUserListFilter {
  roleId?: string;
  departmentId?: string;
  keyword?: string;
}

const userListInclude = {
  role: { select: { id: true, code: true, nameTh: true } },
  department: { select: { id: true, nameTh: true } },
  position: { select: { id: true, nameTh: true } },
} satisfies Prisma.UserInclude;

/** สถานะที่ยังไม่ปิดงาน — ใช้เกณฑ์เดียวกับ dashboard.repository.ts's technicianWorkload() */
const OPEN_TICKET_STATUSES = ['CLOSED', 'CANCELLED'];

function buildWhere(filter: IUserListFilter): Prisma.UserWhereInput {
  return {
    deletedAt: null,
    roleId: filter.roleId,
    departmentId: filter.departmentId,
    ...(filter.keyword
      ? {
          OR: [
            { fullName: { contains: filter.keyword } },
            { username: { contains: filter.keyword } },
            { email: { contains: filter.keyword } },
          ],
        }
      : {}),
  };
}

export class UserRepository {
  async findAllRoles() {
    return prisma.role.findMany({ select: { id: true, code: true, nameTh: true }, orderBy: { nameTh: 'asc' } });
  }

  async findTechnicians() {
    return prisma.user.findMany({
      where: { deletedAt: null, isActive: true, role: { code: { in: ['TECHNICIAN', 'IT_OFFICER'] } } },
      select: { id: true, fullName: true, username: true, role: { select: { code: true } } },
      orderBy: { fullName: 'asc' },
    });
  }

  /** ภาระงานปัจจุบันของช่าง/เจ้าหน้าที่ไอทีทุกคน (รวมคนที่ยังไม่มีงานเลย = activeTicketCount 0 ด้วย) — ต่างจาก
   *  dashboard.repository.ts's technicianWorkload() ที่ group จากตั๋วที่มีอยู่แล้วเท่านั้น จึงไม่เห็นคนว่างที่ยังไม่มีตั๋ว */
  async findTechniciansWithWorkload() {
    const technicians = await prisma.user.findMany({
      where: { deletedAt: null, isActive: true, role: { code: { in: ['TECHNICIAN', 'IT_OFFICER'] } } },
      select: { id: true, fullName: true, username: true, role: { select: { code: true, nameTh: true } } },
      orderBy: { fullName: 'asc' },
    });

    const counts = await prisma.repairTicket.groupBy({
      by: ['assignedTechnicianId'],
      _count: { _all: true },
      where: {
        assignedTechnicianId: { in: technicians.map((t) => t.id) },
        status: { notIn: OPEN_TICKET_STATUSES },
      },
    });
    const countByTechId = new Map(counts.map((c) => [c.assignedTechnicianId, c._count._all]));

    return technicians.map((t) => ({ ...t, activeTicketCount: countByTechId.get(t.id) ?? 0 }));
  }

  async findMany(filter: IUserListFilter, pagination: INormalizedPagination) {
    const where = buildWhere(filter);
    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: userListInclude,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);
    return { items, total };
  }

  async getStats() {
    const [total, active, inactive, mustChangePassword, byRoleRaw, byDeptRaw, byPositionRaw] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { deletedAt: null, isActive: true } }),
      prisma.user.count({ where: { deletedAt: null, isActive: false } }),
      prisma.user.count({ where: { deletedAt: null, mustChangePassword: true } }),
      prisma.user.groupBy({ by: ['roleId'], where: { deletedAt: null }, _count: { _all: true } }),
      prisma.user.groupBy({ by: ['departmentId'], where: { deletedAt: null, departmentId: { not: null } }, _count: { _all: true } }),
      prisma.user.groupBy({ by: ['positionId'], where: { deletedAt: null, positionId: { not: null } }, _count: { _all: true } }),
    ]);

    const roles = await prisma.role.findMany({ select: { id: true, nameTh: true } });
    const roleNameById = new Map(roles.map((r) => [r.id, r.nameTh]));
    const byRole = byRoleRaw
      .map((r) => ({ roleId: r.roleId, roleNameTh: roleNameById.get(r.roleId) ?? 'ไม่ระบุ', count: r._count._all }))
      .sort((a, b) => b.count - a.count);

    const deptIds = byDeptRaw.map((d) => d.departmentId).filter((id): id is string => id !== null);
    const depts = await prisma.department.findMany({ where: { id: { in: deptIds } }, select: { id: true, nameTh: true } });
    const deptNameById = new Map(depts.map((d) => [d.id, d.nameTh]));
    const byDepartment = byDeptRaw
      .map((d) => ({ departmentId: d.departmentId, departmentNameTh: deptNameById.get(d.departmentId!) ?? 'ไม่ระบุ', count: d._count._all }))
      .sort((a, b) => b.count - a.count);

    const positionIds = byPositionRaw.map((p) => p.positionId).filter((id): id is string => id !== null);
    const positionsList = await prisma.position.findMany({ where: { id: { in: positionIds } }, select: { id: true, nameTh: true } });
    const positionNameById = new Map(positionsList.map((p) => [p.id, p.nameTh]));
    const byPosition = byPositionRaw
      .map((p) => ({ positionId: p.positionId, positionNameTh: positionNameById.get(p.positionId!) ?? 'ไม่ระบุ', count: p._count._all }))
      .sort((a, b) => b.count - a.count);

    return { total, active, inactive, mustChangePassword, byRole, byDepartment, byPosition };
  }

  async findById(id: string) {
    return prisma.user.findFirst({ where: { id, deletedAt: null }, include: userListInclude });
  }

  async findByUsernameOrEmail(username: string, email: string) {
    return prisma.user.findFirst({ where: { OR: [{ username }, { email }] } });
  }

  async findRoleByCode(code: string) {
    return prisma.role.findUnique({ where: { code } });
  }

  /** ใช้เฉพาะ equipment-sync — โหลดชื่อ/username ผู้ใช้ทุกคน (รวมที่เคยสร้างจาก sync ก่อนหน้า) ครั้งเดียวก่อนเริ่ม sync เพื่อจับคู่ owner ตามชื่อแทน query ทีละแถว */
  async findAllForOwnerMatch() {
    return prisma.user.findMany({ where: { deletedAt: null }, select: { id: true, fullName: true, username: true } });
  }

  async create(data: Prisma.UserUncheckedCreateInput) {
    return prisma.user.create({ data, include: userListInclude });
  }

  async createMinimal(data: Prisma.UserUncheckedCreateInput) {
    return prisma.user.create({ data, select: { id: true } });
  }

  async update(id: string, data: Prisma.UserUncheckedUpdateInput) {
    return prisma.user.update({ where: { id }, data, include: userListInclude });
  }

  async softDelete(id: string) {
    return prisma.user.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  }
}
