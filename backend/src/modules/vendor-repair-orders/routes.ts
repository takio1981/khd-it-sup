import { Router } from 'express';
import * as vendorOrderController from '@modules/vendor-repair-orders/controllers/vendorRepairOrder.controller';
import {
  createVendorOrderSchema,
  listVendorOrdersQuerySchema,
  updateVendorOrderSchema,
  vendorOrderIdParamSchema,
} from '@modules/vendor-repair-orders/dto/vendorRepairOrder.dto';
import { authenticate, requirePermission, validateRequest } from '@common/middleware';
import { PERMISSIONS } from '@common/constants/permissions.const';
import { vendorDocUploader } from '@infrastructure/storage/multer.config';

const router = Router();
router.use(authenticate);

const VIEW_PERMS = [PERMISSIONS.VENDOR_VIEW, PERMISSIONS.VENDOR_MANAGE] as const;

/**
 * @openapi
 * /vendor-repair-orders:
 *   get:
 *     tags: [Vendor Repair Orders]
 *     summary: รายการใบส่งซ่อมภายนอก (filter ticketId/vendorId/status — ใช้แสดงในหน้ารายละเอียดใบแจ้งซ่อม)
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  '/',
  requirePermission(...VIEW_PERMS),
  validateRequest({ query: listVendorOrdersQuerySchema }),
  vendorOrderController.listVendorOrders,
);

/**
 * @openapi
 * /vendor-repair-orders:
 *   post:
 *     tags: [Vendor Repair Orders]
 *     summary: เปิดใบส่งซ่อมภายนอกใหม่ (เลือกผู้รับซ่อม) — ใช้เมื่อตั๋วอยู่ในสถานะ VENDOR_REPAIR แล้วเท่านั้น
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/',
  requirePermission(PERMISSIONS.VENDOR_MANAGE),
  validateRequest({ body: createVendorOrderSchema }),
  vendorOrderController.createVendorOrder,
);

/**
 * @openapi
 * /vendor-repair-orders/{id}:
 *   get:
 *     tags: [Vendor Repair Orders]
 *     summary: รายละเอียดใบส่งซ่อมภายนอก
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  '/:id',
  requirePermission(...VIEW_PERMS),
  validateRequest({ params: vendorOrderIdParamSchema }),
  vendorOrderController.getVendorOrder,
);

/**
 * @openapi
 * /vendor-repair-orders/{id}:
 *   patch:
 *     tags: [Vendor Repair Orders]
 *     summary: แก้ไขสถานะ/ข้อมูลใบส่งซ่อมภายนอก — สถานะ PO_GENERATED จะออกเลข PO อัตโนมัติถ้ายังไม่มี, สถานะ RETURNED
 *       จะย้าย workflow ของตั๋วกลับเข้า TESTING ให้อัตโนมัติ (ครั้งแรกเท่านั้น)
 *     security: [{ bearerAuth: [] }]
 */
router.patch(
  '/:id',
  requirePermission(PERMISSIONS.VENDOR_MANAGE),
  validateRequest({ params: vendorOrderIdParamSchema, body: updateVendorOrderSchema }),
  vendorOrderController.updateVendorOrder,
);

/**
 * @openapi
 * /vendor-repair-orders/{id}/quotation-file:
 *   post:
 *     tags: [Vendor Repair Orders]
 *     summary: อัปโหลดไฟล์ใบเสนอราคา (multipart/form-data, field "file")
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/:id/quotation-file',
  requirePermission(PERMISSIONS.VENDOR_MANAGE),
  validateRequest({ params: vendorOrderIdParamSchema }),
  vendorDocUploader.single('file'),
  vendorOrderController.uploadQuotationFile,
);

/**
 * @openapi
 * /vendor-repair-orders/{id}/invoice-file:
 *   post:
 *     tags: [Vendor Repair Orders]
 *     summary: อัปโหลดไฟล์ใบแจ้งหนี้/ใบเสร็จ (multipart/form-data, field "file")
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/:id/invoice-file',
  requirePermission(PERMISSIONS.VENDOR_MANAGE),
  validateRequest({ params: vendorOrderIdParamSchema }),
  vendorDocUploader.single('file'),
  vendorOrderController.uploadInvoiceFile,
);

export default router;
