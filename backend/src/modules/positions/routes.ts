import { Router } from 'express';
import * as positionController from '@modules/positions/controllers/position.controller';
import { createPositionSchema, positionIdParamSchema, updatePositionSchema } from '@modules/positions/dto/position.dto';
import { authenticate, requirePermission, validateRequest } from '@common/middleware';
import { PERMISSIONS } from '@common/constants/permissions.const';

const router = Router();
router.use(authenticate);

/**
 * @openapi
 * /positions:
 *   get:
 *     tags: [Positions]
 *     summary: รายชื่อตำแหน่งงานทั้งหมด (ใช้เติม dropdown ตอนสร้าง/แก้ไขผู้ใช้)
 *     security: [{ bearerAuth: [] }]
 */
router.get('/', positionController.listPositions);

/**
 * @openapi
 * /positions/{id}:
 *   get:
 *     tags: [Positions]
 *     summary: รายละเอียดตำแหน่งงาน
 *     security: [{ bearerAuth: [] }]
 */
router.get('/:id', validateRequest({ params: positionIdParamSchema }), positionController.getPosition);

/**
 * @openapi
 * /positions:
 *   post:
 *     tags: [Positions]
 *     summary: สร้างตำแหน่งงาน
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/',
  requirePermission(PERMISSIONS.USER_CREATE),
  validateRequest({ body: createPositionSchema }),
  positionController.createPosition,
);

/**
 * @openapi
 * /positions/{id}:
 *   patch:
 *     tags: [Positions]
 *     summary: แก้ไขตำแหน่งงาน
 *     security: [{ bearerAuth: [] }]
 */
router.patch(
  '/:id',
  requirePermission(PERMISSIONS.USER_UPDATE),
  validateRequest({ params: positionIdParamSchema, body: updatePositionSchema }),
  positionController.updatePosition,
);

/**
 * @openapi
 * /positions/{id}:
 *   delete:
 *     tags: [Positions]
 *     summary: ปิดใช้งานตำแหน่งงาน
 *     security: [{ bearerAuth: [] }]
 */
router.delete(
  '/:id',
  requirePermission(PERMISSIONS.USER_DELETE),
  validateRequest({ params: positionIdParamSchema }),
  positionController.deletePosition,
);

export default router;
