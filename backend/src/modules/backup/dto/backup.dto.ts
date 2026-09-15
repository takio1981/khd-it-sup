import { z } from 'zod';
import { ALL_BACKUP_TABLES } from '@modules/backup/constants/backupTables.const';

const tableNameSchema = z.enum(ALL_BACKUP_TABLES as [string, ...string[]]);

export const runBackupSchema = z
  .object({
    scope: z.enum(['FULL', 'PARTIAL']).default('FULL'),
    includedTables: z.array(tableNameSchema).optional(),
  })
  .refine((data) => data.scope === 'FULL' || (data.includedTables && data.includedTables.length > 0), {
    message: 'ต้องเลือกอย่างน้อย 1 ตารางเมื่อสำรองข้อมูลแบบเลือกเฉพาะบางตาราง',
    path: ['includedTables'],
  });
export type RunBackupDto = z.infer<typeof runBackupSchema>;

export const restoreSchema = z.object({
  confirmPassword: z.string().min(1, 'กรุณากรอกรหัสผ่าน'),
  confirmFileName: z.string().min(1, 'กรุณากรอกชื่อไฟล์ยืนยัน'),
});
export type RestoreDto = z.infer<typeof restoreSchema>;

export const listBackupLogsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  action: z.enum(['BACKUP', 'RESTORE']).optional(),
  type: z.enum(['MANUAL', 'AUTOMATIC', 'SAFETY']).optional(),
  status: z.enum(['SUCCESS', 'FAILED']).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});
export type ListBackupLogsQueryDto = z.infer<typeof listBackupLogsQuerySchema>;

export const updateBackupSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  scope: z.enum(['FULL', 'PARTIAL']).optional(),
  includedTables: z.array(tableNameSchema).optional(),
  retentionDays: z.coerce.number().int().positive().max(365).optional(),
});
export type UpdateBackupSettingsDto = z.infer<typeof updateBackupSettingsSchema>;

export const backupIdParamsSchema = z.object({
  id: z.string().uuid('id ต้องเป็น UUID'),
});
export type BackupIdParamsDto = z.infer<typeof backupIdParamsSchema>;
