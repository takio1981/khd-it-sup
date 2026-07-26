import { z } from 'zod';

export const monthlyChartQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).default(new Date().getFullYear()),
});
export type MonthlyChartQueryDto = z.infer<typeof monthlyChartQuerySchema>;

export const rankingQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(50).default(10),
});
export type RankingQueryDto = z.infer<typeof rankingQuerySchema>;
