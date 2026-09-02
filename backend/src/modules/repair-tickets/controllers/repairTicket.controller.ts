import fs from 'node:fs';
import type { Request, Response } from 'express';
import { repairTicketService } from '@modules/repair-tickets/services/repairTicket.service';
import type {
  AssignTicketDto,
  CancelTicketDto,
  CloseTicketDto,
  CommentTicketDto,
  CreateTicketDto,
  ExportTicketsQueryDto,
  InspectionDto,
  ListTicketsQueryDto,
  RepairSummaryDto,
  TransitionTicketDto,
} from '@modules/repair-tickets/dto/repairTicket.dto';
import { asyncHandler } from '@common/utils/asyncHandler';
import { sendCreated, sendSuccess } from '@common/utils/apiResponse';
import { BadRequestError } from '@common/errors';
import type { IRequestContext } from '@common/interfaces';
import { buildCsv, buildExcelBuffer, type IExportColumn } from '@common/utils/export.util';

function contextOf(req: Request): IRequestContext {
  return { user: req.user!, ipAddress: req.ip ?? 'unknown', userAgent: req.headers['user-agent'] ?? 'unknown' };
}

const CREATE_MAX_PHOTOS = 3;
const CREATE_MAX_TOTAL_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/** ตรวจซ้ำฝั่ง server ตามกติกาไฟล์แนบตอนแจ้งซ่อม (client บังคับไว้แล้ว แต่ห้าม trust ฝั่ง client อย่างเดียว) —
 * จำกัดรูปภาพไม่เกิน CREATE_MAX_PHOTOS ภาพ และขนาดไฟล์แนบทั้งหมด (รูป+วิดีโอ) รวมกันไม่เกิน CREATE_MAX_TOTAL_ATTACHMENT_BYTES
 * ไม่ตรวจความยาววิดีโอฝั่ง server (ต้องใช้ไลบรารีถอดรหัสวิดีโอเพิ่ม เกินความจำเป็นสำหรับ soft-limit นี้)
 * multer เขียนไฟล์ลงดิสก์ไปแล้วก่อนถึง handler นี้เสมอ — ถ้า reject ต้องลบไฟล์ที่เขียนไปแล้วทิ้งเอง ไม่งั้นค้างเป็นขยะ */
function validateCreateAttachments(files: Express.Multer.File[]): void {
  const photoCount = files.filter((f) => f.mimetype.startsWith('image/')).length;
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);

  if (photoCount > CREATE_MAX_PHOTOS) {
    files.forEach((f) => fs.unlink(f.path, () => undefined));
    throw new BadRequestError(`แนบรูปได้สูงสุด ${CREATE_MAX_PHOTOS} ภาพ`);
  }

  if (totalBytes > CREATE_MAX_TOTAL_ATTACHMENT_BYTES) {
    files.forEach((f) => fs.unlink(f.path, () => undefined));
    throw new BadRequestError('ขนาดไฟล์แนบทั้งหมด (รูป+วิดีโอ) ต้องไม่เกิน 10 MB');
  }
}

const URGENCY_LABEL_TH: Record<string, string> = { LOW: 'ต่ำ', MEDIUM: 'ปานกลาง', HIGH: 'สูง', CRITICAL: 'วิกฤต' };

const EXPORT_COLUMNS: IExportColumn[] = [
  { header: 'เลขที่ใบแจ้งซ่อม', key: 'ticketNumber', width: 18 },
  { header: 'สถานะ', key: 'statusTh', width: 18 },
  { header: 'ความเร่งด่วน', key: 'urgencyTh', width: 14 },
  { header: 'รายละเอียด', key: 'description', width: 40 },
  { header: 'ผู้แจ้ง', key: 'reportedBy', width: 20 },
  { header: 'หน่วยงาน', key: 'department', width: 24 },
  { header: 'ช่างผู้รับผิดชอบ', key: 'technician', width: 20 },
  { header: 'ครุภัณฑ์', key: 'asset', width: 26 },
  { header: 'วันที่แจ้ง', key: 'createdAt', width: 18 },
  { header: 'วันที่ปิดงาน', key: 'closedAt', width: 18 },
];

function formatDateTh(date: Date | string | null): string {
  if (!date) return '';
  return new Date(date).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
}

