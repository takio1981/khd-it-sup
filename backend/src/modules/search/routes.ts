import { Router } from 'express';
import * as searchController from '@modules/search/controllers/search.controller';
import { globalSearchQuerySchema } from '@modules/search/dto/search.dto';
import { authenticate, validateRequest } from '@common/middleware';

const router = Router();
router.use(authenticate);

/**
 * @openapi
 * /search:
 *   get:
 *     tags: [Search]
 *     summary: ค้นหาข้ามระบบ (ตั๋วซ่อม/ครุภัณฑ์/ผู้ใช้) — แต่ละประเภทแสดงเฉพาะเมื่อผู้ใช้มีสิทธิ์ดูข้อมูลประเภทนั้น
 *     security: [{ bearerAuth: [] }]
 */
router.get('/', validateRequest({ query: globalSearchQuerySchema }), searchController.globalSearch);

export default router;
