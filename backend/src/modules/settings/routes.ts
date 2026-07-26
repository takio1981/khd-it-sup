import { Router } from 'express';
import * as systemSettingController from '@modules/settings/controllers/systemSetting.controller';
import { updateNotificationSettingsSchema } from '@modules/settings/dto/systemSetting.dto';
import { authenticate, requirePermission, validateRequest } from '@common/middleware';
import { PERMISSIONS } from '@common/constants/permissions.const';

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

export default router;
