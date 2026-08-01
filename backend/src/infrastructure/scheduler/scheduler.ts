import cron from 'node-cron';
import { checkOverdueLoansAndNotify } from '@modules/asset-loans/services/assetLoanReminder.job';
import { logger } from '@infrastructure/logger/logger';

/**
 * Cron job ภายในโปรเซส backend เดียวกัน (ไม่ต้องมี infra แยก) — เหมาะกับขนาด deployment ของระบบนี้
 * รันทุกวันเวลา 08:00 (เวลาไทย) เพื่อแจ้งเตือนรายการยืมครุภัณฑ์ที่เกินกำหนดคืน — ถ้ายังไม่คืนจะถูกแจ้งซ้ำทุกวัน
 */
export function startScheduledJobs(): void {
  cron.schedule(
    '0 8 * * *',
    () => {
      checkOverdueLoansAndNotify().catch((err) => {
        logger.error(`[scheduler] ตรวจสอบยืมเกินกำหนดคืนล้มเหลว: ${err instanceof Error ? err.message : String(err)}`);
      });
    },
    { timezone: 'Asia/Bangkok' },
  );

  logger.info('[scheduler] ตั้งเวลาแจ้งเตือนยืมเกินกำหนดคืนทุกวัน 08:00 (Asia/Bangkok) เรียบร้อย');
}
