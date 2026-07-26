import { Router } from 'express';
import * as divisionController from '@modules/divisions/controllers/division.controller';
import { createDivisionSchema, divisionIdParamSchema, updateDivisionSchema } from '@modules/divisions/dto/division.dto';
import { authenticate, requirePermission, validateRequest } from '@common/middleware';
import { PERMISSIONS } from '@common/constants/permissions.const';

const router = Router();
router.use(authenticate);

/**
 * @openapi
 * /divisions:
 *   get:
 *     tags: [Divisions]
 *     summary: รายชื่อแผนกทั้งหมด (ใช้เติม dropdown)
 *     security: [{ bearerAuth: [] }]
 */
router.get('/', divisionController.listDivisions);

/**
 * @openapi
 * /divisions/{id}:
 *   get:
 *     tags: [Divisions]
 *     summary: รายละเอียดแผนก
 *     security: [{ bearerAuth: [] }]
 */
router.get('/:id', validateRequest({ params: divisionIdParamSchema }), divisionController.getDivision);

/**
 * @openapi
 * /divisions:
 *   post:
 *     tags: [Divisions]
 *     summary: สร้างแผนก
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/',
  requirePermission(PERMISSIONS.DEPARTMENT_MANAGE),
  validateRequest({ body: createDivisionSchema }),
  divisionController.createDivision,
);

/**
 * @openapi
 * /divisions/{id}:
 *   patch:
 *     tags: [Divisions]
 *     summary: แก้ไขแผนก
 *     security: [{ bearerAuth: [] }]
 */
router.patch(
  '/:id',
  requirePermission(PERMISSIONS.DEPARTMENT_MANAGE),
  validateRequest({ params: divisionIdParamSchema, body: updateDivisionSchema }),
  divisionController.updateDivision,
);

/**
 * @openapi
 * /divisions/{id}:
 *   delete:
 *     tags: [Divisions]
 *     summary: ปิดใช้งานแผนก
 *     security: [{ bearerAuth: [] }]
 */
router.delete(
  '/:id',
  requirePermission(PERMISSIONS.DEPARTMENT_MANAGE),
  validateRequest({ params: divisionIdParamSchema }),
  divisionController.deleteDivision,
);

export default router;
