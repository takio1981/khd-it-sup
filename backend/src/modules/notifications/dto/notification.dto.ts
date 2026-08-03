import { z } from 'zod';

export const listNotificationLogsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  channel: z.enum(['EMAIL', 'TELEGRAM', 'LINE', 'PUSH', 'SMS']).optional(),
  status: z.enum(['PENDING', 'SENT', 'FAILED', 'READ']).optional(),
});
export type ListNotificationLogsQueryDto = z.infer<typeof listNotificationLogsQuerySchema>;

export const exportNotificationLogsQuerySchema = z.object({
  channel: z.enum(['EMAIL', 'TELEGRAM', 'LINE', 'PUSH', 'SMS']).optional(),
  status: z.enum(['PENDING', 'SENT', 'FAILED', 'READ']).optional(),
  format: z.enum(['xlsx', 'csv']).default('xlsx'),
});
export type ExportNotificationLogsQueryDto = z.infer<typeof exportNotificationLogsQuerySchema>;

export const listMyNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});
export type ListMyNotificationsQueryDto = z.infer<typeof listMyNotificationsQuerySchema>;

export const notificationIdParamSchema = z.object({ id: z.string().uuid('id ต้องเป็น UUID') });
