import { Router } from 'express';
import * as dashboardController from '@modules/dashboard/controllers/dashboard.controller';
import { dashboardExportQuerySchema, monthlyChartQuerySchema, rankingQuerySchema } from '@modules/dashboard/dto/dashboard.dto';
import { authenticate, requirePermission, validateRequest } from '@common/middleware';
import { PERMISSIONS } from '@common/constants/permissions.const';

const router = Router();
router.use(authenticate, requirePermission(PERMISSIONS.DASHBOARD_VIEW));

/**
 * @openapi
 * /dashboard/summary:
 *   get:
 *     tags: [Dashboard]
 *     summary: การ์ดสรุป (pending, completed, waiting parts, cancelled) + สถานะครุภัณฑ์
 *     security: [{ bearerAuth: [] }]
 */
router.get('/summary', dashboardController.getSummary);

/**
 * @openapi
 * /dashboard/charts/monthly:
 *   get:
 *     tags: [Dashboard]
 *     summary: จำนวนใบแจ้งซ่อมรายเดือนของปีที่ระบุ (default = ปีปัจจุบัน)
 *     security: [{ bearerAuth: [] }]
 */
router.get('/charts/monthly', validateRequest({ query: monthlyChartQuerySchema }), dashboardController.getMonthlyChart);

/**
 * @openapi
 * /dashboard/charts/yearly:
 *   get:
 *     tags: [Dashboard]
 *     summary: จำนวนใบแจ้งซ่อมรายปีทั้งหมด
 *     security: [{ bearerAuth: [] }]
 */
router.get('/charts/yearly', dashboardController.getYearlyChart);

/**
 * @openapi
 * /dashboard/charts/department-ranking:
 *   get:
 *     tags: [Dashboard]
 *     summary: อันดับหน่วยงานที่แจ้งซ่อมมากที่สุด
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  '/charts/department-ranking',
  validateRequest({ query: rankingQuerySchema }),
  dashboardController.getDepartmentRanking,
);

/**
 * @openapi
 * /dashboard/charts/technician-workload:
 *   get:
 *     tags: [Dashboard]
 *     summary: ภาระงานซ่อมที่ยังไม่ปิดของช่างแต่ละคน
 *     security: [{ bearerAuth: [] }]
 */
router.get('/charts/technician-workload', dashboardController.getTechnicianWorkload);

/**
 * @openapi
 * /dashboard/analytics:
 *   get:
 *     tags: [Dashboard]
 *     summary: เวลาซ่อมเฉลี่ย และ Top ครุภัณฑ์ที่ถูกแจ้งซ่อมบ่อยที่สุด
 *     security: [{ bearerAuth: [] }]
 */
router.get('/analytics', dashboardController.getAnalytics);

/**
 * @openapi
 * /dashboard/export:
 *   get:
 *     tags: [Dashboard]
 *     summary: Export รายงานสรุป (สรุป/รายเดือน/อันดับหน่วยงาน) เป็นไฟล์ Excel หลายชีต
 *     security: [{ bearerAuth: [] }]
 */
router.get('/export', validateRequest({ query: dashboardExportQuerySchema }), dashboardController.exportDashboard);

export default router;
