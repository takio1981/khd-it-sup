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
      const seq = await tx.runningNumberSequence.findUnique({ where: { docType } });
      if (!seq) {
        throw new NotFoundError(`ไม่พบการตั้งค่าเลขที่เอกสารสำหรับประเภท ${docType} กรุณาตั้งค่าใน running_number_sequences ก่อน`);
      }

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