export const listTickets = asyncHandler(async (req: Request, res: Response) => {
  const result = await repairTicketService.list(req.query as unknown as ListTicketsQueryDto, contextOf(req));
  sendSuccess(res, result.items, 200, result.meta);
});

export const exportTickets = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ExportTicketsQueryDto;
  const items = await repairTicketService.listForExport(query, contextOf(req));

  const rows = items.map((t) => ({
    ticketNumber: t.ticketNumber,
    statusTh: t.workflowInstance?.currentStep?.stepNameTh ?? t.status,
    urgencyTh: URGENCY_LABEL_TH[t.urgency] ?? t.urgency,
    description: t.description,
    reportedBy: t.reportedBy?.fullName ?? '',
    department: t.department?.nameTh ?? '',
    technician: t.assignedTechnician?.fullName ?? '',
    asset: t.asset ? `${t.asset.assetNumber}${t.asset.model ? ' - ' + t.asset.model : ''}` : '',
    createdAt: formatDateTh(t.createdAt),
    closedAt: formatDateTh(t.closedAt),
  }));

  const filenameBase = `repair-tickets-${Date.now()}`;
  if (query.format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.csv"`);
    res.send(buildCsv(EXPORT_COLUMNS, rows));
  } else {
    const buffer = await buildExcelBuffer('Repair Tickets', EXPORT_COLUMNS, rows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.xlsx"`);
    res.send(buffer);
  }
});

export const getUnviewedCount = asyncHandler(async (_req: Request, res: Response) => {
  const count = await repairTicketService.getUnviewedCount();
  sendSuccess(res, { count });
});

export const getTicket = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await repairTicketService.getById(req.params.id, contextOf(req));
  sendSuccess(res, ticket);
});

export const getTicketTimeline = asyncHandler(async (req: Request, res: Response) => {
  const timeline = await repairTicketService.getTimeline(req.params.id, contextOf(req));
  sendSuccess(res, timeline);
});

export const createTicket = asyncHandler(async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (files?.length) {
    validateCreateAttachments(files);
  }

  const ticket = await repairTicketService.create(req.body as CreateTicketDto, contextOf(req));

  if (files?.length) {
    await repairTicketService.addAttachments(ticket.id, files, contextOf(req));
  }

  sendCreated(res, ticket);
});

export const receiveTicket = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await repairTicketService.receive(req.params.id, contextOf(req));
  sendSuccess(res, ticket);
});

export const assignTicket = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await repairTicketService.assign(req.params.id, req.body as AssignTicketDto, contextOf(req));
  sendSuccess(res, ticket);
});

export const transitionTicket = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await repairTicketService.transition(req.params.id, req.body as TransitionTicketDto, contextOf(req));
  sendSuccess(res, ticket);
});

export const cancelTicket = asyncHandler(async (req: Request, res: Response) => {
  const { reason } = req.body as CancelTicketDto;
  const ticket = await repairTicketService.cancel(req.params.id, reason, contextOf(req));
  sendSuccess(res, ticket);
});

export const closeTicket = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await repairTicketService.close(req.params.id, req.body as CloseTicketDto, contextOf(req));
  sendSuccess(res, ticket);
});

export const commentOnTicket = asyncHandler(async (req: Request, res: Response) => {
  const event = await repairTicketService.addComment(req.params.id, req.body as CommentTicketDto, contextOf(req));
  sendCreated(res, event);
});

export const updateRepairSummary = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await repairTicketService.updateRepairSummary(req.params.id, req.body as RepairSummaryDto, contextOf(req));
  sendSuccess(res, ticket);
});

export const approveUnitHead = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await repairTicketService.approveUnitHead(req.params.id, contextOf(req));
  sendSuccess(res, ticket);
});

export const recordInspection = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await repairTicketService.recordInspection(req.params.id, req.body as InspectionDto, contextOf(req));
  sendSuccess(res, ticket);
});

export const approveDigitalHealthHead = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await repairTicketService.approveDigitalHealthHead(req.params.id, contextOf(req));
  sendSuccess(res, ticket);
});

export const uploadTicketAttachments = asyncHandler(async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files?.length) {
    throw new BadRequestError('กรุณาแนบไฟล์อย่างน้อย 1 ไฟล์');
  }
  const attachments = await repairTicketService.addAttachments(req.params.id, files, contextOf(req));
  sendCreated(res, attachments);
});
