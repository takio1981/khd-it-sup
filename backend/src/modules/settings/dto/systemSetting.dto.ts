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
  notifyAssetBorrowed: z.boolean().optional(),
  notifyAssetReturned: z.boolean().optional(),
  notifyAssetOverdue: z.boolean().optional(),
});
export type UpdateNotificationSettingsDto = z.infer<typeof updateNotificationSettingsSchema>;

export const updateOrgSettingsSchema = z.object({
  orgNameTh: z.string().max(200).optional(),
  themeColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'themeColor ต้องเป็นรหัสสี hex เช่น #006C45')
    .optional(),
  smtpHost: z.string().max(255).optional(),
  smtpPort: z.coerce.number().int().positive().max(65535).optional(),
  smtpSecure: z.boolean().optional(),
  smtpUser: z.string().max(255).optional(),
  smtpPass: z.string().max(255).optional(),
  smtpFromEmail: z.string().max(255).optional(),
  smtpFromName: z.string().max(200).optional(),
});
export type UpdateOrgSettingsDto = z.infer<typeof updateOrgSettingsSchema>;
