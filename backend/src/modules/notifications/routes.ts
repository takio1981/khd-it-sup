import { Router } from 'express';
import * as notificationController from '@modules/notifications/controllers/notification.controller';
import {
  listMyNotificationsQuerySchema,
  listNotificationLogsQuerySchema,
  notificationIdParamSchema,
} from '@modules/notifications/dto/notification.dto';
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

/**
 * @openapi
 * /notifications/me:
 *   get:
 *     tags: [Notifications]
 *     summary: แจ้งเตือนในแอป (bell) ของตนเอง
 *     security: [{ bearerAuth: [] }]
 */
router.get('/me', validateRequest({ query: listMyNotificationsQuerySchema }), notificationController.listMyNotifications);

/**
 * @openapi
 * /notifications/me/unread-count:
 *   get:
 *     tags: [Notifications]
 *     summary: จำนวนแจ้งเตือนในแอปที่ยังไม่อ่านของตนเอง
 *     security: [{ bearerAuth: [] }]
 */
router.get('/me/unread-count', notificationController.getMyUnreadCount);

/**
 * @openapi
 * /notifications/me/read-all:
 *   patch:
 *     tags: [Notifications]
 *     summary: อ่านแจ้งเตือนในแอปทั้งหมด
 *     security: [{ bearerAuth: [] }]
 */
router.patch('/me/read-all', notificationController.markAllMyNotificationsRead);

/**
 * @openapi
 * /notifications/me/{id}/read:
 *   patch:
 *     tags: [Notifications]
 *     summary: อ่านแจ้งเตือนในแอปรายการเดียว
 *     security: [{ bearerAuth: [] }]
 */
router.patch(
  '/me/:id/read',
  validateRequest({ params: notificationIdParamSchema }),
  notificationController.markMyNotificationRead,
);

export default router;
