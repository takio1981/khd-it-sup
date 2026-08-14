import { Router } from 'express';
import * as ticketController from '@modules/repair-tickets/controllers/repairTicket.controller';
import {
  assignTicketSchema,
  cancelTicketSchema,
  commentTicketSchema,
  createTicketSchema,
  exportTicketsQuerySchema,
  inspectionSchema,
  listTicketsQuerySchema,
  repairSummarySchema,
  ticketIdParamSchema,
  transitionTicketSchema,
} from '@modules/repair-tickets/dto/repairTicket.dto';
import { authenticate, requirePermission, validateRequest } from '@common/middleware';
import { PERMISSIONS } from '@common/constants/permissions.const';
import { ticketAttachmentUploader } from '@infrastructure/storage/multer.config';

const router = Router();
router.use(authenticate);

const VIEW_PERMS = [PERMISSIONS.TICKET_READ, PERMISSIONS.TICKET_TRACK] as const;

/**
 * @openapi
 * /repair-tickets:
 *   get:
 *     tags: [Repair Tickets]
 *     summary: รายการใบแจ้งซ่อม (ผู้มีสิทธิ์ ticket:track เท่านั้นจะเห็นเฉพาะของตนเอง)
 *     security: [{ bearerAuth: [] }]
 */
router.get('/', requirePermission(...VIEW_PERMS), validateRequest({ query: listTicketsQuerySchema }), ticketController.listTickets);

/**
 * @openapi
 * /repair-tickets/export:
 *   get:
 *     tags: [Repair Tickets]
 *     summary: Export รายการใบแจ้งซ่อมเป็น Excel/CSV (ใช้ filter เดียวกับรายการ)
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  '/export',
  requirePermission(...VIEW_PERMS),
  validateRequest({ query: exportTicketsQuerySchema }),
  ticketController.exportTickets,
);

/**
 * @openapi
 * /repair-tickets/{id}:
 *   get:
 *     tags: [Repair Tickets]
 *     summary: รายละเอียดใบแจ้งซ่อม พร้อม progress ของ workflow ปัจจุบัน
 *     security: [{ bearerAuth: [] }]
 */
router.get('/:id', requirePermission(...VIEW_PERMS), validateRequest({ params: ticketIdParamSchema }), ticketController.getTicket);

/**
 * @openapi
 * /repair-tickets/{id}/timeline:
 *   get:
 *     tags: [Repair Tickets]
 *     summary: Timeline แบบ immutable ทั้งหมดของใบแจ้งซ่อม เรียงตามเวลา
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  '/:id/timeline',
  requirePermission(...VIEW_PERMS),
  validateRequest({ params: ticketIdParamSchema }),
  ticketController.getTicketTimeline,
);

/**
 * @openapi
 * /repair-tickets:
 *   post:
 *     tags: [Repair Tickets]
 *     summary: แจ้งซ่อมใหม่ (auto-generate เลขที่ ticket และเริ่ม workflow instance อัตโนมัติ)
 *       รองรับแนบรูปภาพเครื่อง/อาการเสียได้พร้อมกันสูงสุด 3 ภาพ (multipart/form-data, field "attachments" —
 *       ถ้าไม่แนบไฟล์ส่งเป็น application/json ตามปกติได้เหมือนเดิม)
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/',
  requirePermission(PERMISSIONS.TICKET_CREATE),
  ticketAttachmentUploader.array('attachments', 3),
  validateRequest({ body: createTicketSchema }),
  ticketController.createTicket,
);

/**
 * @openapi
 * /repair-tickets/{id}/receive:
 *   post:
 *     tags: [Repair Tickets]
 *     summary: IT Officer รับเรื่องแจ้งซ่อม (SUBMITTED -> RECEIVED)
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/:id/receive',
  requirePermission(PERMISSIONS.TICKET_RECEIVE),
  validateRequest({ params: ticketIdParamSchema }),
  ticketController.receiveTicket,
);

/**
 * @openapi
 * /repair-tickets/{id}/assign:
 *   post:
 *     tags: [Repair Tickets]
 *     summary: มอบหมายช่างผู้รับผิดชอบ (ไม่เปลี่ยนสถานะ workflow โดยตรง)
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/:id/assign',
  requirePermission(PERMISSIONS.TICKET_ASSIGN),
  validateRequest({ params: ticketIdParamSchema, body: assignTicketSchema }),
  ticketController.assignTicket,
);

/**
 * @openapi
 * /repair-tickets/{id}/transition:
 *   post:
 *     tags: [Repair Tickets]
 *     summary: เปลี่ยนสถานะงานซ่อมตาม workflow ที่ config ไว้ (ไม่รวม close/cancel ซึ่งมี endpoint เฉพาะ)
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/:id/transition',
  requirePermission(PERMISSIONS.TICKET_UPDATE_STATUS),
  validateRequest({ params: ticketIdParamSchema, body: transitionTicketSchema }),
  ticketController.transitionTicket,
);

/**
 * @openapi
 * /repair-tickets/{id}/summary:
 *   patch:
 *     tags: [Repair Tickets]
 *     summary: บันทึก/แก้ไขสรุปผลการซ่อม (สาเหตุ/วิธีแก้ไข/อะไหล่/ข้อเสนอแนะ) ไม่บังคับต้อง transition workflow
 *     security: [{ bearerAuth: [] }]
 */
