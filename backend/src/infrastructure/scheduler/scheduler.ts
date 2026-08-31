import cron from 'node-cron';
import { checkOverdueLoansAndNotify } from '@modules/asset-loans/services/assetLoanReminder.job';
import { runScheduledEquipmentSync } from '@modules/equipment-sync/services/equipmentSync.job';
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

  // เวลานอกช่วง 08:00 ของ job แจ้งเตือนยืมเกินกำหนด — ซิงค์ครุภัณฑ์จาก MOPH AssetTracker ทุกคืนเวลา 02:00
  cron.schedule(
    '0 2 * * *',
    () => {
      try {
        runScheduledEquipmentSync();
      } catch (err) {
        logger.error(`[scheduler] เริ่มซิงค์ครุภัณฑ์จาก MOPH ล้มเหลว: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
    { timezone: 'Asia/Bangkok' },
  );

  logger.info('[scheduler] ตั้งเวลาซิงค์ครุภัณฑ์จาก MOPH AssetTracker ทุกวัน 02:00 (Asia/Bangkok) เรียบร้อย');
}
