import { z } from 'zod';

const urgencyEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

export const createTicketSchema = z.object({
  assetId: z.string().uuid().optional(),
  problemType: z.string().max(100).optional(),
  description: z.string().min(1, 'กรุณากรอกรายละเอียดปัญหา'),
  urgency: urgencyEnum.default('MEDIUM'),
  locationNote: z.string().max(255).optional(),
  contactPhone: z.string().max(30).optional(),
  departmentId: z.string().uuid().optional(),
});
export type CreateTicketDto = z.infer<typeof createTicketSchema>;

export const assignTicketSchema = z.object({
  technicianId: z.string().uuid('technicianId ต้องเป็น UUID'),
});
export type AssignTicketDto = z.infer<typeof assignTicketSchema>;

export const repairSummarySchema = z.object({
  rootCause: z.string().max(2000).optional(),
  repairAction: z.string().max(2000).optional(),
  partsUsed: z.string().max(1000).optional(),
  recommendation: z.string().max(1000).optional(),
});
export type RepairSummaryDto = z.infer<typeof repairSummarySchema>;

export const transitionTicketSchema = z.object({
  toStepCode: z.string().min(1, 'กรุณาระบุ step ปลายทาง'),
  conditionKey: z.string().optional(),
  comment: z.string().max(1000).optional(),
  /** สรุปผลการซ่อมจากช่าง — ส่งมาพร้อม transition ตอนเปลี่ยนสถานะเป็น COMPLETED */
  repairSummary: repairSummarySchema.optional(),
});
export type TransitionTicketDto = z.infer<typeof transitionTicketSchema>;

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
});
export type ListTicketsQueryDto = z.infer<typeof listTicketsQuerySchema>;

export const ticketIdParamSchema = z.object({ id: z.string().uuid('id ต้องเป็น UUID') });
