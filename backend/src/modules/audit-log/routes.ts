import { Router } from 'express';
import * as auditLogController from '@modules/audit-log/controllers/auditLog.controller';
import { listAuditLogsQuerySchema } from '@modules/audit-log/dto/auditLog.dto';
import { authenticate, requirePermission, validateRequest } from '@common/middleware';
import { PERMISSIONS } from '@common/constants/permissions.const';

const router = Router();
router.use(authenticate);

/**
 * @openapi
 * /audit-logs:
 *   get:
 *     tags: [AuditLog]
 *     summary: ประวัติการกระทำทุกโมดูล (insert-only ledger) — ใช้ตรวจสอบย้อนหลัง
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  '/',
  requirePermission(PERMISSIONS.AUDIT_VIEW),
  validateRequest({ query: listAuditLogsQuerySchema }),
  auditLogController.listAuditLogs,
);

export default router;
