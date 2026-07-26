import { z } from 'zod';

export const createPositionSchema = z.object({
  code: z.string().min(1).max(50),
  nameTh: z.string().min(1).max(150),
  nameEn: z.string().max(150).optional(),
});
export type CreatePositionDto = z.infer<typeof createPositionSchema>;

export const updatePositionSchema = z.object({
  nameTh: z.string().min(1).max(150).optional(),
  nameEn: z.string().max(150).optional(),
});
export type UpdatePositionDto = z.infer<typeof updatePositionSchema>;

export const positionIdParamSchema = z.object({ id: z.string().uuid() });
