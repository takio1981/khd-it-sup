import { z } from 'zod';

export const vendorOrderStatusEnum = z.enum([
  'QUOTATION_REQUESTED',
  'QUOTATION_RECEIVED',
  'APPROVED',
  'PO_GENERATED',
  'SENT',
  'IN_REPAIR',
  'RETURNED',
  'INSPECTED',
  'COMPLETED',
  'CANCELLED',
]);

export const createVendorOrderSchema = z.object({
  ticketId: z.string().uuid('ticketId ต้องเป็น UUID'),
  vendorId: z.string().uuid('vendorId ต้องเป็น UUID'),
  quotationAmount: z.coerce.number().nonnegative().optional(),
});
export type CreateVendorOrderDto = z.infer<typeof createVendorOrderSchema>;

export const updateVendorOrderSchema = z.object({
  status: vendorOrderStatusEnum.optional(),
  vendorId: z.string().uuid().optional(),
  quotationAmount: z.coerce.number().nonnegative().optional(),
  poNumber: z.string().max(50).optional(),
  sentAt: z.coerce.date().optional(),
  receivedAt: z.coerce.date().optional(),
  warrantyUntil: z.coerce.date().optional(),
});
export type UpdateVendorOrderDto = z.infer<typeof updateVendorOrderSchema>;

export const listVendorOrdersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  ticketId: z.string().uuid().optional(),
  vendorId: z.string().uuid().optional(),
  status: vendorOrderStatusEnum.optional(),
});
export type ListVendorOrdersQueryDto = z.infer<typeof listVendorOrdersQuerySchema>;

export const vendorOrderIdParamSchema = z.object({ id: z.string().uuid('id ต้องเป็น UUID') });
