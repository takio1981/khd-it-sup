import { z } from 'zod';

export const listNotificationLogsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  channel: z.enum(['EMAIL', 'TELEGRAM', 'LINE', 'PUSH', 'SMS']).optional(),
  status: z.enum(['PENDING', 'SENT', 'FAILED', 'READ']).optional(),
});
export type ListNotificationLogsQueryDto = z.infer<typeof listNotificationLogsQuerySchema>;
