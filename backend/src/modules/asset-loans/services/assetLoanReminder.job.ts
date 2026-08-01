import { AssetLoanRepository } from '@modules/asset-loans/repositories/assetLoan.repository';
import { notificationService } from '@modules/notifications/services/notification.service';
import { logger } from '@infrastructure/logger/logger';

const repo = new AssetLoanRepository();

/**
 * ตรวจสอบรายการยืมครุภัณฑ์ที่เกินกำหนดคืนทั้งหมด แล้วแจ้งเตือนผู้ยืมทุกรายการ (ผ่าน notifyAssetLoanEvent เดิม —
 * เคารพการตั้งค่า notifyAssetOverdue/ช่องทางเปิด-ปิดเหมือนเหตุการณ์ยืม/คืนอื่น ๆ)
 * เรียกจาก scheduler วันละครั้ง (ดู infrastructure/scheduler/scheduler.ts) — ยิงซ้ำทุกวันตราบใดที่ยังไม่คืน
 * เป็นพฤติกรรมที่ตั้งใจ (เตือนซ้ำรายวันจนกว่าจะคืน) ไม่ใช่ bug
 */
export async function checkOverdueLoansAndNotify(): Promise<{ checked: number; notified: number }> {
  const overdueLoans = await repo.findOverdueLoans();
  let notified = 0;

  for (const loan of overdueLoans) {
    try {
      await notificationService.notifyAssetLoanEvent('OVERDUE', loan);
      notified += 1;
    } catch (err) {
      logger.error(`[asset-loan-reminder] แจ้งเตือนเกินกำหนดคืนล้มเหลว (loan ${loan.id}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  logger.info(`[asset-loan-reminder] ตรวจสอบยืมเกินกำหนดคืน: พบ ${overdueLoans.length} รายการ, แจ้งเตือนสำเร็จ ${notified} รายการ`);
  return { checked: overdueLoans.length, notified };
}
