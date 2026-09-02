import { randomUUID } from 'node:crypto';
import { RepairTicketRepository } from '@modules/repair-tickets/repositories/repairTicket.repository';
import { workflowService } from '@modules/workflow/services/workflow.service';
import { timelineService } from '@modules/timeline/services/timeline.service';
import { runningNumberService } from '@modules/settings/services/runningNumber.service';
import type {
  AssignTicketDto,
  CloseTicketDto,
  CommentTicketDto,
  CreateTicketDto,
  ExportTicketsQueryDto,
  InspectionDto,
  ListTicketsQueryDto,
  RepairSummaryDto,
  TransitionTicketDto,
} from '@modules/repair-tickets/dto/repairTicket.dto';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '@common/errors';
import { normalizePagination, buildPaginatedResult } from '@common/utils/pagination';
import { auditLogService } from '@modules/audit-log/services/auditLog.service';
import { notificationService } from '@modules/notifications/services/notification.service';
import type { IRequestContext } from '@common/interfaces';
import { PERMISSIONS } from '@common/constants/permissions.const';
import { ROLES, STAFF_ROLES, type RoleCode } from '@common/constants/roles.const';
import { prisma } from '@infrastructure/database/prisma';
import { logger } from '@infrastructure/logger/logger';

const WORKFLOW_TEMPLATE_CODE = 'REPAIR_INTERNAL';
const PROTECTED_TERMINAL_STEPS = new Set(['CLOSED', 'CANCELLED']);
/** role ที่ยกเว้นข้อจำกัด "แก้ไขได้เฉพาะงานของตัวเอง/ที่ได้รับมอบหมาย" — Admin/Super Admin จัดการ/แก้ไขได้ทุกใบเหมือนเดิม
 * ส่วนช่าง (TECHNICIAN) และไอที (IT_OFFICER) แก้ไขได้เฉพาะใบที่ตัวเองแจ้งเอง หรือใบที่ตัวเองถูกมอบหมายเท่านั้น */
