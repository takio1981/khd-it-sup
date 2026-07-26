import { z } from 'zod';

const assetStatusEnum = z.enum([
  'ACTIVE',
  'IN_REPAIR',
  'WAITING_PARTS',
  'MAINTENANCE',
  'RESERVED',
  'INACTIVE',
  'DISPOSED',
  'LOST',
]);

export const createAssetSchema = z.object({
  govAssetNumber: z.string().max(100).optional(),
  serialNumber: z.string().max(150).optional(),
  model: z.string().max(150).optional(),
  brand: z.string().max(150).optional(),
  categoryId: z.string().uuid('categoryId ต้องเป็น UUID'),
  departmentId: z.string().uuid().optional(),
  buildingId: z.string().uuid().optional(),
  floorId: z.string().uuid().optional(),
  roomId: z.string().uuid().optional(),
  locationNote: z.string().max(255).optional(),
  purchaseDate: z.coerce.date().optional(),
  warrantyExpireDate: z.coerce.date().optional(),
  vendorId: z.string().uuid().optional(),
  price: z.coerce.number().nonnegative().optional(),
  ownerUserId: z.string().uuid().optional(),
  remark: z.string().optional(),
});
export type CreateAssetDto = z.infer<typeof createAssetSchema>;

export const updateAssetSchema = createAssetSchema.partial().extend({
  status: assetStatusEnum.optional(),
});
export type UpdateAssetDto = z.infer<typeof updateAssetSchema>;

export const listAssetsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  categoryId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  status: assetStatusEnum.optional(),
  keyword: z.string().optional(),
});
export type ListAssetsQueryDto = z.infer<typeof listAssetsQuerySchema>;

export const assetIdParamSchema = z.object({ id: z.string().uuid('id ต้องเป็น UUID') });

export const createCategorySchema = z.object({
  code: z.string().min(1).max(50),
  nameTh: z.string().min(1).max(150),
  nameEn: z.string().min(1).max(150),
  icon: z.string().max(100).optional(),
  requiresSerial: z.boolean().optional(),
});
export type CreateCategoryDto = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema.partial();
export type UpdateCategoryDto = z.infer<typeof updateCategorySchema>;

export const categoryIdParamSchema = z.object({ id: z.string().uuid('id ต้องเป็น UUID') });
