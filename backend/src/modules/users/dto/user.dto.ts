import { z } from 'zod';

export const createUserSchema = z.object({
  username: z.string().min(3, 'ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร').max(100),
  email: z.string().email('อีเมลไม่ถูกต้อง'),
  password: z.string().min(8, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'),
  fullName: z.string().min(1, 'กรุณากรอกชื่อ-นามสกุล'),
  phone: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE']).optional(),
  employeeCode: z.string().optional(),
  roleId: z.string().uuid('roleId ต้องเป็น UUID'),
  departmentId: z.string().uuid().optional(),
  positionId: z.string().uuid().optional(),
  isUnitHead: z.boolean().optional(),
});
export type CreateUserDto = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  email: z.string().email().optional(),
  fullName: z.string().min(1).optional(),
  phone: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE']).nullable().optional(),
  employeeCode: z.string().optional(),
  roleId: z.string().uuid().optional(),
  departmentId: z.string().uuid().nullable().optional(),
  positionId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
  isUnitHead: z.boolean().optional(),
});
export type UpdateUserDto = z.infer<typeof updateUserSchema>;

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  roleId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  keyword: z.string().optional(),
});
export type ListUsersQueryDto = z.infer<typeof listUsersQuerySchema>;

export const exportUsersQuerySchema = z.object({
  roleId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  keyword: z.string().optional(),
  format: z.enum(['xlsx', 'csv']).default('xlsx'),
});
export type ExportUsersQueryDto = z.infer<typeof exportUsersQuerySchema>;

export const userIdParamSchema = z.object({ id: z.string().uuid('id ต้องเป็น UUID') });
