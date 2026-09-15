import { Router } from 'express';
import * as backupController from '@modules/backup/controllers/backup.controller';
import {
  backupIdParamsSchema,
  listBackupLogsQuerySchema,
  restoreSchema,
  runBackupSchema,
  updateBackupSettingsSchema,
} from '@modules/backup/dto/backup.dto';
import { authenticate, backupRestoreRateLimiter, requirePermission, validateRequest } from '@common/middleware';
import { PERMISSIONS } from '@common/constants/permissions.const';

const router = Router();
router.use(authenticate);
// ทุก route ในโมดูลนี้ต้องมี backup:manage เท่านั้น — ไม่ยอม OR permission อื่นเหมือนบางโมดูล เพราะแม้แต่
// "ดูรายการ/ดาวน์โหลด" ก็เข้าถึงข้อมูลทั้งฐานข้อมูล (รวมถึงตารางที่มี password hash/token) ผ่านไฟล์ dump ได้
router.use(requirePermission(PERMISSIONS.BACKUP_MANAGE));

/**
 * @openapi
 * /backup/tables:
 *   get:
 *     tags: [Backup]
 *     summary: รายชื่อตารางทั้งหมดในระบบ จัดกลุ่มตามโมดูล — ใช้ render checkbox เลือกตารางสำหรับสำรองข้อมูลแบบเฉพาะบางตาราง
 *     security: [{ bearerAuth: [] }]
 */
router.get('/tables', backupController.getTables);

/**
 * @openapi
 * /backup/status:
 *   get:
 *     tags: [Backup]
 *     summary: สถานะการสำรอง/กู้คืนข้อมูลปัจจุบัน (กำลังทำงานอยู่หรือไม่ + ตรวจพบโปรแกรม mariadb-dump/mariadb หรือไม่)
 *     security: [{ bearerAuth: [] }]
 */
router.get('/status', backupController.getStatus);

/**
 * @openapi
 * /backup/settings:
 *   get:
 *     tags: [Backup]
 *     summary: อ่านค่าตั้งค่าสำรองข้อมูลอัตโนมัติ (เปิด/ปิด, ขอบเขต, retention)
 *     security: [{ bearerAuth: [] }]
 *   patch:
 *     tags: [Backup]
 *     summary: แก้ค่าตั้งค่าสำรองข้อมูลอัตโนมัติ
 *     security: [{ bearerAuth: [] }]
 */
router.get('/settings', backupController.getSettings);
router.patch('/settings', validateRequest({ body: updateBackupSettingsSchema }), backupController.updateSettings);

/**
 * @openapi
 * /backup:
 *   get:
 *     tags: [Backup]
 *     summary: ประวัติการสำรอง/กู้คืนข้อมูลทั้งหมด (แบ่งหน้า, filter ตาม action/type/status/ช่วงวันที่)
 *     security: [{ bearerAuth: [] }]
 */
router.get('/', validateRequest({ query: listBackupLogsQuerySchema }), backupController.listBackupLogs);

/**
 * @openapi
 * /backup/run:
 *   post:
 *     tags: [Backup]
 *     summary: สั่งสำรองข้อมูลทันที (ทำงานเบื้องหลัง, poll /backup/status เพื่อดูผล)
 *     security: [{ bearerAuth: [] }]
 */
router.post('/run', validateRequest({ body: runBackupSchema }), backupController.runBackup);

/**
 * @openapi
 * /backup/{id}/download:
 *   get:
 *     tags: [Backup]
 *     summary: ดาวน์โหลดไฟล์สำรองข้อมูล (stream ตรงจากดิสก์ ไม่ buffer ทั้งไฟล์เข้า memory)
 *     security: [{ bearerAuth: [] }]
 */
router.get('/:id/download', validateRequest({ params: backupIdParamsSchema }), backupController.downloadBackup);

/**
 * @openapi
 * /backup/{id}:
 *   delete:
 *     tags: [Backup]
 *     summary: ลบไฟล์สำรองข้อมูล (เฉพาะรายการที่เป็น backup เท่านั้น — ห้ามลบประวัติการกู้คืนซึ่งต้องเก็บไว้เป็นหลักฐาน)
 *     security: [{ bearerAuth: [] }]
 */
router.delete('/:id', validateRequest({ params: backupIdParamsSchema }), backupController.deleteBackup);

/**
 * @openapi
 * /backup/{id}/restore:
 *   post:
 *     tags: [Backup]
 *     summary: >
 *       กู้คืนข้อมูลจากไฟล์สำรองที่ระบุ — ปฏิบัติการทำลายข้อมูลปัจจุบันได้จริง ต้องยืนยันรหัสผ่านผู้ใช้ปัจจุบันซ้ำ +
 *       พิมพ์ชื่อไฟล์ยืนยันให้ตรงเป๊ะ ระบบจะสำรองข้อมูลนิรภัย (SAFETY) แบบเต็มให้ก่อนเสมอโดยอัตโนมัติ
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/:id/restore',
  backupRestoreRateLimiter,
  validateRequest({ params: backupIdParamsSchema, body: restoreSchema }),
  backupController.restoreBackup,
);

export default router;
