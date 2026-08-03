import { Router } from 'express';
import * as sparePartController from '@modules/spare-parts/controllers/sparePart.controller';
import {
  createSparePartSchema,
  exportSparePartsQuerySchema,
  listSparePartsQuerySchema,
  listTransactionsQuerySchema,
  recordTransactionSchema,
  sparePartIdParamSchema,
  updateSparePartSchema,
} from '@modules/spare-parts/dto/sparePart.dto';
import { authenticate, requirePermission, validateRequest } from '@common/middleware';
import { PERMISSIONS } from '@common/constants/permissions.const';

const router = Router();
router.use(authenticate);

const VIEW_PERMS = [PERMISSIONS.SPARE_PART_VIEW, PERMISSIONS.SPARE_PART_MANAGE, PERMISSIONS.SPARE_PART_ISSUE] as const;

/**
 * @openapi
 * /spare-parts:
 *   get:
 *     tags: [Spare Parts]
 *     summary: รายการอะไหล่ในคลัง (filter คำค้น/เฉพาะที่ต่ำกว่าจุดสั่งซื้อ)
 *     security: [{ bearerAuth: [] }]
 */
router.get('/', requirePermission(...VIEW_PERMS), validateRequest({ query: listSparePartsQuerySchema }), sparePartController.listSpareParts);

/**
 * @openapi
 * /spare-parts/transactions:
 *   get:
 *     tags: [Spare Parts]
 *     summary: ประวัติธุรกรรมอะไหล่ทั้งหมด (filter ตาม ticketId ได้ — ใช้แสดงในหน้ารายละเอียดใบแจ้งซ่อม)
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  '/transactions',
  requirePermission(...VIEW_PERMS),
  validateRequest({ query: listTransactionsQuerySchema }),
  sparePartController.listTransactions,
);

/**
 * @openapi
 * /spare-parts/export:
 *   get:
 *     tags: [Spare Parts]
 *     summary: Export คลังอะไหล่เป็น Excel/CSV (ใช้ filter เดียวกับรายการ)
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  '/export',
  requirePermission(...VIEW_PERMS),
  validateRequest({ query: exportSparePartsQuerySchema }),
  sparePartController.exportSpareParts,
);

/**
 * @openapi
 * /spare-parts:
 *   post:
 *     tags: [Spare Parts]
 *     summary: เพิ่มอะไหล่ใหม่เข้าคลัง (master data)
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/',
  requirePermission(PERMISSIONS.SPARE_PART_MANAGE),
  validateRequest({ body: createSparePartSchema }),
  sparePartController.createSparePart,
);

/**
 * @openapi
 * /spare-parts/{id}:
 *   get:
 *     tags: [Spare Parts]
 *     summary: รายละเอียดอะไหล่
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  '/:id',
  requirePermission(...VIEW_PERMS),
  validateRequest({ params: sparePartIdParamSchema }),
  sparePartController.getSparePart,
);

/**
 * @openapi
 * /spare-parts/{id}:
 *   patch:
 *     tags: [Spare Parts]
 *     summary: แก้ไขข้อมูลอะไหล่ (ชื่อ/หน่วย/จุดสั่งซื้อ/ราคา — ไม่ใช่การปรับสต็อก)
 *     security: [{ bearerAuth: [] }]
 */
router.patch(
  '/:id',
  requirePermission(PERMISSIONS.SPARE_PART_MANAGE),
  validateRequest({ params: sparePartIdParamSchema, body: updateSparePartSchema }),
  sparePartController.updateSparePart,
);

/**
 * @openapi
 * /spare-parts/{id}/transactions:
 *   get:
 *     tags: [Spare Parts]
 *     summary: ประวัติธุรกรรมของอะไหล่ชิ้นนี้
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  '/:id/transactions',
  requirePermission(...VIEW_PERMS),
  validateRequest({ params: sparePartIdParamSchema, query: listTransactionsQuerySchema }),
  sparePartController.listSparePartTransactions,
);

/**
 * @openapi
 * /spare-parts/{id}/transactions:
 *   post:
 *     tags: [Spare Parts]
 *     summary: บันทึกธุรกรรมอะไหล่ (RESERVE/ISSUE/RETURN/ADJUST/PURCHASE/RECEIVE) — ปรับ quantityOnHand แบบ atomic
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/:id/transactions',
  requirePermission(PERMISSIONS.SPARE_PART_ISSUE, PERMISSIONS.SPARE_PART_MANAGE),
  validateRequest({ params: sparePartIdParamSchema, body: recordTransactionSchema }),
  sparePartController.recordTransaction,
);

export default router;
