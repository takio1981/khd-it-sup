import { randomUUID } from 'node:crypto';
import { RepairTicketRepository } from '@modules/repair-tickets/repositories/repairTicket.repository';
import { workflowService } from '@modules/workflow/services/workflow.service';
import { timelineService } from '@modules/timeline/services/timeline.service';
import { runningNumberService } from '@modules/settings/services/runningNumber.service';
import type {
  AssignTicketDto,
  CommentTicketDto,
  CreateTicketDto,
  InspectionDto,
  ListTicketsQueryDto,
  RepairSummaryDto,
  TransitionTicketDto,
} from '@modules/repair-tickets/dto/repairTicket.dto';
import { BadRequestError, ForbiddenError, NotFoundError } from '@common/errors';
import { normalizePagination, buildPaginatedResult } from '@common/utils/pagination';
import { auditLogService } from '@modules/audit-log/services/auditLog.service';
import { notificationService } from '@modules/notifications/services/notification.service';
import type { IRequestContext } from '@common/interfaces';
import { PERMISSIONS } from '@common/constants/permissions.const';
import { prisma } from '@infrastructure/database/prisma';
import { logger } from '@infrastructure/logger/logger';

const WORKFLOW_TEMPLATE_CODE = 'REPAIR_INTERNAL';
const PROTECTED_TERMINAL_STEPS = new Set(['CLOSED', 'CANCELLED']);

export class RepairTicketService {
  private readonly repo = new RepairTicketRepository();

  async list(query: ListTicketsQueryDto, ctx: IRequestContext) {
    const pagination = normalizePagination(query);
    const canReadAll = ctx.user.permissions.includes(PERMISSIONS.TICKET_READ);

    const { items, total } = await this.repo.findMany(
      {
        status: query.status,
        urgency: query.urgency,
        departmentId: query.departmentId,
        assignedTechnicianId: query.assignedTechnicianId,
        keyword: query.keyword,
        reportedByUserId: canReadAll ? undefined : ctx.user.id,
      },
      pagination,
    );
    return buildPaginatedResult(items, total, pagination);
  }

  async getById(id: string, ctx: IRequestContext) {
    const ticket = await this.repo.findById(id);
    if (!ticket) throw new NotFoundError('ไม่พบใบแจ้งซ่อม');
    this.assertViewable(ticket, ctx);
    return { ...ticket, progress: this.computeProgress(ticket) };
  }

  private assertViewable(ticket: { reportedByUserId: string }, ctx: IRequestContext): void {
    const canReadAll = ctx.user.permissions.includes(PERMISSIONS.TICKET_READ);
    if (!canReadAll && ticket.reportedByUserId !== ctx.user.id) {
      throw new ForbiddenError('คุณไม่มีสิทธิ์ดูใบแจ้งซ่อมนี้');
    }
  }

  private computeProgress(ticket: {
    workflowInstance: { currentStep: { stepOrder: number; stepCode: string; stepNameTh: string }; template: { steps: { stepOrder: number; isTerminal: boolean }[] } } | null;
  }): { currentStepCode: string | null; currentStepNameTh: string | null; progressPercent: number } {
    const wf = ticket.workflowInstance;
    if (!wf) return { currentStepCode: null, currentStepNameTh: null, progressPercent: 0 };

    const nonCancelSteps = wf.template.steps.filter((s) => s.stepOrder < 99).sort((a, b) => a.stepOrder - b.stepOrder);
    const totalSteps = nonCancelSteps.length || 1;
    const currentIndex = nonCancelSteps.findIndex((s) => s.stepOrder === wf.currentStep.stepOrder);
    const progressPercent = currentIndex >= 0 ? Math.round(((currentIndex + 1) / totalSteps) * 100) : 0;

    return { currentStepCode: wf.currentStep.stepCode, currentStepNameTh: wf.currentStep.stepNameTh, progressPercent };
  }

  async getTimeline(id: string, ctx: IRequestContext) {
    const ticket = await this.repo.findById(id);
    if (!ticket) throw new NotFoundError('ไม่พบใบแจ้งซ่อม');
    this.assertViewable(ticket, ctx);
    return timelineService.findByTicketId(id);
  }

