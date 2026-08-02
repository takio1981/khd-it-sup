import { z } from 'zod';

export const createVendorSchema = z.object({
  code: z.string().min(1, 'กรุณากรอกรหัสผู้ขาย/ผู้รับซ่อม').max(50),
  name: z.string().min(1, 'กรุณากรอกชื่อผู้ขาย/ผู้รับซ่อม').max(200),
  contactPerson: z.string().max(150).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().max(150).optional(),
  address: z.string().max(500).optional(),
  taxId: z.string().max(30).optional(),
});
export type CreateVendorDto = z.infer<typeof createVendorSchema>;

export const updateVendorSchema = createVendorSchema.partial().omit({ code: true }).extend({
  isActive: z.boolean().optional(),
});
export type UpdateVendorDto = z.infer<typeof updateVendorSchema>;

export const listVendorsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  keyword: z.string().optional(),
  activeOnly: z.coerce.boolean().optional(),
});
export type ListVendorsQueryDto = z.infer<typeof listVendorsQuerySchema>;

export const vendorIdParamSchema = z.object({ id: z.string().uuid('id ต้องเป็น UUID') });
