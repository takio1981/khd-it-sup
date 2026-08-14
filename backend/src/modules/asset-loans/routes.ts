import { Router } from 'express';
import * as assetLoanController from '@modules/asset-loans/controllers/assetLoan.controller';
import {
  assetLoanIdParamSchema,
  createAssetLoanSchema,
  exportAssetLoansQuerySchema,
  listAssetLoansQuerySchema,
  returnAssetLoanSchema,
  updateAssetLoanSchema,
} from '@modules/asset-loans/dto/assetLoan.dto';
import { authenticate, requirePermission, validateRequest } from '@common/middleware';
import { PERMISSIONS } from '@common/constants/permissions.const';

const router = Router();
router.use(authenticate);

/** เห็น/แก้ไข/ลบรายการยืม-คืนของทุกคนได้ (IT/Admin) — asset:loan_self ไม่ได้เข้าถึงเส้นทางเหล่านี้ */
const FULL_PERM = PERMISSIONS.ASSET_LOAN;
/** สร้าง/คืนรายการยืมได้ — ทั้งสิทธิ์เต็ม (asset:loan) และสิทธิ์ self-service (asset:loan_self, ยืม-คืนได้เฉพาะของตัวเอง บังคับที่ service layer) */
const CREATE_RETURN_PERMS = [PERMISSIONS.ASSET_LOAN, PERMISSIONS.ASSET_LOAN_SELF] as const;

/**
 * @openapi
 * /asset-loans:
 *   get:
 *     tags: [AssetLoans]
 *     summary: รายการยืม-คืนอุปกรณ์
 *     security: [{ bearerAuth: [] }]
 */
router.get('/', requirePermission(FULL_PERM), validateRequest({ query: listAssetLoansQuerySchema }), assetLoanController.listAssetLoans);

/**
 * @openapi
 * /asset-loans/stats:
 *   get:
 *     tags: [AssetLoans]
 *     summary: สรุปจำนวนยืม-คืน (ทั้งหมด/กำลังยืม/เกินกำหนด/คืนแล้ว)
 *     security: [{ bearerAuth: [] }]
 */
router.get('/stats', requirePermission(FULL_PERM), assetLoanController.getAssetLoanStats);

/**
 * @openapi
 * /asset-loans/chart:
 *   get:
 *     tags: [AssetLoans]
 *     summary: ข้อมูลกราฟ (ครุภัณฑ์/ผู้ยืมที่ถูกยืมบ่อยที่สุด)
 *     security: [{ bearerAuth: [] }]
 */
router.get('/chart', requirePermission(FULL_PERM), assetLoanController.getAssetLoanChartData);

/**
 * @openapi
 * /asset-loans/export:
 *   get:
 *     tags: [AssetLoans]
 *     summary: Export รายการยืม-คืนเป็น Excel/CSV (ใช้ filter เดียวกับรายการ)
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  '/export',
  requirePermission(FULL_PERM),
  validateRequest({ query: exportAssetLoansQuerySchema }),
  assetLoanController.exportAssetLoans,
);

/**
 * @openapi
 * /asset-loans/{id}:
 *   get:
 *     tags: [AssetLoans]
 *     summary: ดูรายละเอียดรายการยืม-คืน
 *     security: [{ bearerAuth: [] }]
 */
router.get('/:id', requirePermission(FULL_PERM), validateRequest({ params: assetLoanIdParamSchema }), assetLoanController.getAssetLoan);

/**
 * @openapi
 * /asset-loans:
 *   post:
 *     tags: [AssetLoans]
 *     summary: บันทึกยืมครุภัณฑ์ (IT/Admin ยืมแทนใครก็ได้ — ผู้ใช้สิทธิ์ self-service ยืมได้เฉพาะ borrowerId ของตัวเองเท่านั้น)
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/',
  requirePermission(...CREATE_RETURN_PERMS),
  validateRequest({ body: createAssetLoanSchema }),
  assetLoanController.createAssetLoan,
);

/**
 * @openapi
 * /asset-loans/{id}:
 *   patch:
 *     tags: [AssetLoans]
 *     summary: แก้ไขรายการยืม-คืน
 *     security: [{ bearerAuth: [] }]
 */
router.patch(
  '/:id',
  requirePermission(FULL_PERM),
  validateRequest({ params: assetLoanIdParamSchema, body: updateAssetLoanSchema }),
  assetLoanController.updateAssetLoan,
);

/**
 * @openapi
 * /asset-loans/{id}:
 *   delete:
 *     tags: [AssetLoans]
 *     summary: ลบรายการยืม-คืน
 *     security: [{ bearerAuth: [] }]
 */
router.delete('/:id', requirePermission(FULL_PERM), validateRequest({ params: assetLoanIdParamSchema }), assetLoanController.deleteAssetLoan);

/**
 * @openapi
 * /asset-loans/{id}/return:
 *   post:
 *     tags: [AssetLoans]
 *     summary: บันทึกคืนครุภัณฑ์ (IT/Admin คืนแทนใครก็ได้ — ผู้ใช้สิทธิ์ self-service คืนได้เฉพาะรายการยืมของตัวเองเท่านั้น)
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/:id/return',
  requirePermission(...CREATE_RETURN_PERMS),
  validateRequest({ params: assetLoanIdParamSchema, body: returnAssetLoanSchema }),
  assetLoanController.returnAssetLoan,
);

export default router;
