import { z } from 'zod';

export const createDepartmentSchema = z.object({
  code: z.string().min(1).max(50),
  nameTh: z.string().min(1).max(200),
  nameEn: z.string().max(200).optional(),
  parentId: z.string().uuid().nullable().optional(),
});
export type CreateDepartmentDto = z.infer<typeof createDepartmentSchema>;

export const updateDepartmentSchema = z.object({
  nameTh: z.string().min(1).max(200).optional(),
  nameEn: z.string().max(200).optional(),
  parentId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateDepartmentDto = z.infer<typeof updateDepartmentSchema>;

export const departmentIdParamSchema = z.object({ id: z.string().uuid() });
