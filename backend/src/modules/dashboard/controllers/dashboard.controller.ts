import type { Request, Response } from 'express';
import { dashboardService } from '@modules/dashboard/services/dashboard.service';
import type { MonthlyChartQueryDto, RankingQueryDto } from '@modules/dashboard/dto/dashboard.dto';
import { asyncHandler } from '@common/utils/asyncHandler';
import { sendSuccess } from '@common/utils/apiResponse';

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
