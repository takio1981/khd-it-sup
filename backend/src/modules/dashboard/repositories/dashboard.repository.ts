import { Prisma } from '@prisma/client';
import { prisma } from '@infrastructure/database/prisma';

const OPEN_STATUSES = ['CLOSED', 'CANCELLED'];

export class DashboardRepository {
  async countTicketsByCondition() {
    const [pending, completed, waitingParts, cancelled, total] = await Promise.all([
      prisma.repairTicket.count({ where: { status: { notIn: OPEN_STATUSES } } }),
      prisma.repairTicket.count({ where: { status: 'CLOSED' } }),
      prisma.repairTicket.count({ where: { status: 'WAITING_PARTS' } }),
      prisma.repairTicket.count({ where: { status: 'CANCELLED' } }),
      prisma.repairTicket.count(),
    ]);
    return { pending, completed, waitingParts, cancelled, total };
  }

  async countAssetsByStatus() {
    return prisma.asset.groupBy({ by: ['status'], _count: { _all: true }, where: { deletedAt: null } });
  }

  async monthlyTicketCounts(year: number): Promise<{ month: string; count: bigint }[]> {
    return prisma.$queryRaw<{ month: string; count: bigint }[]>(
      Prisma.sql`
        SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS count
        FROM repair_tickets
        WHERE YEAR(created_at) = ${year}
        GROUP BY month
        ORDER BY month ASC
      `,
    );
  }

  async yearlyTicketCounts(): Promise<{ year: string; count: bigint }[]> {
    return prisma.$queryRaw<{ year: string; count: bigint }[]>(
      Prisma.sql`
        SELECT YEAR(created_at) AS year, COUNT(*) AS count
        FROM repair_tickets
        GROUP BY year
        ORDER BY year ASC
      `,
    );
  }

  async departmentRanking(limit: number) {
    const grouped = await prisma.repairTicket.groupBy({
      by: ['departmentId'],
      _count: { _all: true },
      where: { departmentId: { not: null } },
      orderBy: { _count: { departmentId: 'desc' } },
      take: limit,
    });

    const departments = await prisma.department.findMany({
      where: { id: { in: grouped.map((g) => g.departmentId).filter((id): id is string => id !== null) } },
      select: { id: true, nameTh: true },
    });
    const nameById = new Map(departments.map((d) => [d.id, d.nameTh]));

    return grouped.map((g) => ({
      departmentId: g.departmentId,
      departmentName: g.departmentId ? (nameById.get(g.departmentId) ?? 'ไม่ระบุ') : 'ไม่ระบุ',
      ticketCount: g._count._all,
    }));
  }

  async technicianWorkload() {
    const grouped = await prisma.repairTicket.groupBy({
      by: ['assignedTechnicianId'],
      _count: { _all: true },
      where: { assignedTechnicianId: { not: null }, status: { notIn: OPEN_STATUSES } },
      orderBy: { _count: { assignedTechnicianId: 'desc' } },
    });

    const technicians = await prisma.user.findMany({
      where: { id: { in: grouped.map((g) => g.assignedTechnicianId).filter((id): id is string => id !== null) } },
      select: { id: true, fullName: true },
    });
    const nameById = new Map(technicians.map((t) => [t.id, t.fullName]));

    return grouped.map((g) => ({
      technicianId: g.assignedTechnicianId,
      technicianName: g.assignedTechnicianId ? (nameById.get(g.assignedTechnicianId) ?? 'ไม่ระบุ') : 'ไม่ระบุ',
      openTicketCount: g._count._all,
    }));
  }

  async averageRepairTimeSeconds(): Promise<number | null> {
    const result = await prisma.$queryRaw<{ avg_seconds: number | null }[]>(
      Prisma.sql`
        SELECT AVG(TIMESTAMPDIFF(SECOND, created_at, closed_at)) AS avg_seconds
        FROM repair_tickets
        WHERE closed_at IS NOT NULL
      `,
    );
    return result[0]?.avg_seconds ?? null;
  }

  async topRepairedCategories(limit: number) {
    return prisma.$queryRaw<{ category_name: string; repair_count: bigint }[]>(
      Prisma.sql`
        SELECT ac.name_th AS category_name, COUNT(*) AS repair_count
        FROM repair_tickets rt
        JOIN assets a ON a.id = rt.asset_id
        JOIN asset_categories ac ON ac.id = a.category_id
        GROUP BY ac.id, ac.name_th
        ORDER BY repair_count DESC
        LIMIT ${limit}
      `,
    );
  }
}
