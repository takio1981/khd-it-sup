import { Router } from 'express';
import * as equipmentSyncController from '@modules/equipment-sync/controllers/equipmentSync.controller';
import { authenticate, requirePermission } from '@common/middleware';
import { PERMISSIONS } from '@common/constants/permissions.const';

const router = Router();
router.use(authenticate);

/**
 * @openapi
 * /equipment-sync/status:
 *   get:
 *     tags: [EquipmentSync]
 *     summary: สถานะการซิงค์ครุภัณฑ์จาก MOPH AssetTracker ล่าสุด (กำลังรันอยู่หรือไม่ + สรุปผล run ล่าสุด)
 *     security: [{ bearerAuth: [] }]
 */
router.get('/status', requirePermission(PERMISSIONS.ASSET_CREATE), equipmentSyncController.getStatus);

/**
 * @openapi
 * /equipment-sync/run:
 *   post:
 *     tags: [EquipmentSync]
 *     summary: สั่งซิงค์ครุภัณฑ์จาก MOPH AssetTracker ทันที (ทำงานเบื้องหลัง, poll /status เพื่อดูผล)
 *     security: [{ bearerAuth: [] }]
 */
router.post('/run', requirePermission(PERMISSIONS.ASSET_CREATE), equipmentSyncController.triggerSync);

export default router;
