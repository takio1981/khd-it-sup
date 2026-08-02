import { z } from 'zod';

export const createSparePartSchema = z.object({
  code: z.string().min(1, 'กรุณากรอกรหัสอะไหล่').max(50),
  name: z.string().min(1, 'กรุณากรอกชื่ออะไหล่').max(200),
  unit: z.string().max(30).optional(),
  reorderLevel: z.coerce.number().int().nonnegative().optional(),
  unitCost: z.coerce.number().nonnegative().optional(),
});
export type CreateSparePartDto = z.infer<typeof createSparePartSchema>;

export const updateSparePartSchema = createSparePartSchema.partial().omit({ code: true });
export type UpdateSparePartDto = z.infer<typeof updateSparePartSchema>;

export const listSparePartsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  keyword: z.string().optional(),
  lowStockOnly: z.coerce.boolean().optional(),
});
export type ListSparePartsQueryDto = z.infer<typeof listSparePartsQuerySchema>;

export const sparePartIdParamSchema = z.object({ id: z.string().uuid('id ต้องเป็น UUID') });

export const spareTxnTypeEnum = z.enum(['RESERVE', 'ISSUE', 'RETURN', 'ADJUST', 'PURCHASE', 'RECEIVE']);

export const recordTransactionSchema = z
  .object({
    type: spareTxnTypeEnum,
    quantity: z.coerce.number().int(),
    ticketId: z.string().uuid().optional(),
    note: z.string().max(500).optional(),
  })
  .refine((d) => (d.type === 'ADJUST' ? d.quantity !== 0 : d.quantity > 0), {
    message: 'quantity ต้องมากกว่า 0 (ประเภท ADJUST ปรับติดลบได้แต่ต้องไม่เป็น 0)',
    path: ['quantity'],
  });
export type RecordTransactionDto = z.infer<typeof recordTransactionSchema>;

export const listTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  ticketId: z.string().uuid().optional(),
});
export type ListTransactionsQueryDto = z.infer<typeof listTransactionsQuerySchema>;
