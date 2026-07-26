import { DashboardRepository } from '@modules/dashboard/repositories/dashboard.repository';

export class DashboardService {
  private readonly repo = new DashboardRepository();

  async getSummary() {
    const [tickets, assetsByStatus] = await Promise.all([
      this.repo.countTicketsByCondition(),
      this.repo.countAssetsByStatus(),
    ]);

    return {
      tickets,
      assets: {
        total: assetsByStatus.reduce((sum, a) => sum + a._count._all, 0),
        byStatus: assetsByStatus.map((a) => ({ status: a.status, count: a._count._all })),
      },
    };
  }

  async getMonthlyChart(year: number) {
    const rows = await this.repo.monthlyTicketCounts(year);
    return rows.map((r) => ({ month: r.month, count: Number(r.count) }));
  }

  async getYearlyChart() {
    const rows = await this.repo.yearlyTicketCounts();
    return rows.map((r) => ({ year: String(r.year), count: Number(r.count) }));
  }

  async getDepartmentRanking(limit: number) {
    return this.repo.departmentRanking(limit);
  }

  async getTechnicianWorkload() {
    return this.repo.technicianWorkload();
  }

  async getAnalytics() {
    const [avgRepairSeconds, topCategories] = await Promise.all([
      this.repo.averageRepairTimeSeconds(),
      this.repo.topRepairedCategories(10),
    ]);

    return {
      averageRepairTimeHours: avgRepairSeconds != null ? Math.round((avgRepairSeconds / 3600) * 10) / 10 : null,
      topRepairedCategories: topCategories.map((c) => ({ categoryName: c.category_name, repairCount: Number(c.repair_count) })),
    };
  }
}

export const dashboardService = new DashboardService();
