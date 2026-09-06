import { AssetLoanTimelineRepository } from '@modules/asset-loans/repositories/assetLoanTimeline.repository';
import { prisma, type PrismaClientOrTx } from '@infrastructure/database/prisma';

export type AssetLoanTimelineEventType = 'BORROW' | 'TRANSFER' | 'REMINDER_SENT' | 'RETURN' | 'NOTE';

export interface IRecordLoanEventInput {
  loanId: string;
  eventType: AssetLoanTimelineEventType;
  holderId?: string | null;
  buildingId?: string | null;
  floorId?: string | null;
  roomId?: string | null;
  locationNote?: string | null;
  responsibleUserId?: string | null;
  comment?: string | null;
}

/**
 * Timeline Service สำหรับรายการยืม-คืนครุภัณฑ์ — บันทึกทุก event แบบ insert-only (immutable ledger)
 * เป็น sibling ของ modules/timeline (ที่ผูกกับ repair ticket โดยเฉพาะ) ไม่ใช่การ reuse/generalize ของเดิม
 * เพราะฟิลด์ต่างกันโดยสิ้นเชิง (ที่นี่คือผู้ถือครอง/สถานที่ ไม่ใช่ previousStatus/currentStatus/SLA)
 */
export class AssetLoanTimelineService {
  private readonly repo = new AssetLoanTimelineRepository();

  async recordEvent(input: IRecordLoanEventInput, db: PrismaClientOrTx = prisma) {
    return this.repo.insert(
      {
        loanId: input.loanId,
        eventType: input.eventType,
        holderId: input.holderId,
        buildingId: input.buildingId,
        floorId: input.floorId,
        roomId: input.roomId,
        locationNote: input.locationNote,
        responsibleUserId: input.responsibleUserId,
        comment: input.comment,
      },
      db,
    );
  }

  async findByLoanId(loanId: string) {
    return this.repo.findByLoanId(loanId);
  }
}

export const assetLoanTimelineService = new AssetLoanTimelineService();
