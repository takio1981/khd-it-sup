import { Router } from 'express';
import * as systemSettingController from '@modules/settings/controllers/systemSetting.controller';
import { updateNotificationSettingsSchema, updateOrgSettingsSchema } from '@modules/settings/dto/systemSetting.dto';
import { authenticate, requirePermission, validateRequest } from '@common/middleware';
import { PERMISSIONS } from '@common/constants/permissions.const';
import { logoUploader } from '@infrastructure/storage/multer.config';

const router = Router();
router.use(authenticate);

/**
 * @openapi
 * /settings/notifications:
 *   get:
 *     tags: [Settings]
 *     summary: ดึงค่าตั้งค่าระบบแจ้งเตือน (เปิด/ปิดช่องทางอีเมล และเหตุการณ์แต่ละประเภท)
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  '/notifications',
  requirePermission(PERMISSIONS.SETTINGS_MANAGE, PERMISSIONS.AUDIT_VIEW),
  systemSettingController.getNotificationSettings,
);

/**
 * @openapi
 * /settings/notifications:
 *   patch:
 *     tags: [Settings]
 *     summary: แก้ไขค่าตั้งค่าระบบแจ้งเตือน
 *     security: [{ bearerAuth: [] }]
 */
router.patch(
  '/notifications',
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  validateRequest({ body: updateNotificationSettingsSchema }),
  systemSettingController.updateNotificationSettings,
);

/**
 * @openapi
 * /settings/branding:
 *   get:
 *     tags: [Settings]
 *     summary: ชื่อองค์กร/โลโก้ — ให้ผู้ใช้ทุกคนที่ login แล้วเรียกได้ (ใช้แสดงใน topbar/sidebar)
 *     security: [{ bearerAuth: [] }]
 */
router.get('/branding', systemSettingController.getBranding);

/**
 * @openapi
 * /settings/org:
 *   get:
 *     tags: [Settings]
 *     summary: ดึงค่าตั้งค่าทั่วไป (ชื่อองค์กร/โลโก้/ธีมสี/SMTP)
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  '/org',
  requirePermission(PERMISSIONS.SETTINGS_MANAGE, PERMISSIONS.AUDIT_VIEW),
  systemSettingController.getOrgSettings,
);

/**
 * @openapi
 * /settings/org:
 *   patch:
 *     tags: [Settings]
 *     summary: แก้ไขค่าตั้งค่าทั่วไป (ชื่อองค์กร/ธีมสี/SMTP) — มีผลทันทีไม่ต้อง restart
 *     security: [{ bearerAuth: [] }]
 */
router.patch(
  '/org',
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  validateRequest({ body: updateOrgSettingsSchema }),
  systemSettingController.updateOrgSettings,
);

/**
 * @openapi
 * /settings/org/logo:
 *   post:
 *     tags: [Settings]
 *     summary: อัปโหลดโลโก้องค์กร (multipart/form-data, field "logo")
 *     security: [{ bearerAuth: [] }]
 */
router.post('/org/logo', requirePermission(PERMISSIONS.SETTINGS_MANAGE), logoUploader.single('logo'), systemSettingController.uploadOrgLogo);

/**
 * @openapi
 * /settings/org/logo:
 *   delete:
 *     tags: [Settings]
 *     summary: ลบโลโก้องค์กร (กลับไปใช้ค่าเริ่มต้น)
 *     security: [{ bearerAuth: [] }]
 */
router.delete('/org/logo', requirePermission(PERMISSIONS.SETTINGS_MANAGE), systemSettingController.removeOrgLogo);

export default router;
