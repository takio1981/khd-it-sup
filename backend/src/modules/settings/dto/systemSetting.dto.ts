import { z } from 'zod';

export const updateNotificationSettingsSchema = z.object({
  emailEnabled: z.boolean().optional(),
  telegramEnabled: z.boolean().optional(),
  telegramChatId: z.string().max(100).optional(),
  telegramBotToken: z.string().max(255).optional(),
  lineEnabled: z.boolean().optional(),
  lineTargetId: z.string().max(100).optional(),
  lineAccessToken: z.string().max(255).optional(),
  notifyNewTicket: z.boolean().optional(),
  notifyAssign: z.boolean().optional(),
  notifyStatusChange: z.boolean().optional(),
  notifyComplete: z.boolean().optional(),
  notifyCancel: z.boolean().optional(),
});
export type UpdateNotificationSettingsDto = z.infer<typeof updateNotificationSettingsSchema>;