  async create(dto: CreateTicketDto, ctx: IRequestContext) {
    const ticketNumber = await runningNumberService.getNextNumber('TICKET');
    const departmentId = dto.departmentId ?? ctx.user.departmentId ?? undefined;

    const ticket = await prisma.$transaction(async (tx) => {
      const created = await this.repo.create(
        {
          id: randomUUID(),
          ticketNumber,
          assetId: dto.assetId,
          reportedByUserId: ctx.user.id,
          departmentId,
          problemType: dto.problemType,
          description: dto.description,
          urgency: dto.urgency,
          locationNote: dto.locationNote,
          contactPhone: dto.contactPhone,
          status: 'DRAFT',
          equipmentType: dto.equipmentType,
          equipmentTypeOther: dto.equipmentTypeOther,
          deviceColor: dto.deviceColor,
          hasAdapterCable: dto.hasAdapterCable ?? false,
          hasVgaCable: dto.hasVgaCable ?? false,
          hasPowerCable: dto.hasPowerCable ?? false,
          hasOtherAccessory: dto.hasOtherAccessory ?? false,
          otherAccessoryNote: dto.otherAccessoryNote,
        },
        tx,
      );

      const { instance, step } = await workflowService.initWorkflow(WORKFLOW_TEMPLATE_CODE, created.id, tx);

      const updated = await this.repo.update(
        created.id,
        { workflowInstanceId: instance.id, status: step.stepCode },
        tx,
      );

      await timelineService.recordEvent(
        {
          ticketId: created.id,
          eventType: 'SUBMIT',
          previousStatus: null,
          currentStatus: step.stepCode,
          responsibleUserId: ctx.user.id,
          departmentId,
          comment: dto.description,
          ipAddress: ctx.ipAddress,
          slaHours: step.slaHours,
        },
        tx,
      );

      return updated;
    });

    await auditLogService.record(
      { action: 'CREATE', module: 'ticket', entityType: 'RepairTicket', entityId: ticket.id, description: `แจ้งซ่อมใหม่ ${ticket.ticketNumber}` },
      ctx,
    );

    await this.notifySafe('NEW_TICKET', ticket, ticket.workflowInstance?.currentStep.stepNameTh ?? ticket.status);

    return ticket;
  }

