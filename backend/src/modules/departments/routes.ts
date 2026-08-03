import { Router } from 'express';
import * as departmentController from '@modules/departments/controllers/department.controller';
import {
  createDepartmentSchema,
  departmentIdParamSchema,
  exportDepartmentsQuerySchema,
  updateDepartmentSchema,
} from '@modules/departments/dto/department.dto';
import { authenticate, requirePermission, validateRequest } from '@common/middleware';
import { PERMISSIONS } from '@common/constants/permissions.const';

const router = Router();
router.use(authenticate);

/**
 * @openapi
 * /departments:
 *   get:
 *     tags: [Departments]
 *     summary: รายชื่อหน่วยงานทั้งหมด
 *     security: [{ bearerAuth: [] }]
 */
router.get('/', departmentController.listDepartments);

/**
 * @openapi
 * /departments/export:
 *   get:
 *     tags: [Departments]
 *     summary: Export รายชื่อหน่วยงานทั้งหมดเป็น Excel/CSV
 *     security: [{ bearerAuth: [] }]
 */
router.get('/export', validateRequest({ query: exportDepartmentsQuerySchema }), departmentController.exportDepartments);

/**
 * @openapi
 * /departments/{id}:
 *   get:
 *     tags: [Departments]
 *     summary: รายละเอียดหน่วยงาน
 *     security: [{ bearerAuth: [] }]
 */
router.get('/:id', validateRequest({ params: departmentIdParamSchema }), departmentController.getDepartment);

/**
 * @openapi
 * /departments:
 *   post:
 *     tags: [Departments]
 *     summary: สร้างหน่วยงาน
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/',
  requirePermission(PERMISSIONS.DEPARTMENT_MANAGE),
  validateRequest({ body: createDepartmentSchema }),
  departmentController.createDepartment,
);

/**
 * @openapi
 * /departments/{id}:
 *   patch:
 *     tags: [Departments]
 *     summary: แก้ไขหน่วยงาน
 *     security: [{ bearerAuth: [] }]
 */
router.patch(
  '/:id',
  requirePermission(PERMISSIONS.DEPARTMENT_MANAGE),
  validateRequest({ params: departmentIdParamSchema, body: updateDepartmentSchema }),
  departmentController.updateDepartment,
);

/**
 * @openapi
 * /departments/{id}:
 *   delete:
 *     tags: [Departments]
 *     summary: ปิดใช้งานหน่วยงาน
 *     security: [{ bearerAuth: [] }]
 */
router.delete(
  '/:id',
  requirePermission(PERMISSIONS.DEPARTMENT_MANAGE),
  validateRequest({ params: departmentIdParamSchema }),
  departmentController.deleteDepartment,
);

export default router;
