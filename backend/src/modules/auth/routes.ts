import { Router } from 'express';
import * as authController from '@modules/auth/controllers/auth.controller';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  updateNotificationChannelsSchema,
  updateProfileSchema,
} from '@modules/auth/dto/auth.dto';
import { authenticate, loginRateLimiter, validateRequest } from '@common/middleware';
import { avatarUploader } from '@infrastructure/storage/multer.config';

const router = Router();

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: เข้าสู่ระบบ
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username: { type: string }
 *               password: { type: string, format: password }
 *     responses:
 *       200: { description: เข้าสู่ระบบสำเร็จ }
 *       401: { description: ข้อมูลเข้าสู่ระบบไม่ถูกต้อง }
 */
router.post('/login', loginRateLimiter, validateRequest({ body: loginSchema }), authController.login);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: ขอ Access Token ใหม่ด้วย Refresh Token (httpOnly cookie)
 *     responses:
 *       200: { description: ออก Token ใหม่สำเร็จ }
 *       401: { description: Refresh Token ไม่ถูกต้องหรือหมดอายุ }
 */
router.post('/refresh', authController.refresh);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: ออกจากระบบ (revoke refresh token ปัจจุบัน)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: ออกจากระบบสำเร็จ }
 */
router.post('/logout', authenticate, authController.logout);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: ข้อมูลผู้ใช้ปัจจุบันและสิทธิ์ทั้งหมด
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: สำเร็จ }
 */
router.get('/me', authenticate, authController.me);

/**
 * @openapi
 * /auth/change-password:
 *   post:
 *     tags: [Auth]
 *     summary: เปลี่ยนรหัสผ่านของตนเอง
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: เปลี่ยนรหัสผ่านสำเร็จ }
 */
router.post(
  '/change-password',
  authenticate,
  validateRequest({ body: changePasswordSchema }),
  authController.changePassword,
);

/**
 * @openapi
 * /auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: ขอลิงก์ตั้งรหัสผ่านใหม่แบบ self-service (ส่งอีเมล) — ตอบสำเร็จเสมอไม่ว่าจะพบบัญชีหรือไม่
 *     responses:
 *       200: { description: สำเร็จ }
 */
router.post('/forgot-password', loginRateLimiter, validateRequest({ body: forgotPasswordSchema }), authController.forgotPassword);

/**
 * @openapi
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: ตั้งรหัสผ่านใหม่ด้วย token จากอีเมล
 *     responses:
 *       200: { description: สำเร็จ }
 *       400: { description: token ไม่ถูกต้องหรือหมดอายุ }
 */
router.post('/reset-password', loginRateLimiter, validateRequest({ body: resetPasswordSchema }), authController.resetPassword);

/**
 * @openapi
 * /auth/notification-channels:
 *   get:
 *     tags: [Auth]
 *     summary: ดูช่องทางการแจ้งเตือนส่วนตัว (Telegram/LINE) ของตนเอง
 *     security: [{ bearerAuth: [] }]
 */
router.get('/notification-channels', authenticate, authController.getNotificationChannels);

/**
 * @openapi
 * /auth/notification-channels:
 *   patch:
 *     tags: [Auth]
 *     summary: ตั้งค่าช่องทางการแจ้งเตือนส่วนตัว (Telegram Chat ID / LINE User ID) ของตนเอง
 *     security: [{ bearerAuth: [] }]
 */
router.patch(
  '/notification-channels',
  authenticate,
  validateRequest({ body: updateNotificationChannelsSchema }),
  authController.updateNotificationChannels,
);

/**
 * @openapi
 * /auth/profile:
 *   patch:
 *     tags: [Auth]
 *     summary: ตั้งค่าเพศของตนเอง (ใช้เลือกภาพ avatar เริ่มต้นเมื่อยังไม่อัปโหลดรูปโปรไฟล์)
 *     security: [{ bearerAuth: [] }]
 */
router.patch('/profile', authenticate, validateRequest({ body: updateProfileSchema }), authController.updateProfile);

/**
 * @openapi
 * /auth/avatar:
 *   post:
 *     tags: [Auth]
 *     summary: อัปโหลดรูปโปรไฟล์ของตนเอง (multipart/form-data, field name "avatar")
 *     security: [{ bearerAuth: [] }]
 */
router.post('/avatar', authenticate, avatarUploader.single('avatar'), authController.uploadMyAvatar);

/**
 * @openapi
 * /auth/avatar:
 *   delete:
 *     tags: [Auth]
 *     summary: ลบรูปโปรไฟล์ของตนเอง (กลับไปใช้ avatar เริ่มต้นตามเพศ)
 *     security: [{ bearerAuth: [] }]
 */
router.delete('/avatar', authenticate, authController.removeMyAvatar);

export default router;