  /** ห่อการแจ้งเตือน (Email/Socket.IO) ไม่ให้ error จากช่องทางแจ้งเตือนไปกระทบ flow หลักของ ticket */
  private async notifySafe(
    event: Parameters<typeof notificationService.notifyTicketEvent>[0],
    ticket: Parameters<typeof notificationService.notifyTicketEvent>[1],
    statusNameTh: string,
  ): Promise<void> {
    try {
      await notificationService.notifyTicketEvent(event, ticket, statusNameTh);
    } catch (err) {
      logger.error(`[repair-ticket] แจ้งเตือน ${event} ล้มเหลว: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /** ขั้นตอนภายในร่วมกันของทุก action ที่ทำให้ workflow เปลี่ยน step (receive/assign-transition/transition/cancel/close) */
  private async applyTransition(
    ticketId: string,
    toStepCode: string,
    conditionKey: string | undefined,
    eventType: string,
    ctx: IRequestContext,
    extraTicketData: Record<string, unknown> = {},
    comment?: string,
  ) {
    const existing = await this.repo.findById(ticketId);
    if (!existing) throw new NotFoundError('ไม่พบใบแจ้งซ่อม');
    if (!existing.workflowInstance) throw new BadRequestError('ใบแจ้งซ่อมนี้ไม่ได้ผูกกับ workflow (ข้อมูลไม่สมบูรณ์)');

    const updated = await prisma.$transaction(async (tx) => {
      const { fromStep, toStep } = await workflowService.transition(existing.workflowInstance!.id, toStepCode, conditionKey, tx);

      const ticket = await this.repo.update(ticketId, { status: toStep.stepCode, ...extraTicketData }, tx);

      await timelineService.recordEvent(
        {
          ticketId,
          eventType,
          previousStatus: fromStep.stepCode,
          currentStatus: toStep.stepCode,
          responsibleUserId: ctx.user.id,
          departmentId: existing.departmentId,
          comment,
          ipAddress: ctx.ipAddress,
          slaHours: toStep.slaHours,
        },
        tx,
      );

      return ticket;
    });

    await auditLogService.record(
      {
        action: 'UPDATE',
        module: 'ticket',
        entityType: 'RepairTicket',
        entityId: ticketId,
        description: `เปลี่ยนสถานะใบแจ้งซ่อม ${existing.ticketNumber} เป็น ${toStepCode}`,
      },
      ctx,
    );

    const notifyEvent = updated.status === 'COMPLETED' ? 'COMPLETE' : updated.status === 'CANCELLED' ? 'CANCEL' : 'STATUS_CHANGE';
    await this.notifySafe(notifyEvent, updated, updated.workflowInstance?.currentStep.stepNameTh ?? updated.status);

    return updated;
  }

  async receive(id: string, ctx: IRequestContext) {
    return this.applyTransition(id, 'RECEIVED', undefined, 'RECEIVE', ctx);
  }

  async assign(id: string, dto: AssignTicketDto, ctx: IRequestContext) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError('ไม่พบใบแจ้งซ่อม');

    const technician = await prisma.user.findFirst({ where: { id: dto.technicianId, deletedAt: null, isActive: true } });
    if (!technician) throw new BadRequestError('ไม่พบผู้ใช้ที่ต้องการมอบหมาย หรือบัญชีถูกระงับ');

    const ticket = await this.repo.update(id, { assignedTechnicianId: dto.technicianId });

    await timelineService.recordEvent({
      ticketId: id,
      eventType: 'ASSIGN',
      previousStatus: existing.status,
      currentStatus: existing.status,
      responsibleUserId: ctx.user.id,
      departmentId: existing.departmentId,
      comment: `มอบหมายงานให้ ${technician.fullName}`,
      ipAddress: ctx.ipAddress,
    });

    await auditLogService.record(
      { action: 'UPDATE', module: 'ticket', entityType: 'RepairTicket', entityId: id, description: `มอบหมายช่าง ${technician.fullName} ให้ ${existing.ticketNumber}` },
      ctx,
    );

    await this.notifySafe('ASSIGN', ticket, ticket.workflowInstance?.currentStep.stepNameTh ?? ticket.status);

    return ticket;
  }

  async transition(id: string, dto: TransitionTicketDto, ctx: IRequestContext) {
    if (PROTECTED_TERMINAL_STEPS.has(dto.toStepCode)) {
      throw new BadRequestError('กรุณาใช้ endpoint /cancel หรือ /close สำหรับการยกเลิก/ปิดงาน แทนการ transition ทั่วไป');
    }

    const extraTicketData: Record<string, unknown> = {};
    if (dto.toStepCode === 'COMPLETED' && dto.repairSummary) {
      const { rootCause, repairAction, partsUsed, recommendation } = dto.repairSummary;
      Object.assign(extraTicketData, {
        rootCause,
        repairAction,
        partsUsed,
        recommendation,
        summaryByUserId: ctx.user.id,
        summaryAt: new Date(),
      });
    }

    return this.applyTransition(id, dto.toStepCode, dto.conditionKey, 'STATUS_CHANGE', ctx, extraTicketData, dto.comment);
  }

  async cancel(id: string, reason: string, ctx: IRequestContext) {
    return this.applyTransition(id, 'CANCELLED', undefined, 'CANCEL', ctx, { cancelledAt: new Date(), cancelReason: reason }, reason);
  }

  async close(id: string, ctx: IRequestContext) {
    return this.applyTransition(id, 'CLOSED', undefined, 'CLOSE', ctx, { closedAt: new Date() });
  }

  /** แก้ไข/บันทึกสรุปผลการซ่อมย้อนหลัง — ไม่บังคับต้อง transition workflow (ใช้แก้ไขข้อมูลหลังบันทึกครั้งแรกได้) */
  async updateRepairSummary(id: string, dto: RepairSummaryDto, ctx: IRequestContext) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError('ไม่พบใบแจ้งซ่อม');

    const ticket = await this.repo.update(id, {
      rootCause: dto.rootCause,
      repairAction: dto.repairAction,
      partsUsed: dto.partsUsed,
      recommendation: dto.recommendation,
      summaryByUserId: ctx.user.id,
      summaryAt: new Date(),
    });

    await auditLogService.record(
      { action: 'UPDATE', module: 'ticket', entityType: 'RepairTicket', entityId: id, description: `แก้ไขสรุปผลการซ่อม ${existing.ticketNumber}` },
      ctx,
    );

    return ticket;
  }

  /** ส่วนที่ 1 ของแบบฟอร์มกระดาษ — หัวหน้างาน/กลุ่มงานของผู้แจ้งซ่อมลงนามรับทราบ/อนุมัติคำขอ (endorsement เท่านั้น ไม่ block workflow) */
  async approveUnitHead(id: string, ctx: IRequestContext) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError('ไม่พบใบแจ้งซ่อม');

    const ticket = await this.repo.update(id, { unitHeadApprovedByUserId: ctx.user.id, unitHeadApprovedAt: new Date() });

    await auditLogService.record(
      { action: 'UPDATE', module: 'ticket', entityType: 'RepairTicket', entityId: id, description: `ลงนามอนุมัติ (หัวหน้างาน/กลุ่มงาน) ${existing.ticketNumber}` },
      ctx,
    );

    return ticket;
  }

  /** ส่วนที่ 2 ของแบบฟอร์มกระดาษ — ผลตรวจสอบเบื้องต้นโดยเจ้าหน้าที่ไอที ก่อนเริ่มซ่อมจริง (แยกจากสรุปผลการซ่อมตอนปิดงาน) */
  async recordInspection(id: string, dto: InspectionDto, ctx: IRequestContext) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError('ไม่พบใบแจ้งซ่อม');

    const isInHouse = dto.inspectionOutcome === 'IN_HOUSE';
    const isSendExternal = dto.inspectionOutcome === 'SEND_EXTERNAL';

    const ticket = await this.repo.update(id, {
      inspectedByUserId: ctx.user.id,
      inspectedAt: new Date(),
      inspectionOutcome: dto.inspectionOutcome,
      requestPartsNeeded: isInHouse ? (dto.requestPartsNeeded ?? false) : false,
      requestedPart1Name: isInHouse ? dto.requestedPart1Name : null,
      requestedPart1Qty: isInHouse ? dto.requestedPart1Qty : null,
      requestedPart2Name: isInHouse ? dto.requestedPart2Name : null,
      requestedPart2Qty: isInHouse ? dto.requestedPart2Qty : null,
      requestedPart3Name: isInHouse ? dto.requestedPart3Name : null,
      requestedPart3Qty: isInHouse ? dto.requestedPart3Qty : null,
      sendExternalReason: isSendExternal ? dto.sendExternalReason : null,
    });

    await auditLogService.record(
      { action: 'UPDATE', module: 'ticket', entityType: 'RepairTicket', entityId: id, description: `บันทึกผลตรวจสอบเบื้องต้น ${existing.ticketNumber}` },
      ctx,
    );

    return ticket;
  }

  /** ส่วนที่ 2 ของแบบฟอร์มกระดาษ — หัวหน้ากลุ่มงานสุขภาพดิจิทัลลงนามรับรองผลตรวจสอบ (endorsement เท่านั้น ไม่ block workflow) */
  async approveDigitalHealthHead(id: string, ctx: IRequestContext) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError('ไม่พบใบแจ้งซ่อม');

    const ticket = await this.repo.update(id, {
      digitalHealthHeadApprovedByUserId: ctx.user.id,
      digitalHealthHeadApprovedAt: new Date(),
    });

    await auditLogService.record(
      { action: 'UPDATE', module: 'ticket', entityType: 'RepairTicket', entityId: id, description: `ลงนามอนุมัติ (หัวหน้ากลุ่มงานสุขภาพดิจิทัล) ${existing.ticketNumber}` },
      ctx,
    );

    return ticket;
  }

  async addComment(id: string, dto: CommentTicketDto, ctx: IRequestContext) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError('ไม่พบใบแจ้งซ่อม');
    this.assertViewable(existing, ctx);

    return timelineService.recordEvent({
      ticketId: id,
      eventType: 'COMMENT',
      previousStatus: existing.status,
      currentStatus: existing.status,
      responsibleUserId: ctx.user.id,
      departmentId: existing.departmentId,
      comment: dto.comment,
      ipAddress: ctx.ipAddress,
    });
  }

  async addAttachments(id: string, files: Express.Multer.File[], ctx: IRequestContext) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError('ไม่พบใบแจ้งซ่อม');
    this.assertViewable(existing, ctx);

    const attachments = await Promise.all(
      files.map((file) =>
        this.repo.addAttachment({
          ticketId: id,
          fileUrl: `/api/v1/files/tickets/${file.filename}`,
          fileType: file.mimetype,
          uploadedBy: ctx.user.id,
        }),
      ),
    );

    await timelineService.recordEvent({
      ticketId: id,
      eventType: 'ATTACHMENT',
      previousStatus: existing.status,
      currentStatus: existing.status,
      responsibleUserId: ctx.user.id,
      departmentId: existing.departmentId,
      comment: `แนบไฟล์ ${attachments.length} รายการ`,
      attachmentUrl: attachments[0]?.fileUrl,
      ipAddress: ctx.ipAddress,
    });

    return attachments;
  }
}

export const repairTicketService = new RepairTicketService();
