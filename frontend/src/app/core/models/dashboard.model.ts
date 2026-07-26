export interface IDashboardSummary {
  tickets: {
    pending: number;
    completed: number;
    waitingParts: number;
    cancelled: number;
    total: number;
  };
  assets: {
    total: number;
    byStatus: { status: string; count: number }[];
  };
}

export interface IMonthlyChartPoint {
  month: string;
  count: number;
}

export interface IYearlyChartPoint {
  year: string;
  count: number;
}

export interface IDepartmentRankingItem {
  departmentId: string | null;
  departmentName: string;
  ticketCount: number;
}

export interface ITechnicianWorkloadItem {
  technicianId: string | null;
  technicianName: string;
  openTicketCount: number;
}

export interface IDashboardAnalytics {
  averageRepairTimeHours: number | null;
  topRepairedCategories: { categoryName: string; repairCount: number }[];
}
