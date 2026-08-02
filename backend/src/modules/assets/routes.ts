import { Router } from 'express';
import * as assetController from '@modules/assets/controllers/asset.controller';
import {
  assetIdParamSchema,
  assetPhotoParamSchema,
  categoryIdParamSchema,
  createAssetSchema,
  createCategorySchema,
  exportAssetsQuerySchema,
  listAssetsQuerySchema,
  updateAssetSchema,
  updateCategorySchema,
} from '@modules/assets/dto/asset.dto';
import { authenticate, requirePermission, validateRequest } from '@common/middleware';
import { PERMISSIONS } from '@common/constants/permissions.const';
import { assetPhotoUploader } from '@infrastructure/storage/multer.config';

const router = Router();
router.use(authenticate);

/**
 * @openapi
 * /assets/categories:
 *   get:
 *     tags: [Assets]
 *     summary: รายการประเภทครุภัณฑ์ทั้งหมด (14 ประเภท)
 *     security: [{ bearerAuth: [] }]
 */
router.get('/categories', assetController.listCategories);

/**
 * @openapi
 * /assets/categories:
 *   post:
 *     tags: [Assets]
 *     summary: สร้างประเภทครุภัณฑ์ใหม่
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/categories',
  requirePermission(PERMISSIONS.ASSET_CREATE),
  validateRequest({ body: createCategorySchema }),
  assetController.createCategory,
);

/**
 * @openapi
 * /assets/categories/{id}:
 *   patch:
 *     tags: [Assets]
 *     summary: แก้ไขประเภทครุภัณฑ์
 *     security: [{ bearerAuth: [] }]
 */
router.patch(
  '/categories/:id',
  requirePermission(PERMISSIONS.ASSET_UPDATE),
  validateRequest({ params: categoryIdParamSchema, body: updateCategorySchema }),
  assetController.updateCategory,
);

/**
 * @openapi
 * /assets/categories/{id}:
 *   delete:
 *     tags: [Assets]
 *     summary: ปิดใช้งานประเภทครุภัณฑ์ (ต้องไม่มีครุภัณฑ์ผูกอยู่)
 *     security: [{ bearerAuth: [] }]
 */
router.delete(
  '/categories/:id',
  requirePermission(PERMISSIONS.ASSET_DELETE),
  validateRequest({ params: categoryIdParamSchema }),
  assetController.deleteCategory,
);

/**
 * @openapi
 * /assets:
 *   get:
 *     tags: [Assets]
 *     summary: รายการครุภัณฑ์ (แบ่งหน้า, ค้นหา, กรองตามประเภท/หน่วยงาน/สถานะ)
 *     security: [{ bearerAuth: [] }]
 */
router.get('/', requirePermission(PERMISSIONS.ASSET_READ), validateRequest({ query: listAssetsQuerySchema }), assetController.listAssets);

/**
 * @openapi
 * /assets/export:
 *   get:
 *     tags: [Assets]
 *     summary: Export รายการครุภัณฑ์เป็น Excel/CSV (ใช้ filter เดียวกับรายการ)
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  '/export',
  requirePermission(PERMISSIONS.ASSET_READ),
  validateRequest({ query: exportAssetsQuerySchema }),
  assetController.exportAssets,
);

/**
 * @openapi
 * /assets/{id}:
 *   get:
 *     tags: [Assets]
 *     summary: รายละเอียดครุภัณฑ์
 *     security: [{ bearerAuth: [] }]
 */
router.get('/:id', requirePermission(PERMISSIONS.ASSET_READ), validateRequest({ params: assetIdParamSchema }), assetController.getAsset);

/**
 * @openapi
 * /assets/{id}/history:
 *   get:
 *     tags: [Assets]
 *     summary: ประวัติการซ่อมของครุภัณฑ์นี้
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  '/:id/history',
  requirePermission(PERMISSIONS.ASSET_VIEW_HISTORY),
  validateRequest({ params: assetIdParamSchema }),
  assetController.getAssetHistory,
);

/**
 * @openapi
 * /assets:
 *   post:
 *     tags: [Assets]
 *     summary: สร้างครุภัณฑ์ใหม่ (auto-generate เลขครุภัณฑ์)
 *     security: [{ bearerAuth: [] }]
 */
router.post('/', requirePermission(PERMISSIONS.ASSET_CREATE), validateRequest({ body: createAssetSchema }), assetController.createAsset);

/**
 * @openapi
 * /assets/{id}:
 *   patch:
 *     tags: [Assets]
 *     summary: แก้ไขครุภัณฑ์
 *     security: [{ bearerAuth: [] }]
 */
router.patch(
  '/:id',
  requirePermission(PERMISSIONS.ASSET_UPDATE),
  validateRequest({ params: assetIdParamSchema, body: updateAssetSchema }),
  assetController.updateAsset,
);

/**
 * @openapi
 * /assets/{id}:
 *   delete:
 *     tags: [Assets]
 *     summary: ลบครุภัณฑ์ (soft delete)
 *     security: [{ bearerAuth: [] }]
 */
router.delete('/:id', requirePermission(PERMISSIONS.ASSET_DELETE), validateRequest({ params: assetIdParamSchema }), assetController.deleteAsset);

/**
 * @openapi
 * /assets/{id}/photos:
 *   post:
 *     tags: [Assets]
 *     summary: อัปโหลดรูปครุภัณฑ์ (multipart/form-data, field name "photos", สูงสุด 10 ไฟล์)
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/:id/photos',
  requirePermission(PERMISSIONS.ASSET_UPDATE),
  validateRequest({ params: assetIdParamSchema }),
  assetPhotoUploader.array('photos', 10),
  assetController.uploadAssetPhotos,
);

/**
 * @openapi
 * /assets/{id}/photos/{photoId}:
 *   delete:
 *     tags: [Assets]
 *     summary: ลบรูปครุภัณฑ์
 *     security: [{ bearerAuth: [] }]
 */
router.delete(
  '/:id/photos/:photoId',
  requirePermission(PERMISSIONS.ASSET_UPDATE),
  validateRequest({ params: assetPhotoParamSchema }),
  assetController.deleteAssetPhoto,
);

export default router;
