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

export const updateProfileSchema = z.object({
  gender: z.enum(['MALE', 'FEMALE']),
});
export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;

export const forgotPasswordSchema = z.object({
  usernameOrEmail: z.string().min(1, 'กรุณากรอกชื่อผู้ใช้หรืออีเมล'),
});
export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้อง'),
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
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;

/** PIN ที่เดาง่ายเกินไป — เลขซ้ำล้วน (000000, 111111, ...) หรือเรียงขึ้น/ลงต่อเนื่องทั้ง 6 หลัก */
function isWeakPin(pin: string): boolean {
  if (/^(\d)\1{5}$/.test(pin)) return true;
  return '0123456789'.includes(pin) || '9876543210'.includes(pin);
}

export const pinSetupSchema = z.object({
  password: z.string().min(1, 'กรุณากรอกรหัสผ่านปัจจุบัน'),
  pin: z
    .string()
    .regex(/^\d{6}$/, 'PIN ต้องเป็นตัวเลข 6 หลัก')
    .refine((p) => !isWeakPin(p), 'PIN นี้คาดเดาง่ายเกินไป กรุณาเลือก PIN อื่น'),
});
export type PinSetupDto = z.infer<typeof pinSetupSchema>;

export const pinLoginSchema = z.object({
  pin: z.string().regex(/^\d{6}$/, 'PIN ต้องเป็นตัวเลข 6 หลัก'),
});
export type PinLoginDto = z.infer<typeof pinLoginSchema>;