const TICKET_EDIT_OVERRIDE_ROLES: readonly RoleCode[] = [ROLES.SUPER_ADMIN, ROLES.ADMIN];
/** จำกัดจำนวนแถวสูงสุดต่อไฟล์ export กันรายงานโตเกินควบคุมไม่ได้ (ใบแจ้งซ่อมของหน่วยงานเดียวไม่ควรเกินนี้ในทางปฏิบัติ) */
const EXPORT_MAX_ROWS = 5000;

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
        assetId: query.assetId,
        keyword: query.keyword,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        reportedByUserId: canReadAll ? undefined : ctx.user.id,
      },
      pagination,
    );
    return buildPaginatedResult(items, total, pagination);
  }

  /** ใช้เฉพาะสำหรับ export Excel/CSV — ดึงแบบไม่แบ่งหน้า (จำกัดที่ EXPORT_MAX_ROWS) ใช้ filter เดียวกับ list() ทุกจุด */
  async listForExport(query: ExportTicketsQueryDto, ctx: IRequestContext) {
    const canReadAll = ctx.user.permissions.includes(PERMISSIONS.TICKET_READ);
    const { items } = await this.repo.findMany(
      {
        status: query.status,
        urgency: query.urgency,
        departmentId: query.departmentId,
        assignedTechnicianId: query.assignedTechnicianId,
        assetId: query.assetId,
        keyword: query.keyword,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        reportedByUserId: canReadAll ? undefined : ctx.user.id,
      },
      { page: 1, limit: EXPORT_MAX_ROWS, skip: 0, take: EXPORT_MAX_ROWS },
    );
    return items;
  }

  /** จำนวนใบแจ้งซ่อมที่ยังไม่มีแอดมิน/ช่างเข้าดู — ใช้แสดงตัวเลขที่เมนู sidebar */
  async getUnviewedCount(): Promise<number> {
    return this.repo.countUnviewed();
  }

  async getById(id: string, ctx: IRequestContext) {
    let ticket = await this.repo.findById(id);
    if (!ticket) throw new NotFoundError('ไม่พบใบแจ้งซ่อม');
    this.assertViewable(ticket, ctx);

    // บันทึกแอดมิน/ช่างคนแรกที่เข้ามาดูรายละเอียด — เช็คจาก role เจ้าหน้าที่ (ไม่ใช่ "ไม่ใช่ผู้แจ้ง") เพราะแอดมิน/ไอที
    // มักเป็นคนแจ้งซ่อมแทนผู้อื่นเอง ถ้าเช็คจาก reportedByUserId แล้วแอดมินเปิดดูใบที่ตัวเองแจ้ง สัญลักษณ์จะไม่หายไปเลย
    if (!ticket.firstViewedByUserId && STAFF_ROLES.includes(ctx.user.role)) {
      const didSet = await this.repo.markFirstViewed(id, ctx.user.id);
      if (didSet) {
        ticket = await this.repo.findById(id);
        if (!ticket) throw new NotFoundError('ไม่พบใบแจ้งซ่อม');
        await this.notifyTicketLiveListSafe('ticket:viewed', {
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          viewedByUserId: ctx.user.id,
          viewedByName: ctx.user.fullName,
        });
      }
    }

    return { ...ticket, progress: this.computeProgress(ticket) };
  }

  /** ห่อการดัน realtime ไปตารางรายการงานแจ้งซ่อม ไม่ให้ error จาก Socket.IO ไปกระทบ flow หลัก (คู่ขนานกับ notifySafe) */
  private async notifyTicketLiveListSafe(
    event: Parameters<typeof notificationService.notifyTicketLiveList>[0],
    payload: Parameters<typeof notificationService.notifyTicketLiveList>[1],
  ): Promise<void> {
    try {
      await notificationService.notifyTicketLiveList(event, payload);
    } catch (err) {
      logger.error(`[repair-ticket] live list push ${event} ล้มเหลว: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private assertViewable(ticket: { reportedByUserId: string }, ctx: IRequestContext): void {
    const canReadAll = ctx.user.permissions.includes(PERMISSIONS.TICKET_READ);
    if (!canReadAll && ticket.reportedByUserId !== ctx.user.id) {
      throw new ForbiddenError('คุณไม่มีสิทธิ์ดูใบแจ้งซ่อมนี้');
    }
  }

  /** ช่าง/ไอที (ไม่รวม Admin/Super Admin) แก้ไขได้เฉพาะใบแจ้งซ่อมที่ตัวเองแจ้งเอง หรือใบที่ตัวเองถูกมอบหมายเท่านั้น —
   * ใช้กับ transition/บันทึกผลตรวจสอบเบื้องต้น/สรุปผลการซ่อมเท่านั้น (ไม่รวม รับเรื่อง/มอบหมายช่าง/ยกเลิก/ปิดงาน/คอมเมนต์/แนบไฟล์
   * ซึ่งยังเปิดให้เจ้าหน้าที่ที่มีสิทธิ์ทำได้กับทุกใบเหมือนเดิม ตามที่ตกลงไว้) */
  private assertCanEditAsAssigneeOrReporter(
    ticket: { reportedByUserId: string; assignedTechnicianId: string | null },
    ctx: IRequestContext,
  ): void {
    if (TICKET_EDIT_OVERRIDE_ROLES.includes(ctx.user.role)) return;
    const isOwnTicket = ticket.reportedByUserId === ctx.user.id;
    const isAssignedTechnician = ticket.assignedTechnicianId === ctx.user.id;
    if (!isOwnTicket && !isAssignedTechnician) {
      throw new ForbiddenError('คุณไม่มีสิทธิ์แก้ไขใบแจ้งซ่อมนี้ — แก้ไขได้เฉพาะงานของตัวเองหรืองานที่ได้รับมอบหมายเท่านั้น');
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
    if (dto.assetId) {
      const activeTicket = await this.repo.findActiveByAssetId(dto.assetId);
      if (activeTicket) {
        const statusLabel = activeTicket.workflowInstance?.currentStep.stepNameTh ?? activeTicket.status;
        throw new ConflictError(
          `ครุภัณฑ์นี้มีใบแจ้งซ่อม ${activeTicket.ticketNumber} ที่ยังไม่ปิดงานอยู่แล้ว (สถานะปัจจุบัน: ${statusLabel}) ไม่สามารถแจ้งซ่อมซ้ำได้ กรุณารอให้งานเดิมเสร็จสิ้นก่อน หรือติดต่อเจ้าหน้าที่หากต้องการแจ้งปัญหาเพิ่มเติม`,
        );
      }
    }

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
    await this.notifyTicketLiveListSafe('ticket:created', { ticketId: ticket.id, ticketNumber: ticket.ticketNumber, urgency: ticket.urgency });

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

    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError('ไม่พบใบแจ้งซ่อม');
    this.assertCanEditAsAssigneeOrReporter(existing, ctx);

    const extraTicketData: Record<string, unknown> = {};
    if (dto.toStepCode === 'COMPLETED' && dto.repairSummary) {
      const { rootCause, repairAction, partsUsed, recommendation, summarySignature } = dto.repairSummary;
      Object.assign(extraTicketData, {
        rootCause,
        repairAction,
        partsUsed,
        recommendation,
        summarySignature,
        summaryByUserId: ctx.user.id,
        summaryAt: new Date(),
      });
    }

    return this.applyTransition(id, dto.toStepCode, dto.conditionKey, 'STATUS_CHANGE', ctx, extraTicketData, dto.comment);
  }

  async cancel(id: string, reason: string, ctx: IRequestContext) {
    return this.applyTransition(id, 'CANCELLED', undefined, 'CANCEL', ctx, { cancelledAt: new Date(), cancelReason: reason }, reason);
  }

  /** ปิดงาน — ผู้มีสิทธิ์ ticket:close (แอดมิน/ไอที) ปิดใบแจ้งซ่อมของใครก็ได้ (ไม่บังคับเซ็นชื่อ ใช้เป็นทางออกกรณีติดต่อ
   *  ผู้แจ้งไม่ได้) ส่วนผู้มีแค่ ticket:accept (ผู้แจ้งซ่อมทั่วไป) ปิดได้เฉพาะใบแจ้งซ่อมของตนเองเท่านั้น — เจตนาให้เป็นการ
   *  "เซ็นรับงานคืน" ของผู้แจ้งซ่อมเอง (ส่วน "ผู้ตรวจรับงาน" ในแบบฟอร์มกระดาษ) ไม่ใช่สิทธิ์ปิดงานแบบเต็มของแอดมิน */
  async close(id: string, dto: CloseTicketDto, ctx: IRequestContext) {
    const canCloseAny = ctx.user.permissions.includes(PERMISSIONS.TICKET_CLOSE);
    if (!canCloseAny) {
      const existing = await this.repo.findById(id);
      if (!existing) throw new NotFoundError('ไม่พบใบแจ้งซ่อม');
      if (existing.reportedByUserId !== ctx.user.id) {
        throw new ForbiddenError('คุณเซ็นรับงานได้เฉพาะใบแจ้งซ่อมของตนเองเท่านั้น');
      }
    }

    const extraTicketData: Record<string, unknown> = { closedAt: new Date() };
    if (dto.acceptorSignature) {
      Object.assign(extraTicketData, { acceptedByUserId: ctx.user.id, acceptorSignature: dto.acceptorSignature });
    }

    return this.applyTransition(id, 'CLOSED', undefined, 'CLOSE', ctx, extraTicketData);
  }

  /** แก้ไข/บันทึกสรุปผลการซ่อมย้อนหลัง — ไม่บังคับต้อง transition workflow (ใช้แก้ไขข้อมูลหลังบันทึกครั้งแรกได้) */
  async updateRepairSummary(id: string, dto: RepairSummaryDto, ctx: IRequestContext) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError('ไม่พบใบแจ้งซ่อม');
    this.assertCanEditAsAssigneeOrReporter(existing, ctx);

    const ticket = await this.repo.update(id, {
      rootCause: dto.rootCause,
      repairAction: dto.repairAction,
      partsUsed: dto.partsUsed,
      recommendation: dto.recommendation,
      summarySignature: dto.summarySignature,
      summaryByUserId: ctx.user.id,
      summaryAt: new Date(),
    });

    await auditLogService.record(
      { action: 'UPDATE', module: 'ticket', entityType: 'RepairTicket', entityId: id, description: `แก้ไขสรุปผลการซ่อม ${existing.ticketNumber}` },
      ctx,
    );

    return ticket;
  }

  /** ส่วนที่ 1 ของแบบฟอร์มกระดาษ — หัวหน้างาน/กลุ่มงานของผู้แจ้งซ่อมลงนามรับทราบ/อนุมัติคำขอ (endorsement เท่านั้น ไม่ block workflow)
   *  ผู้มีสิทธิ์ ticket:approve (แอดมิน/ไอที) ลงนามแทนใบไหนก็ได้เหมือนเดิม — ส่วนผู้มีแค่ ticket:approve_unit_head ต้องตั้งค่า
   *  is_unit_head ไว้จริงและอยู่หน่วยงานเดียวกับใบแจ้งซ่อมนี้เท่านั้นถึงจะลงนามได้ (เช็คสดจาก DB ไม่ใช้ค่าจาก JWT เพื่อให้
   *  แอดมินเปิด/ปิด is_unit_head แล้วมีผลทันทีโดยไม่ต้องรอ token หมดอายุ) */
  async approveUnitHead(id: string, ctx: IRequestContext) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError('ไม่พบใบแจ้งซ่อม');

    const canApproveAny = ctx.user.permissions.includes(PERMISSIONS.TICKET_APPROVE);
    if (!canApproveAny) {
      const approver = await prisma.user.findUnique({ where: { id: ctx.user.id }, select: { isUnitHead: true, departmentId: true } });
      if (!approver?.isUnitHead || !existing.departmentId || approver.departmentId !== existing.departmentId) {
        throw new ForbiddenError('คุณเซ็นลงนามอนุมัติได้เฉพาะใบแจ้งซ่อมของหน่วยงานที่ท่านเป็นหัวหน้างาน/กลุ่มงานเท่านั้น');
      }
    }

    const ticket = await this.repo.update(id, { unitHeadApprovedByUserId: ctx.user.id, unitHeadApprovedAt: new Date() });

    await auditLogService.record(
      { action: 'UPDATE', module: 'ticket', entityType: 'RepairTicket', entityId: id, description: `ลงนามอนุมัติ (หัวหน้างาน/กลุ่มงาน) ${existing.ticketNumber}` },
      ctx,
    );

    return ticket;
  }

  /** ส่วนที่ 2 ของแบบฟอร์มกระดาษ — ผลตรวจสอบเบื้องต้นโดยเจ้าหน้าที่ไอที ก่อนเริ่มซ่อมจริง (แยกจากสรุปผลการซ่อมตอนปิดงาน)
   *  ผลตรวจ SEND_EXTERNAL จะเปลี่ยนสถานะ workflow ไปยัง VENDOR_REPAIR ทันที (ไม่ใช่แค่บันทึก column เฉยๆ เหมือน
   *  IN_HOUSE/REPLACE_NEW) — เลือกผู้รับซ่อมและออกใบสั่งซ่อมจริงทำต่อที่ vendor-repair-orders module */
  async recordInspection(id: string, dto: InspectionDto, ctx: IRequestContext) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError('ไม่พบใบแจ้งซ่อม');
    this.assertCanEditAsAssigneeOrReporter(existing, ctx);

    const isInHouse = dto.inspectionOutcome === 'IN_HOUSE';
    const isSendExternal = dto.inspectionOutcome === 'SEND_EXTERNAL';

    const inspectionFields = {
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
    };

    if (isSendExternal) {
      return this.applyTransition(id, 'VENDOR_REPAIR', 'SEND_EXTERNAL', 'INSPECTION', ctx, inspectionFields, dto.sendExternalReason);
    }

    const ticket = await this.repo.update(id, inspectionFields);

    await auditLogService.record(
      { action: 'UPDATE', module: 'ticket', entityType: 'RepairTicket', entityId: id, description: `บันทึกผลตรวจสอบเบื้องต้น ${existing.ticketNumber}` },
      ctx,
    );

    return ticket;
  }

  /** เรียกจาก vendor-repair-orders module เมื่อรับเครื่องคืนจากร้านซ่อมภายนอก — ย้าย workflow กลับเข้า TESTING
   *  ให้ IT/ช่างตรวจสอบก่อนปิดงานตามปกติ (ถ้าตั๋วไม่ได้อยู่ที่ VENDOR_REPAIR แล้ว เช่น ถูกยกเลิกไปก่อน จะโยน error
   *  ออกมาให้ผู้เรียกตัดสินใจว่าจะจัดการอย่างไรต่อ — ไม่ silent fail) */
  async receiveFromVendor(id: string, ctx: IRequestContext) {
    return this.applyTransition(id, 'TESTING', undefined, 'VENDOR_RETURNED', ctx, {}, 'รับเครื่องคืนจากร้านซ่อมภายนอก');
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
      attachmentUrls: attachments.map((a) => ({ fileUrl: a.fileUrl, fileType: a.fileType })),
      ipAddress: ctx.ipAddress,
    });

    return attachments;
  }
}

export const repairTicketService = new RepairTicketService();
