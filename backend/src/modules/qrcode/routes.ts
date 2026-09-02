import { Router } from 'express';
import * as qrcodeController from '@modules/qrcode/controllers/qrcode.controller';
import { assetIdParamSchema, bulkPrintSchema, qrTokenParamSchema, shortCodeParamSchema } from '@modules/qrcode/dto/qrcode.dto';
import { authenticate, optionalAuthenticate, requirePermission, validateRequest } from '@common/middleware';
import { PERMISSIONS } from '@common/constants/permissions.const';

const router = Router();

/**
 * @openapi
 * /qrcodes/assets/{assetId}/generate:
 *   post:
 *     tags: [QR Code]
 *     summary: สร้าง/สร้างใหม่ QR Code สำหรับครุภัณฑ์ (regenerate จะทำให้สติกเกอร์เดิมใช้ไม่ได้)
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/assets/:assetId/generate',
  authenticate,
  requirePermission(PERMISSIONS.QRCODE_GENERATE),
  validateRequest({ params: assetIdParamSchema }),
  qrcodeController.generateQrCode,
);

/**
 * @openapi
 * /qrcodes/assets/{assetId}/print:
 *   get:
 *     tags: [QR Code]
 *     summary: ดาวน์โหลด/พิมพ์ QR Code เป็นรูปภาพ PNG ความละเอียดสูงสำหรับติดสติกเกอร์
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  '/assets/:assetId/print',
  authenticate,
  requirePermission(PERMISSIONS.QRCODE_PRINT),
  validateRequest({ params: assetIdParamSchema }),
  qrcodeController.printQrCode,
);

/**
 * @openapi
 * /qrcodes/bulk-print:
 *   post:
 *     tags: [QR Code]
 *     summary: สร้าง QR Code หลายรายการพร้อมกัน (คืนเป็น data URL ให้ frontend จัดหน้าพิมพ์)
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/bulk-print',
  authenticate,
  requirePermission(PERMISSIONS.QRCODE_PRINT),
  validateRequest({ body: bulkPrintSchema }),
  qrcodeController.bulkPrintQrCode,
);

/**
 * @openapi
 * /qrcodes/resolve/{token}:
 *   get:
 *     tags: [QR Code]
 *     summary: ถอดรหัส QR token เป็นข้อมูลครุภัณฑ์ (Public endpoint — ไม่ต้อง login เพื่อรองรับการสแกนจากมือถือทั่วไป)
 */
router.get('/resolve/:token', optionalAuthenticate, validateRequest({ params: qrTokenParamSchema }), qrcodeController.resolveQrCode);

export default router;

/**
 * Router แยกต่างหาก mount ที่ /s (ไม่ใช่ /qrcodes) เพื่อให้ URL สั้นที่สุดตอนเอนโค้ดลง QR — /s/:shortCode
 * (Public endpoint — ไม่ต้อง login, redirect ต่อไปหน้าสแกนเต็มที่ /qrcodes/resolve/:token ยืนยันจริงอีกครั้ง)
 */
const shortUrlRouter = Router();

/**
 * @openapi
 * /s/{shortCode}:
 *   get:
 *     tags: [QR Code]
 *     summary: URL สั้นที่เอนโค้ดลง QR จริง — redirect ไปหน้าสแกนเต็ม (Public endpoint)
 */
shortUrlRouter.get('/:shortCode', validateRequest({ params: shortCodeParamSchema }), qrcodeController.redirectShortUrl);

export { shortUrlRouter as shortUrlRoutes };
