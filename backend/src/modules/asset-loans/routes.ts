import { Router } from 'express';
import * as assetLoanController from '@modules/asset-loans/controllers/assetLoan.controller';
import {
  assetLoanIdParamSchema,
  createAssetLoanSchema,
  listAssetLoansQuerySchema,
  returnAssetLoanSchema,
} from '@modules/asset-loans/dto/assetLoan.dto';
import { authenticate, requirePermission, validateRequest } from '@common/middleware';
import { PERMISSIONS } from '@common/constants/permissions.const';

const router = Router();
router.use(authenticate);
router.use(requirePermission(PERMISSIONS.ASSET_LOAN));

/**
 * @openapi
 * /asset-loans:
 *   get:
 *     tags: [AssetLoans]
 *     summary: รายการยืม-คืนอุปกรณ์
 *     security: [{ bearerAuth: [] }]
 */
router.get('/', validateRequest({ query: listAssetLoansQuerySchema }), assetLoanController.listAssetLoans);

/**
 * @openapi
 * /asset-loans/stats:
 *   get:
 *     tags: [AssetLoans]
 *     summary: สรุปจำนวนยืม-คืน (ทั้งหมด/กำลังยืม/เกินกำหนด/คืนแล้ว)
 *     security: [{ bearerAuth: [] }]
 */
router.get('/stats', assetLoanController.getAssetLoanStats);

/**
 * @openapi
 * /asset-loans/chart:
 *   get:
 *     tags: [AssetLoans]
 *     summary: ข้อมูลกราฟ (ครุภัณฑ์/ผู้ยืมที่ถูกยืมบ่อยที่สุด)
 *     security: [{ bearerAuth: [] }]
 */
router.get('/chart', assetLoanController.getAssetLoanChartData);

/**
 * @openapi
 * /asset-loans:
 *   post:
 *     tags: [AssetLoans]
 *     summary: บันทึกยืมครุภัณฑ์
 *     security: [{ bearerAuth: [] }]
 */
router.post('/', validateRequest({ body: createAssetLoanSchema }), assetLoanController.createAssetLoan);

/**
 * @openapi
 * /asset-loans/{id}/return:
 *   post:
 *     tags: [AssetLoans]
 *     summary: บันทึกคืนครุภัณฑ์
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/:id/return',
  validateRequest({ params: assetLoanIdParamSchema, body: returnAssetLoanSchema }),
  assetLoanController.returnAssetLoan,
);

export default router;
