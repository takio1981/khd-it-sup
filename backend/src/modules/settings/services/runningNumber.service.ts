import { Prisma } from '@prisma/client';
import { prisma } from '@infrastructure/database/prisma';
import { NotFoundError } from '@common/errors';

function formatYear(year: number, format: string | null): string {
  if (format === 'BE') return String(year + 543); // พ.ศ.
  return String(year);
}

/**
 * ออกเลขที่เอกสารรันอัตโนมัติ (asset_number, ticket_number, ฯลฯ) แบบ atomic ผ่าน DB transaction
 * รูปแบบ: {prefix}{ปี(ถ้า reset_yearly=true)}-{เลขรันเติมศูนย์ 6 หลัก}
 * ตรวจจับการขึ้นปีใหม่จาก updated_at ของแถวล่าสุด (ไม่ได้เก็บ last_reset_year แยก เพื่อลดความซับซ้อนของ schema)
 */
export class RunningNumberService {
  async getNextNumber(docType: string): Promise<string> {
    return prisma.$transaction(async (tx) => {
      // ใช้ SELECT ... FOR UPDATE ล็อกแถวนี้ตั้งแต่อ่าน (แทน findUnique เฉยๆ) เพราะแถวเลขรันเป็น "hot row"
      // เดียวที่ทุกการสร้างเอกสารประเภทเดียวกันแย่งกันอ่าน-เขียนพร้อมกัน — ถ้าอ่านแบบไม่ล็อกก่อน หลาย transaction
      // จะอ่านค่าเดิมพร้อมกันแล้วชนกันตอน UPDATE (MariaDB error 1020 "Record has changed since last read")
      // ทำให้การแจ้งซ่อม/สร้างครุภัณฑ์ล้มเหลวเป็นชุดเมื่อมีผู้ใช้พร้อมกันหลายคน — ล็อกก่อนอ่านทำให้ transaction อื่น
      // รอคิวแทนที่จะชนกันแล้ว fail ทั้งคู่
      const rows = await tx.$queryRaw<
        { currentNumber: bigint; updatedAt: Date; prefix: string | null; yearFormat: string | null; resetYearly: number }[]
      >(
        Prisma.sql`
          SELECT current_number AS currentNumber, updated_at AS updatedAt, prefix, year_format AS yearFormat, reset_yearly AS resetYearly
          FROM running_number_sequences WHERE doc_type = ${docType} FOR UPDATE
        `,
      );
      const row = rows[0];
      if (!row) {
        throw new NotFoundError(`ไม่พบการตั้งค่าเลขที่เอกสารสำหรับประเภท ${docType} กรุณาตั้งค่าใน running_number_sequences ก่อน`);
      }
      const seq = { currentNumber: row.currentNumber, updatedAt: row.updatedAt, prefix: row.prefix, yearFormat: row.yearFormat, resetYearly: Boolean(row.resetYearly) };

      const now = new Date();
      const currentYear = now.getFullYear();
      const lastYear = seq.updatedAt.getFullYear();
      const shouldReset = seq.resetYearly && currentYear !== lastYear;
      const nextNumber = shouldReset ? 1 : Number(seq.currentNumber) + 1;

      await tx.runningNumberSequence.update({
        where: { docType },
        data: { currentNumber: BigInt(nextNumber) },
      });

      const paddedNumber = String(nextNumber).padStart(6, '0');
      const yearSegment = seq.resetYearly ? `${formatYear(currentYear, seq.yearFormat)}-` : '';
      return `${seq.prefix ?? ''}${yearSegment}${paddedNumber}`;
    });
  }
}

export const runningNumberService = new RunningNumberService();
