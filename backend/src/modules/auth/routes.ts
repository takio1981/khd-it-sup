import { Router } from 'express';
import * as authController from '@modules/auth/controllers/auth.controller';
import { changePasswordSchema, loginSchema } from '@modules/auth/dto/auth.dto';
import { authenticate, loginRateLimiter, validateRequest } from '@common/middleware';

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

export default router;
