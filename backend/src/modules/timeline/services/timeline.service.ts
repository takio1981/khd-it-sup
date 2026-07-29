import type { ApprovalResult, Prisma } from '@prisma/client';
import { TimelineRepository } from '@modules/timeline/repositories/timeline.repository';
import { prisma, type PrismaClientOrTx } from '@infrastructure/database/prisma';

export interface IAttachmentUrlEntry {
  fileUrl: string;
  fileType: string | null;
}

export interface IRecordEventInput {
  ticketId: string;
  eventType: string;
  previousStatus: string | null;
  currentStatus: string;
  responsibleUserId?: string | null;
  departmentId?: string | null;
  comment?: string | null;
  attachmentUrl?: string | null;
  /** ไฟล์แนบทั้งหมดของ event นี้ (กรณีแนบหลายไฟล์พร้อมกัน) — attachmentUrl เก็บไฟล์แรกไว้เพื่อ backward-compat */
  attachmentUrls?: IAttachmentUrlEntry[] | null;
  approvalResult?: ApprovalResult | null;
  ipAddress?: string | null;
  /** ชั่วโมง SLA ของ step ที่เพิ่งเข้าใหม่ (ถ้ามี) — ใช้คำนวณ slaRemainingSeconds ณ เวลาที่เข้า step นี้ */
  slaHours?: number | null;
}

/**
 * Timeline Service — บันทึกทุก event ของ repair ticket แบบ insert-only (immutable ledger)
 * สเปกข้อ 37: ห้ามลบ/แก้ไข event ที่บันทึกแล้วโดยเด็ดขาด — คลาสนี้จึงมีเมธอดเดียวสำหรับเขียนข้อมูล (recordEvent)
 * ไม่มี update()/delete() ให้เรียกใช้ตั้งแต่ระดับ service ลงไป (ซ้ำกับ DB trigger อีกชั้นหนึ่ง)
 */
export class TimelineService {
  private readonly repo = new TimelineRepository();

  async recordEvent(input: IRecordEventInput, db: PrismaClientOrTx = prisma) {
    const lastEvent = await this.repo.findLastEventByTicket(input.ticketId, db);
    const now = new Date();

    const elapsedSeconds = lastEvent ? Math.max(0, Math.floor((now.getTime() - lastEvent.eventTime.getTime()) / 1000)) : 0;

    const slaRemainingSeconds =
      input.slaHours != null ? input.slaHours * 3600 : null;

    const data: Omit<Prisma.RepairTicketTimelineEventUncheckedCreateInput, 'id'> = {
      ticketId: input.ticketId,
      eventType: input.eventType,
      previousStatus: input.previousStatus,
      currentStatus: input.currentStatus,
      responsibleUserId: input.responsibleUserId,
      departmentId: input.departmentId,
      comment: input.comment,
      attachmentUrl: input.attachmentUrl,
      attachmentUrls: input.attachmentUrls ? (input.attachmentUrls as unknown as Prisma.InputJsonValue) : undefined,
      approvalResult: input.approvalResult,
      ipAddress: input.ipAddress,
      elapsedSeconds,
      slaRemainingSeconds,
    };

    return this.repo.insert(data, db);
  }

  async findByTicketId(ticketId: string) {
    return this.repo.findByTicketId(ticketId);
  }
}

export const timelineService = new TimelineService();
