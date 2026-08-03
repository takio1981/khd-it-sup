import { Router } from 'express';
import * as documentController from '@modules/documents/controllers/document.controller';
import { exportDocumentsQuerySchema, generateDocumentSchema, listDocumentsQuerySchema } from '@modules/documents/dto/document.dto';
import { authenticate, requirePermission, validateRequest } from '@common/middleware';
import { PERMISSIONS } from '@common/constants/permissions.const';
import { documentUploader } from '@infrastructure/storage/multer.config';

const router = Router();
router.use(authenticate);

/**
 * @openapi
 * /document-templates:
 *   get:
 *     tags: [Documents]
 *     summary: รายการแบบฟอร์มเอกสารราชการที่เปิดใช้งาน (registry เท่านั้น — เนื้อหาฟอร์มจริง render ฝั่ง frontend)
 *     security: [{ bearerAuth: [] }]
 */
router.get('/document-templates', requirePermission(PERMISSIONS.DOCUMENT_PRINT, PERMISSIONS.DOCUMENT_GENERATE), documentController.listTemplates);

/**
 * @openapi
 * /documents:
 *   get:
 *     tags: [Documents]
 *     summary: ประวัติเอกสารที่ออกเลขที่แล้วทั้งหมด (filter ticketId/templateCode)
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  '/documents',
  requirePermission(PERMISSIONS.DOCUMENT_PRINT, PERMISSIONS.DOCUMENT_GENERATE, PERMISSIONS.AUDIT_VIEW),
  validateRequest({ query: listDocumentsQuerySchema }),
  documentController.listDocuments,
);

/**
 * @openapi
 * /documents/export:
 *   get:
 *     tags: [Documents]
 *     summary: Export ประวัติเอกสารที่ออกเลขที่แล้วเป็น Excel/CSV (ใช้ filter เดียวกับรายการ)
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  '/documents/export',
  requirePermission(PERMISSIONS.DOCUMENT_PRINT, PERMISSIONS.DOCUMENT_GENERATE, PERMISSIONS.AUDIT_VIEW),
  validateRequest({ query: exportDocumentsQuerySchema }),
  documentController.exportDocuments,
);

/**
 * @openapi
 * /documents/generate:
 *   post:
 *     tags: [Documents]
 *     summary: ออกเลขที่เอกสารจริงจาก running_number_sequences แล้วบันทึกไฟล์ PDF ที่ frontend render มาแล้ว
 *       (multipart/form-data — field "file" คือไฟล์, "templateCode"/"ticketId" เป็น field ข้อความ)
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/documents/generate',
  requirePermission(PERMISSIONS.DOCUMENT_GENERATE),
  documentUploader.single('file'),
  validateRequest({ body: generateDocumentSchema }),
  documentController.generateDocument,
);

export default router;
