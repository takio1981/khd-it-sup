import type { Request, Response } from 'express';
import { dashboardService } from '@modules/dashboard/services/dashboard.service';
import type { DashboardExportQueryDto, MonthlyChartQueryDto, RankingQueryDto } from '@modules/dashboard/dto/dashboard.dto';
import { asyncHandler } from '@common/utils/asyncHandler';
import { sendSuccess } from '@common/utils/apiResponse';
import { buildMultiSheetExcelBuffer, type IExportSheet } from '@common/utils/export.util';

const ASSET_STATUS_LABEL_TH: Record<string, string> = {
  ACTIVE: 'ใช้งานปกติ',
  IN_REPAIR: 'อยู่ระหว่างซ่อม',
  WAITING_PARTS: 'รออะไหล่',
  MAINTENANCE: 'ซ่อมบำรุง',
  RESERVED: 'สำรองใช้งาน',
  INACTIVE: 'ปิดใช้งาน',
  DISPOSED: 'จำหน่ายแล้ว',
  LOST: 'สูญหาย',
};

export const getSummary = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await dashboardService.getSummary());
});

export const getMonthlyChart = asyncHandler(async (req: Request, res: Response) => {
  const { year } = req.query as unknown as MonthlyChartQueryDto;
  sendSuccess(res, await dashboardService.getMonthlyChart(year));
});

export const getYearlyChart = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await dashboardService.getYearlyChart());
});

export const getDepartmentRanking = asyncHandler(async (req: Request, res: Response) => {
  const { limit } = req.query as unknown as RankingQueryDto;
  sendSuccess(res, await dashboardService.getDepartmentRanking(limit));
});

export const getTechnicianWorkload = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await dashboardService.getTechnicianWorkload());
});

export const getAnalytics = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await dashboardService.getAnalytics());
});

export const exportDashboard = asyncHandler(async (req: Request, res: Response) => {
  const { year } = req.query as unknown as DashboardExportQueryDto;

  const [summary, monthly, departmentRanking] = await Promise.all([
    dashboardService.getSummary(),
    dashboardService.getMonthlyChart(year),
    dashboardService.getDepartmentRanking(20),
  ]);

  const sheets: IExportSheet[] = [
    {
      sheetName: 'สรุป',
      columns: [
        { header: 'รายการ', key: 'label', width: 30 },
        { header: 'จำนวน', key: 'value', width: 14 },
      ],
      rows: [
        { label: 'งานแจ้งซ่อมทั้งหมด', value: summary.tickets.total },
        { label: 'งานที่ค้างดำเนินการ', value: summary.tickets.pending },
        { label: 'งานที่ปิดแล้ว', value: summary.tickets.completed },
        { label: 'งานที่รออะไหล่', value: summary.tickets.waitingParts },
        { label: 'งานที่ยกเลิก', value: summary.tickets.cancelled },
        { label: 'ครุภัณฑ์ทั้งหมด', value: summary.assets.total },
        ...summary.assets.byStatus.map((a) => ({
          label: `ครุภัณฑ์: ${ASSET_STATUS_LABEL_TH[a.status] ?? a.status}`,
          value: a.count,
        })),
      ],
    },
    {
      sheetName: `รายเดือน ${year}`,
      columns: [
        { header: 'เดือน', key: 'month', width: 14 },
        { header: 'จำนวนใบแจ้งซ่อม', key: 'count', width: 18 },
      ],
      rows: monthly.map((m) => ({ month: m.month, count: m.count })),
    },
    {
      sheetName: 'อันดับหน่วยงาน',
      columns: [
        { header: 'หน่วยงาน', key: 'departmentName', width: 30 },
        { header: 'จำนวนใบแจ้งซ่อม', key: 'ticketCount', width: 18 },
      ],
      rows: departmentRanking.map((d) => ({ departmentName: d.departmentName, ticketCount: d.ticketCount })),
    },
  ];

  const buffer = await buildMultiSheetExcelBuffer(sheets);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="dashboard-${year}-${Date.now()}.xlsx"`);
  res.send(buffer);
});
