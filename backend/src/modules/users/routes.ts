import { Router } from 'express';
import * as userController from '@modules/users/controllers/user.controller';
import {
  createUserSchema,
  exportUsersQuerySchema,
  listUsersQuerySchema,
  updateUserSchema,
  userIdParamSchema,
} from '@modules/users/dto/user.dto';
import { authenticate, requirePermission, validateRequest } from '@common/middleware';
import { PERMISSIONS } from '@common/constants/permissions.const';
import { avatarUploader } from '@infrastructure/storage/multer.config';

const router = Router();
router.use(authenticate);

/**
 * @openapi
 * /users:
 *   get:
 *     tags: [Users]
 *     summary: รายชื่อผู้ใช้ (แบ่งหน้า, ค้นหา, กรองตาม role/department)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: สำเร็จ }
 */
router.get('/', requirePermission(PERMISSIONS.USER_READ), validateRequest({ query: listUsersQuerySchema }), userController.listUsers);

/**
 * @openapi
 * /users/roles:
 *   get:
 *     tags: [Users]
 *     summary: รายชื่อ role ทั้งหมด (ใช้เติม dropdown ตอนสร้าง/แก้ไขผู้ใช้)
 *     security: [{ bearerAuth: [] }]
 */
router.get('/roles', userController.listRoles);

/**
 * @openapi
 * /users/stats:
 *   get:
 *     tags: [Users]
 *     summary: สรุปสถิติผู้ใช้งาน (ทั้งหมด/ใช้งานอยู่/ปิดใช้งาน/ต้องเปลี่ยนรหัสผ่าน) + แจกแจงตาม role และหน่วยงาน
 *     security: [{ bearerAuth: [] }]
 */
router.get('/stats', requirePermission(PERMISSIONS.USER_READ), userController.getStats);

/**
 * @openapi
 * /users/export:
 *   get:
 *     tags: [Users]
 *     summary: Export รายชื่อผู้ใช้เป็น Excel/CSV (ใช้ filter เดียวกับรายการ)
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  '/export',
  requirePermission(PERMISSIONS.USER_READ),
  validateRequest({ query: exportUsersQuerySchema }),
  userController.exportUsers,
);

/**
 * @openapi
 * /users/technicians:
 *   get:
 *     tags: [Users]
 *     summary: รายชื่อช่างเทคนิค/เจ้าหน้าที่ไอทีที่ใช้งานอยู่ (ใช้ตอนมอบหมายงานซ่อม)
 *     security: [{ bearerAuth: [] }]
 */
router.get('/technicians', requirePermission(PERMISSIONS.TICKET_ASSIGN), userController.listTechnicians);

/**
 * @openapi
 * /users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: รายละเอียดผู้ใช้
 *     security: [{ bearerAuth: [] }]
 */
router.get('/:id', requirePermission(PERMISSIONS.USER_READ), validateRequest({ params: userIdParamSchema }), userController.getUser);

/**
 * @openapi
 * /users:
 *   post:
 *     tags: [Users]
 *     summary: สร้างผู้ใช้ใหม่
 *     security: [{ bearerAuth: [] }]
 */
router.post('/', requirePermission(PERMISSIONS.USER_CREATE), validateRequest({ body: createUserSchema }), userController.createUser);

/**
 * @openapi
 * /users/{id}:
 *   patch:
 *     tags: [Users]
 *     summary: แก้ไขผู้ใช้
 *     security: [{ bearerAuth: [] }]
 */
router.patch(
  '/:id',
  requirePermission(PERMISSIONS.USER_UPDATE),
  validateRequest({ params: userIdParamSchema, body: updateUserSchema }),
  userController.updateUser,
);

/**
 * @openapi
 * /users/{id}:
 *   delete:
 *     tags: [Users]
 *     summary: ลบผู้ใช้ (soft delete)
 *     security: [{ bearerAuth: [] }]
 */
router.delete('/:id', requirePermission(PERMISSIONS.USER_DELETE), validateRequest({ params: userIdParamSchema }), userController.deleteUser);

/**
 * @openapi
 * /users/{id}/reset-password:
 *   post:
 *     tags: [Users]
 *     summary: รีเซ็ตรหัสผ่านผู้ใช้ (สุ่มรหัสผ่านชั่วคราว บังคับเปลี่ยนเมื่อเข้าสู่ระบบครั้งถัดไป)
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/:id/reset-password',
  requirePermission(PERMISSIONS.USER_RESET_PASSWORD),
  validateRequest({ params: userIdParamSchema }),
  userController.resetPassword,
);

/**
 * @openapi
 * /users/{id}/avatar:
 *   post:
 *     tags: [Users]
 *     summary: อัปโหลดรูปโปรไฟล์ผู้ใช้ (multipart/form-data, field name "avatar")
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/:id/avatar',
  requirePermission(PERMISSIONS.USER_UPDATE),
  validateRequest({ params: userIdParamSchema }),
  avatarUploader.single('avatar'),
  userController.uploadAvatar,
);

/**
 * @openapi
 * /users/{id}/avatar:
 *   delete:
 *     tags: [Users]
 *     summary: ลบรูปโปรไฟล์ผู้ใช้ (กลับไปใช้ avatar เริ่มต้นตามเพศ)
 *     security: [{ bearerAuth: [] }]
 */
router.delete(
  '/:id/avatar',
  requirePermission(PERMISSIONS.USER_UPDATE),
  validateRequest({ params: userIdParamSchema }),
  userController.removeAvatar,
);

export default router;
