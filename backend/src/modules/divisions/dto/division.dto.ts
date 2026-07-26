import { z } from 'zod';

export const createDivisionSchema = z.object({
  code: z.string().min(1).max(50),
  nameTh: z.string().min(1).max(150),
  nameEn: z.string().max(150).optional(),
  departmentId: z.string().uuid(),
});
export type CreateDivisionDto = z.infer<typeof createDivisionSchema>;

export const updateDivisionSchema = z.object({
  nameTh: z.string().min(1).max(150).optional(),
  nameEn: z.string().max(150).optional(),
  departmentId: z.string().uuid().optional(),
});
export type UpdateDivisionDto = z.infer<typeof updateDivisionSchema>;

export const divisionIdParamSchema = z.object({ id: z.string().uuid() });
