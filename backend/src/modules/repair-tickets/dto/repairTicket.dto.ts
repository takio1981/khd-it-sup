import { z } from 'zod';

const urgencyEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const equipmentTypeEnum = z.enum(['COMPUTER_CASE', 'NOTEBOOK', 'PRINTER', 'SCANNER', 'MONITOR', 'OTHER']);
const inspectionOutcomeEnum = z.enum(['IN_HOUSE', 'SEND_EXTERNAL', 'REPLACE_NEW']);

export const createTicketSchema = z.object({
  assetId: z.string().uuid().optional(),
  problemType: z.string().max(100).optional(),
  description: z.string().min(1, 'กรุณากรอกรายละเอียดปัญหา'),
  urgency: urgencyEnum.default('MEDIUM'),
  locationNote: z.string().max(255).optional(),
  contactPhone: z.string().max(30).optional(),
  departmentId: z.string().uuid().optional(),
  // ส่วนที่ 1 ของแบบฟอร์มกระดาษ — ข้อมูลอุปกรณ์/อุปกรณ์เสริมที่ผู้แจ้งซ่อมกรอกตอนแจ้ง
  equipmentType: equipmentTypeEnum.optional(),
  equipmentTypeOther: z.string().max(150).optional(),
  deviceColor: z.string().max(50).optional(),
  hasAdapterCable: z.boolean().optional(),
  hasVgaCable: z.boolean().optional(),
  hasPowerCable: z.boolean().optional(),
  hasOtherAccessory: z.boolean().optional(),
  otherAccessoryNote: z.string().max(255).optional(),
});
export type CreateTicketDto = z.infer<typeof createTicketSchema>;

export const assignTicketSchema = z.object({
  technicianId: z.string().uuid('technicianId ต้องเป็น UUID'),
});
export type AssignTicketDto = z.infer<typeof assignTicketSchema>;

/** base64 PNG data URL จาก signature pad — จำกัดความยาวกันของขนาดใหญ่ผิดปกติหลุดเข้ามา (canvas เซ็นชื่อจริงไม่ควรเกินนี้) */
const signatureDataUrlSchema = z
  .string()
  .max(500_000)
  .regex(/^data:image\/png;base64,/, 'ลายเซ็นต้องเป็น PNG data URL')
  .optional();

export const repairSummarySchema = z.object({
  rootCause: z.string().max(2000).optional(),
  repairAction: z.string().max(2000).optional(),
  partsUsed: z.string().max(1000).optional(),
  recommendation: z.string().max(1000).optional(),
  summarySignature: signatureDataUrlSchema,
});
export type RepairSummaryDto = z.infer<typeof repairSummarySchema>;

export const closeTicketSchema = z.object({
  acceptorSignature: signatureDataUrlSchema,
});
export type CloseTicketDto = z.infer<typeof closeTicketSchema>;

export const transitionTicketSchema = z.object({
  toStepCode: z.string().min(1, 'กรุณาระบุ step ปลายทาง'),
  conditionKey: z.string().optional(),
  comment: z.string().max(1000).optional(),
  /** สรุปผลการซ่อมจากช่าง — ส่งมาพร้อม transition ตอนเปลี่ยนสถานะเป็น COMPLETED */
  repairSummary: repairSummarySchema.optional(),
});
export type TransitionTicketDto = z.infer<typeof transitionTicketSchema>;

/** ส่วนที่ 2 ของแบบฟอร์มกระดาษ — ผลตรวจสอบเบื้องต้นโดยเจ้าหน้าที่ไอที ก่อนเริ่มซ่อมจริง */
export const inspectionSchema = z
  .object({
    inspectionOutcome: inspectionOutcomeEnum,
    requestPartsNeeded: z.boolean().optional(),
    requestedPart1Name: z.string().max(200).optional(),
    requestedPart1Qty: z.coerce.number().int().positive().optional(),
    requestedPart2Name: z.string().max(200).optional(),
    requestedPart2Qty: z.coerce.number().int().positive().optional(),
    requestedPart3Name: z.string().max(200).optional(),
    requestedPart3Qty: z.coerce.number().int().positive().optional(),
    sendExternalReason: z.string().max(2000).optional(),
  })
  .refine((v) => v.inspectionOutcome !== 'SEND_EXTERNAL' || !!v.sendExternalReason, {
    message: 'กรุณาระบุเหตุผลที่ส่งซ่อมภายนอก',
    path: ['sendExternalReason'],
  });
export type InspectionDto = z.infer<typeof inspectionSchema>;

export const cancelTicketSchema = z.object({
  reason: z.string().min(1, 'กรุณาระบุเหตุผลการยกเลิก').max(500),
});
export type CancelTicketDto = z.infer<typeof cancelTicketSchema>;

export const commentTicketSchema = z.object({
  comment: z.string().min(1, 'กรุณากรอกข้อความ').max(1000),
});
export type CommentTicketDto = z.infer<typeof commentTicketSchema>;

export const listTicketsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  status: z.string().optional(),
  urgency: urgencyEnum.optional(),
  departmentId: z.string().uuid().optional(),
  assignedTechnicianId: z.string().uuid().optional(),
  keyword: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});
export type ListTicketsQueryDto = z.infer<typeof listTicketsQuerySchema>;

export const exportTicketsQuerySchema = z.object({
  status: z.string().optional(),
  urgency: urgencyEnum.optional(),
  departmentId: z.string().uuid().optional(),
  assignedTechnicianId: z.string().uuid().optional(),
  keyword: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  format: z.enum(['xlsx', 'csv']).default('xlsx'),
});
export type ExportTicketsQueryDto = z.infer<typeof exportTicketsQuerySchema>;

export const ticketIdParamSchema = z.object({ id: z.string().uuid('id ต้องเป็น UUID') });
