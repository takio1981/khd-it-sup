import { Router } from 'express';
import * as vendorController from '@modules/vendors/controllers/vendor.controller';
import {
  createVendorSchema,
  exportVendorsQuerySchema,
  listVendorsQuerySchema,
  updateVendorSchema,
  vendorIdParamSchema,
} from '@modules/vendors/dto/vendor.dto';
import { authenticate, requirePermission, validateRequest } from '@common/middleware';
import { PERMISSIONS } from '@common/constants/permissions.const';

const router = Router();
router.use(authenticate);

const VIEW_PERMS = [PERMISSIONS.VENDOR_VIEW, PERMISSIONS.VENDOR_MANAGE] as const;

/**
 * @openapi
 * /vendors:
 *   get:
 *     tags: [Vendors]
 *     summary: รายชื่อผู้ขาย/ผู้รับซ่อมภายนอก (filter คำค้น/เฉพาะที่ใช้งานอยู่)
 *     security: [{ bearerAuth: [] }]
 */
router.get('/', requirePermission(...VIEW_PERMS), validateRequest({ query: listVendorsQuerySchema }), vendorController.listVendors);

/**
 * @openapi
 * /vendors/export:
 *   get:
 *     tags: [Vendors]
 *     summary: Export รายชื่อผู้ขาย/ผู้รับซ่อมภายนอกเป็น Excel/CSV (ใช้ filter เดียวกับรายการ)
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  '/export',
  requirePermission(...VIEW_PERMS),
  validateRequest({ query: exportVendorsQuerySchema }),
  vendorController.exportVendors,
);

/**
 * @openapi
 * /vendors:
 *   post:
 *     tags: [Vendors]
 *     summary: เพิ่มผู้ขาย/ผู้รับซ่อมภายนอกใหม่
 *     security: [{ bearerAuth: [] }]
 */
router.post('/', requirePermission(PERMISSIONS.VENDOR_MANAGE), validateRequest({ body: createVendorSchema }), vendorController.createVendor);

/**
 * @openapi
 * /vendors/{id}:
 *   get:
 *     tags: [Vendors]
 *     summary: รายละเอียดผู้ขาย/ผู้รับซ่อมภายนอก
 *     security: [{ bearerAuth: [] }]
 */
router.get('/:id', requirePermission(...VIEW_PERMS), validateRequest({ params: vendorIdParamSchema }), vendorController.getVendor);

/**
 * @openapi
 * /vendors/{id}:
 *   patch:
 *     tags: [Vendors]
 *     summary: แก้ไขข้อมูลผู้ขาย/ผู้รับซ่อมภายนอก
 *     security: [{ bearerAuth: [] }]
 */
router.patch(
  '/:id',
  requirePermission(PERMISSIONS.VENDOR_MANAGE),
  validateRequest({ params: vendorIdParamSchema, body: updateVendorSchema }),
  vendorController.updateVendor,
);

export default router;
