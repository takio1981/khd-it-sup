import { z } from 'zod';

export const listAuditLogsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  module: z.string().optional(),
  action: z.enum(['LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE', 'PRINT', 'EXPORT', 'APPROVE', 'CONFIG_CHANGE']).optional(),
  userId: z.string().uuid('userId ต้องเป็น UUID').optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});
export type ListAuditLogsQueryDto = z.infer<typeof listAuditLogsQuerySchema>;

export const exportAuditLogsQuerySchema = z.object({
  module: z.string().optional(),
  action: z.enum(['LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE', 'PRINT', 'EXPORT', 'APPROVE', 'CONFIG_CHANGE']).optional(),
  userId: z.string().uuid('userId ต้องเป็น UUID').optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  format: z.enum(['xlsx', 'csv']).default('xlsx'),
});
export type ExportAuditLogsQueryDto = z.infer<typeof exportAuditLogsQuerySchema>;
