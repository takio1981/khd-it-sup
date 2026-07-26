import { z } from 'zod';

export const assetIdParamSchema = z.object({ assetId: z.string().uuid('assetId ต้องเป็น UUID') });

export const bulkPrintSchema = z.object({
  assetIds: z.array(z.string().uuid()).min(1, 'กรุณาเลือกครุภัณฑ์อย่างน้อย 1 รายการ').max(100, 'พิมพ์ได้สูงสุดครั้งละ 100 รายการ'),
});
export type BulkPrintDto = z.infer<typeof bulkPrintSchema>;

export const qrTokenParamSchema = z.object({ token: z.string().min(1) });
