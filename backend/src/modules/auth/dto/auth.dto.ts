import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(1, 'กรุณากรอกชื่อผู้ใช้'),
  password: z.string().min(1, 'กรุณากรอกรหัสผ่าน'),
});
export type LoginDto = z.infer<typeof loginSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'กรุณากรอกรหัสผ่านปัจจุบัน'),
    newPassword: z
      .string()
      .min(8, 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร')
      .regex(/[A-Z]/, 'รหัสผ่านต้องมีตัวพิมพ์ใหญ่อย่างน้อย 1 ตัว')
      .regex(/[a-z]/, 'รหัสผ่านต้องมีตัวพิมพ์เล็กอย่างน้อย 1 ตัว')
      .regex(/[0-9]/, 'รหัสผ่านต้องมีตัวเลขอย่างน้อย 1 ตัว'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน',
    path: ['confirmPassword'],
  });
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;

export const updateNotificationChannelsSchema = z.object({
  telegramChatId: z.string().trim().max(50).nullable().optional(),
  lineUserId: z.string().trim().max(50).nullable().optional(),
});
export type UpdateNotificationChannelsDto = z.infer<typeof updateNotificationChannelsSchema>;