router.patch(
  '/:id/summary',
  requirePermission(PERMISSIONS.TICKET_UPDATE_STATUS),
  validateRequest({ params: ticketIdParamSchema, body: repairSummarySchema }),
  ticketController.updateRepairSummary,
);

/**
 * @openapi
 * /repair-tickets/{id}/approve-unit-head:
 *   post:
 *     tags: [Repair Tickets]
 *     summary: หัวหน้างาน/กลุ่มงานของผู้แจ้งซ่อมลงนามรับทราบคำขอ (ส่วนที่ 1 ของแบบฟอร์ม, endorsement เท่านั้น)
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/:id/approve-unit-head',
  requirePermission(PERMISSIONS.TICKET_APPROVE),
  validateRequest({ params: ticketIdParamSchema }),
  ticketController.approveUnitHead,
);

/**
 * @openapi
 * /repair-tickets/{id}/inspection:
 *   post:
 *     tags: [Repair Tickets]
 *     summary: บันทึกผลตรวจสอบเบื้องต้นโดยเจ้าหน้าที่ไอที (ส่วนที่ 2 ของแบบฟอร์ม — ก่อนเริ่มซ่อมจริง)
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/:id/inspection',
  requirePermission(PERMISSIONS.TICKET_UPDATE_STATUS),
  validateRequest({ params: ticketIdParamSchema, body: inspectionSchema }),
  ticketController.recordInspection,
);

/**
 * @openapi
 * /repair-tickets/{id}/approve-digital-health-head:
 *   post:
 *     tags: [Repair Tickets]
 *     summary: หัวหน้ากลุ่มงานสุขภาพดิจิทัลลงนามรับรองผลตรวจสอบ (ส่วนที่ 2 ของแบบฟอร์ม, endorsement เท่านั้น)
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/:id/approve-digital-health-head',
  requirePermission(PERMISSIONS.TICKET_APPROVE),
  validateRequest({ params: ticketIdParamSchema }),
  ticketController.approveDigitalHealthHead,
);

/**
 * @openapi
 * /repair-tickets/{id}/cancel:
 *   post:
 *     tags: [Repair Tickets]
 *     summary: ยกเลิกใบแจ้งซ่อม (ต้องระบุเหตุผล)
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/:id/cancel',
  requirePermission(PERMISSIONS.TICKET_CANCEL),
  validateRequest({ params: ticketIdParamSchema, body: cancelTicketSchema }),
  ticketController.cancelTicket,
);

/**
 * @openapi
 * /repair-tickets/{id}/close:
 *   post:
 *     tags: [Repair Tickets]
 *     summary: ปิดงาน (อนุญาตเฉพาะจาก step USER_ACCEPTANCE ตาม workflow)
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/:id/close',
  requirePermission(PERMISSIONS.TICKET_CLOSE),
  validateRequest({ params: ticketIdParamSchema }),
  ticketController.closeTicket,
);

/**
 * @openapi
 * /repair-tickets/{id}/comment:
 *   post:
 *     tags: [Repair Tickets]
 *     summary: เพิ่มความคิดเห็นลง Timeline โดยไม่เปลี่ยนสถานะ
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/:id/comment',
  requirePermission(...VIEW_PERMS),
  validateRequest({ params: ticketIdParamSchema, body: commentTicketSchema }),
  ticketController.commentOnTicket,
);

/**
 * @openapi
 * /repair-tickets/{id}/attachments:
 *   post:
 *     tags: [Repair Tickets]
 *     summary: อัปโหลดรูป/ไฟล์แนบ (multipart/form-data, field name "attachments", สูงสุด 5 ไฟล์)
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/:id/attachments',
  requirePermission(PERMISSIONS.TICKET_UPLOAD_ATTACHMENT),
  validateRequest({ params: ticketIdParamSchema }),
  ticketAttachmentUploader.array('attachments', 5),
  ticketController.uploadTicketAttachments,
);

export default router;
