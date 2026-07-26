import { Router } from 'express';
import * as notificationController from '@modules/notifications/controllers/notification.controller';
import { listNotificationLogsQuerySchema } from '@modules/notifications/dto/notification.dto';
import { authenticate, requirePermission, validateRequest } from '@common/middleware';
import { PERMISSIONS } from '@common/constants/permissions.const';

const router = Router();
router.use(authenticate);

/**
 * @openapi
 * /notifications/logs:
 *   get:
 *     tags: [Notifications]
 *     summary: ประวัติการแจ้งเตือนทุกช่องทาง (Email/Telegram/LINE) ใช้ตรวจสอบสถานะการส่ง
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  '/logs',
  requirePermission(PERMISSIONS.AUDIT_VIEW, PERMISSIONS.SETTINGS_MANAGE),
  validateRequest({ query: listNotificationLogsQuerySchema }),
  notificationController.listNotificationLogs,
);

export default router;
